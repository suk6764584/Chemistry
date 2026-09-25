import { isCategory, type AiExtraction, type Category, type ConfidenceMap } from "./types";

const SYSTEM_PROMPT = `당신은 사용자가 저장한 정보에서 '다음에 할 행동'을 추출하는 분석기다.
반드시 JSON만 반환한다. 마크다운 펜스나 설명을 붙이지 않는다.

원칙:
- 이미지/텍스트에 명시된 정보만 추출한다.
- 없는 날짜, 장소, 전화번호, 금액을 추측해서 만들지 않는다.
- 확신이 낮으면 해당 필드는 null.
- 요약은 최대 3줄, 추천 행동은 최대 4개.
- 사용자 행동과 무관한 장황한 설명 금지.
- URL 본문을 받지 못했다면 읽었다고 쓰지 않는다.

category 값만 사용:
event, place, todo, coupon, buy, read, reference, other

JSON 스키마:
{
  "title": string|null,
  "summary": string|null,
  "category": string,
  "date": "YYYY-MM-DD"|null,
  "time": "HH:MM"|null,
  "expiration_date": "YYYY-MM-DD"|null,
  "location": string|null,
  "address": string|null,
  "amount": string|null,
  "phone": string|null,
  "reservation_number": string|null,
  "coupon_brand": string|null,
  "coupon_product": string|null,
  "recommended_actions": string[],
  "confidence": {
    "date": number|null,
    "expiration_date": number|null,
    "location": number|null,
    "address": number|null,
    "phone": number|null
  }
}

confidence는 0~1. 0.7 미만이면 해당 값은 null로 둔다.`;

function emptyExtraction(): AiExtraction {
  return {
    title: null,
    summary: null,
    category: "other",
    date: null,
    time: null,
    expiration_date: null,
    location: null,
    address: null,
    amount: null,
    phone: null,
    reservation_number: null,
    coupon_brand: null,
    coupon_product: null,
    recommended_actions: [],
    confidence: {},
  };
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t : null;
}

function asDate(value: unknown): string | null {
  const t = asString(value);
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, d] = t.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return t;
}

function asTime(value: unknown): string | null {
  const t = asString(value);
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function asConf(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(body.slice(start, end + 1)) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

const CONF_THRESHOLD = 0.7;

function applyConfidence<T>(value: T | null, conf: number | null): T | null {
  if (value == null) return null;
  if (conf != null && conf < CONF_THRESHOLD) return null;
  return value;
}

export function normalizeExtraction(raw: Record<string, unknown>): AiExtraction {
  const confRaw = (raw.confidence && typeof raw.confidence === "object" ? raw.confidence : {}) as Record<
    string,
    unknown
  >;
  const confidence: ConfidenceMap = {
    date: asConf(confRaw.date),
    expiration_date: asConf(confRaw.expiration_date),
    location: asConf(confRaw.location),
    address: asConf(confRaw.address),
    phone: asConf(confRaw.phone),
  };

  const categoryRaw = asString(raw.category);
  const category: Category = categoryRaw && isCategory(categoryRaw) ? categoryRaw : "other";

  const actionsRaw = Array.isArray(raw.recommended_actions) ? raw.recommended_actions : [];
  const recommended_actions = actionsRaw
    .map((a) => asString(a))
    .filter((a): a is string => Boolean(a))
    .slice(0, 4);

  const summary = asString(raw.summary);
  const summaryClamped = summary
    ? summary
        .split("\n")
        .filter((l) => l.trim())
        .slice(0, 3)
        .join("\n")
    : null;

  return {
    title: asString(raw.title),
    summary: summaryClamped,
    category,
    date: applyConfidence(asDate(raw.date), confidence.date ?? null),
    time: asTime(raw.time),
    expiration_date: applyConfidence(asDate(raw.expiration_date), confidence.expiration_date ?? null),
    location: applyConfidence(asString(raw.location), confidence.location ?? null),
    address: applyConfidence(asString(raw.address), confidence.address ?? null),
    amount: asString(raw.amount),
    phone: applyConfidence(asString(raw.phone), confidence.phone ?? null),
    reservation_number: asString(raw.reservation_number),
    coupon_brand: asString(raw.coupon_brand),
    coupon_product: asString(raw.coupon_product),
    recommended_actions,
    confidence,
  };
}

type ChatContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

async function callGrok(messages: { role: "system" | "user"; content: ChatContent }[]): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_UNAVAILABLE");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.1,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages,
      }),
    });
    if (!res.ok) {
      throw new Error(`AI_HTTP_${res.status}`);
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return body.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeWithAi(opts: {
  originalType: string;
  text?: string | null;
  sourceUrl?: string | null;
  pageMeta?: { title?: string | null; description?: string | null; excerpt?: string | null; fetched: boolean };
  imageDataUrl?: string | null;
}): Promise<AiExtraction> {
  const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [];

  const userText = [
    `입력 유형: ${opts.originalType}`,
    opts.sourceUrl ? `URL: ${opts.sourceUrl}` : null,
    opts.text ? `사용자 입력:\n${opts.text.slice(0, 4000)}` : null,
    opts.pageMeta
      ? opts.pageMeta.fetched
        ? `페이지에서 읽은 정보:\n제목: ${opts.pageMeta.title ?? "(없음)"}\n설명: ${opts.pageMeta.description ?? "(없음)"}\n본문 발췌:\n${opts.pageMeta.excerpt ?? ""}`
        : "페이지 본문을 읽지 못했습니다. URL 문자열만 보고 분류하세요. 내용을 읽은 것처럼 쓰지 마세요."
      : null,
    opts.imageDataUrl ? "이미지가 첨부되어 있습니다. 이미지에 보이는 정보만 추출하세요." : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  parts.push({ type: "text", text: userText });
  if (opts.imageDataUrl) {
    parts.push({ type: "image_url", image_url: { url: opts.imageDataUrl } });
  }

  const content = await callGrok([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: parts },
  ]);
  const parsed = parseJsonObject(content);
  if (!parsed) return emptyExtraction();
  return normalizeExtraction(parsed);
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (/^10\./.test(host)) return true;
  if (/^127\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  return false;
}

export function sanitizeHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (isPrivateHostname(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function metaContent(html: string, key: string): string | null {
  const prop = html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
  );
  if (prop?.[1]) return decodeHtml(prop[1]);
  const prop2 = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i"),
  );
  if (prop2?.[1]) return decodeHtml(prop2[1]);
  return null;
}

export async function fetchPageMeta(url: string): Promise<{
  title: string | null;
  description: string | null;
  excerpt: string | null;
  fetched: boolean;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "ActionBox/1.0 (metadata fetch)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return { title: null, description: null, excerpt: null, fetched: false };
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text") && !contentType.includes("html") && contentType.length > 0) {
      return { title: null, description: null, excerpt: null, fetched: false };
    }
    const html = (await res.text()).slice(0, 200_000);
    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const title = metaContent(html, "og:title") || (titleTag ? decodeHtml(titleTag.replace(/\s+/g, " ")) : null);
    const description = metaContent(html, "og:description") || metaContent(html, "description");
    const excerpt = decodeHtml(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 1800),
    );
    return { title, description, excerpt, fetched: true };
  } catch {
    return { title: null, description: null, excerpt: null, fetched: false };
  } finally {
    clearTimeout(timer);
  }
}

export function defaultReminder(category: Category, eventDate: string | null, expiration: string | null): {
  reminder_date: string | null;
  reminder_enabled: boolean;
} {
  if (category === "coupon" && expiration) {
    const [y, m, d] = expiration.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 7);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    return { reminder_date: iso, reminder_enabled: true };
  }
  if (category === "event" && eventDate) {
    const [y, m, d] = eventDate.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    return { reminder_date: iso, reminder_enabled: true };
  }
  return { reminder_date: null, reminder_enabled: false };
}
