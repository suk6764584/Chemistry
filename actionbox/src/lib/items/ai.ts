import {
  isActionCode,
  isCategory,
  type ActionCode,
  type AiExtraction,
  type Category,
  type ConfidenceMap,
} from "./types";

const SYSTEM_PROMPT = `너는 사용자가 저장한 스크린샷·사진·링크·메모에서 '다음에 할 행동'에 필요한 정보만 뽑는 추출기다.
JSON 객체 하나만 출력한다. 설명, 마크다운, 코드펜스는 쓰지 않는다.

규칙
1. 이미지·텍스트·제공된 페이지 정보에 실제로 보이는 값만 쓴다. 보이지 않는 날짜·시간·장소·주소·전화번호·금액을 만들거나 추측하지 않는다.
2. 값이 없거나 애매하면 null. 잘못 채운 값보다 빈 값이 낫다.
3. confidence에 각 값의 확신도(0~1)를 적는다. 글자가 흐리거나 후보가 여러 개면 0.7 미만.
4. 연도가 없는 날짜는 '오늘' 이후 가장 가까운 날짜로 쓰고 confidence는 0.8 이하. '내일', '이번 주 토요일' 같은 표현은 '오늘' 기준으로 계산한다.
5. 페이지 본문을 받지 못한 링크는 URL 문자열로만 분류하고 summary는 null로 둔다. 읽은 것처럼 쓰지 않는다.
6. title은 짧은 이름(행사명, 상호, 상품명, 할 일). summary는 최대 3줄, 사용자가 할 일 중심으로.
7. recommended_actions는 아래 코드 중 실제로 가능한 것만 최대 4개, 중요한 순서로.

category 값 (하나만)
- event: 날짜가 있는 행사·공연·모임·예약
- place: 가게·맛집·카페·여행지 등 가볼 장소
- todo: 사용자가 해야 할 일 (검사, 신청, 납부, 연락 등)
- coupon: 쿠폰·기프티콘·상품권·할인코드, 신청·제출 마감
- buy: 사고 싶은 상품, 쇼핑 링크
- read: 나중에 읽을 글·블로그·기사·문서
- reference: 두고 볼 참고자료 (설명서, 표, 정보 정리)
- other: 위에 맞지 않음

recommended_actions 코드
- calendar: 캘린더에 추가 (date가 있을 때)
- remind: 알림 (쿠폰 만료 전, 행사 전날 등)
- map: 지도 열기 (location 또는 address가 있을 때)
- call: 전화 걸기 (phone이 있을 때)
- open: 링크 열기 (url이 있을 때)
- visit: 가볼 곳으로 표시 (장소)
- today: 오늘 할 일로 지정 (할 일)
- complete: 완료·사용완료
- archive: 보관

출력 키 (모두 포함, 없으면 null)
title, summary, category,
date ("YYYY-MM-DD", 행사·예약·할 일의 날짜), time ("HH:MM", 24시간),
expiration_date ("YYYY-MM-DD", 쿠폰 유효기간·신청 마감일),
location (장소·상호 이름), address, amount (보이는 그대로, 예: "26,900원"), phone,
reservation_number, coupon_brand, coupon_product,
url (이미지·텍스트 안에 보이는 링크),
recommended_actions (코드 배열),
confidence { category, date, time, expiration_date, location, address, phone }`;

const CONF_THRESHOLD = 0.7;
const CATEGORY_CONF_THRESHOLD = 0.6;

const FIELD_LABELS = {
  date: "날짜",
  time: "시간",
  expiration_date: "만료일",
  location: "장소",
  address: "주소",
  phone: "전화번호",
} as const;

function asString(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t.slice(0, max) : null;
}

export function asDate(value: unknown): string | null {
  const t = asString(value);
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, d] = t.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return t;
}

export function asTime(value: unknown): string | null {
  const t = asString(value);
  const m = t?.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function asPhone(value: unknown): string | null {
  const t = asString(value, 40);
  if (!t || !/^[0-9+()\-.\s]+$/.test(t)) return null;
  return t.replace(/\D/g, "").length >= 7 ? t : null;
}

export function asHttpUrl(value: unknown): string | null {
  const t = asString(value, 2000);
  if (!t) return null;
  try {
    const url = new URL(t);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function asConf(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

export function clampSummary(value: string | null): string | null {
  if (!value) return null;
  const lines = value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("\n");
  return lines.slice(0, 240) || null;
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

/**
 * Validate the model output. Anything malformed becomes null, and any value the
 * model itself was unsure about (confidence < 0.7) is dropped rather than shown.
 */
export function normalizeExtraction(raw: Record<string, unknown>): AiExtraction {
  const confRaw = (raw.confidence && typeof raw.confidence === "object" ? raw.confidence : {}) as Record<
    string,
    unknown
  >;
  const confidence: ConfidenceMap = {
    category: asConf(confRaw.category),
    date: asConf(confRaw.date),
    time: asConf(confRaw.time),
    expiration_date: asConf(confRaw.expiration_date),
    location: asConf(confRaw.location),
    address: asConf(confRaw.address),
    phone: asConf(confRaw.phone),
  };

  const uncertain: string[] = [];
  const gate = <T>(key: keyof typeof FIELD_LABELS, value: T | null): T | null => {
    if (value == null) return null;
    const conf = confidence[key];
    if (conf != null && conf < CONF_THRESHOLD) {
      uncertain.push(FIELD_LABELS[key]);
      return null;
    }
    return value;
  };

  const categoryRaw = asString(raw.category);
  const category: Category = categoryRaw && isCategory(categoryRaw) ? categoryRaw : "other";
  if (confidence.category != null && confidence.category < CATEGORY_CONF_THRESHOLD) {
    uncertain.push("분류");
  }

  const actionsRaw = Array.isArray(raw.recommended_actions) ? raw.recommended_actions : [];
  const recommended_actions = [
    ...new Set(actionsRaw.map((a) => asString(a)).filter((a): a is ActionCode => Boolean(a && isActionCode(a)))),
  ].slice(0, 4);

  return {
    title: asString(raw.title, 80),
    summary: clampSummary(asString(raw.summary, 600)),
    category,
    date: gate("date", asDate(raw.date)),
    time: gate("time", asTime(raw.time)),
    expiration_date: gate("expiration_date", asDate(raw.expiration_date)),
    location: gate("location", asString(raw.location, 80)),
    address: gate("address", asString(raw.address, 160)),
    amount: asString(raw.amount, 40),
    phone: gate("phone", asPhone(raw.phone)),
    reservation_number: asString(raw.reservation_number, 60),
    coupon_brand: asString(raw.coupon_brand, 60),
    coupon_product: asString(raw.coupon_product, 80),
    url: asHttpUrl(raw.url),
    recommended_actions,
    confidence,
    uncertain,
  };
}

/** What the user should check after analysis, or null when the result can go straight to the home screen. */
export function reviewNote(ex: AiExtraction, pageRead: boolean | null): string | null {
  const notes: string[] = [];
  const fields = ex.uncertain.filter((f) => f !== "분류");
  if (pageRead === false) notes.push("링크 내용을 읽지 못해 주소만 저장했어요. 제목을 확인해 주세요.");
  if (fields.length) notes.push(`확실하지 않은 값(${fields.join(", ")})은 비워 두었어요. 확인해 주세요.`);
  if (ex.uncertain.includes("분류")) notes.push("분류가 확실하지 않아요. 맞는지 확인해 주세요.");
  if (ex.category === "coupon" && !ex.expiration_date && !fields.includes("만료일")) {
    notes.push("만료일을 찾지 못했어요. 있으면 입력해 주세요.");
  }
  if (ex.category === "event" && !ex.date && !fields.includes("날짜")) {
    notes.push("날짜를 찾지 못했어요. 입력해 주세요.");
  }
  if (!ex.title && ex.category === "other") notes.push("정보를 정확하게 읽지 못했습니다. 직접 입력해 주세요.");
  return notes.length ? notes.join(" ") : null;
}

type ChatPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

/** Chat model for analysis; must read images and support JSON mode. Override with AI_MODEL. */
const DEFAULT_MODEL = "gpt-4.1-mini";

/**
 * OpenAI Chat Completions. Without OPENAI_API_KEY the app keeps working: items
 * are saved and the user is told analysis is unavailable (AI_UNAVAILABLE).
 */
async function callAi(messages: { role: "system" | "user"; content: string | ChatPart[] }[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("AI_UNAVAILABLE");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.AI_MODEL?.trim() || DEFAULT_MODEL,
        temperature: 0,
        max_completion_tokens: 900,
        response_format: { type: "json_object" },
        messages,
      }),
    });
    if (!res.ok) throw new Error(`AI_HTTP_${res.status}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const TYPE_LABELS: Record<string, string> = {
  image: "사진",
  screenshot: "스크린샷",
  url: "링크",
  text: "텍스트 메모",
};

export type PageMeta = {
  title: string | null;
  description: string | null;
  excerpt: string | null;
  fetched: boolean;
};

export async function analyzeWithAi(opts: {
  originalType: string;
  today: string;
  text?: string | null;
  sourceUrl?: string | null;
  pageMeta?: PageMeta;
  imageDataUrl?: string | null;
}): Promise<AiExtraction | null> {
  const [y, m, d] = opts.today.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const meta = opts.pageMeta;
  const userText = [
    `오늘: ${opts.today} (${weekday})`,
    `입력 유형: ${TYPE_LABELS[opts.originalType] ?? opts.originalType}`,
    opts.sourceUrl ? `URL: ${opts.sourceUrl}` : null,
    opts.text && opts.originalType !== "url" ? `사용자 입력:\n${opts.text.slice(0, 4000)}` : null,
    meta
      ? meta.fetched
        ? `페이지에서 읽은 정보:\n제목: ${meta.title ?? "(없음)"}\n설명: ${meta.description ?? "(없음)"}\n본문 발췌:\n${meta.excerpt ?? ""}`
        : "페이지 본문을 읽지 못했습니다. URL 문자열만 보고 분류하고, summary는 null로 두세요."
      : null,
    opts.imageDataUrl ? "이미지가 첨부되어 있습니다. 이미지에 보이는 정보만 추출하세요." : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const parts: ChatPart[] = [{ type: "text", text: userText }];
  if (opts.imageDataUrl) parts.push({ type: "image_url", image_url: { url: opts.imageDataUrl } });

  const content = await callAi([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: parts },
  ]);
  const parsed = parseJsonObject(content);
  return parsed ? normalizeExtraction(parsed) : null;
}

// ── Link reading ─────────────────────────────────────────────────────────────
// Server-side fetch of a user-supplied URL: only public http(s) hosts, every
// redirect hop re-checked, and a hard cap on how much of the body is read.

function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateIPv6(ip: string): boolean {
  const h = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "::" || h === "::1") return true;
  if (/^f[cd]/.test(h) || h.startsWith("fe80")) return true;
  const mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return h.startsWith("::ffff:");
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  if (!host || host === "localhost" || /\.(localhost|local|internal)$/.test(host)) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return isPrivateIPv4(host);
  if (host.startsWith("[")) return isPrivateIPv6(host);
  return false;
}

/** Normalize a user-entered link to http(s), rejecting local/private hosts. */
export function sanitizeHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (isBlockedHostname(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function resolvesToPublicAddress(hostname: string): Promise<boolean> {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.startsWith("[")) return !isBlockedHostname(hostname);
  try {
    const { lookup } = await import("node:dns/promises");
    const addrs = await lookup(hostname, { all: true });
    return (
      addrs.length > 0 &&
      addrs.every((a) => (a.family === 6 ? !isPrivateIPv6(a.address) : !isPrivateIPv4(a.address)))
    );
  } catch {
    return false;
  }
}

function decodeHtml(value: string): string {
  const fromCode = (n: number) => {
    try {
      return String.fromCodePoint(n);
    } catch {
      return "";
    }
  };
  return value
    .replace(/&#(\d+);/g, (_, n: string) => fromCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => fromCode(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function readMetaTags(html: string): Map<string, string> {
  const tags = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
    }
    const key = (attrs.property || attrs.name || "").toLowerCase();
    if (key && attrs.content && !tags.has(key)) tags.set(key, decodeHtml(attrs.content));
  }
  return tags;
}

async function readLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const out = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const c of chunks) {
    const part = c.subarray(0, out.length - offset);
    out.set(part, offset);
    offset += part.length;
    if (offset >= out.length) break;
  }
  return out;
}

function decodeBody(bytes: Uint8Array, contentType: string): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  const charset = (
    contentType.match(/charset=["']?([\w-]+)/i)?.[1] ??
    head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ??
    "utf-8"
  ).toLowerCase();
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

const NOT_READ: PageMeta = { title: null, description: null, excerpt: null, fetched: false };

export async function fetchPageMeta(startUrl: string): Promise<PageMeta> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    let url = startUrl;
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop += 1) {
      const safe = sanitizeHttpUrl(url);
      if (!safe || !(await resolvesToPublicAddress(new URL(safe).hostname))) return NOT_READ;
      res = await fetch(safe, {
        method: "GET",
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "ActionBox/1.0 (+link preview)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "ko,en;q=0.8",
        },
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        url = new URL(location, safe).toString();
        res = null;
        continue;
      }
      break;
    }
    if (!res || !res.ok) return NOT_READ;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !/html|text/i.test(contentType)) return NOT_READ;

    const html = decodeBody(await readLimited(res, 600_000), contentType);
    const meta = readMetaTags(html);
    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const title = meta.get("og:title") || (titleTag ? decodeHtml(titleTag) : null) || null;
    const description = meta.get("og:description") || meta.get("description") || null;
    const excerpt = decodeHtml(
      html
        .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ).slice(0, 1800);
    if (!title && !description && !excerpt) return NOT_READ;
    return { title, description, excerpt: excerpt || null, fetched: true };
  } catch {
    return NOT_READ;
  } finally {
    clearTimeout(timer);
  }
}
