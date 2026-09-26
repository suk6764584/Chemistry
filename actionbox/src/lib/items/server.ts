import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  analyzeWithAi,
  asDate,
  asHttpUrl,
  asTime,
  clampSummary,
  fetchPageMeta,
  reviewNote,
  sanitizeHttpUrl,
  type PageMeta,
} from "./ai";
import { parseTextFacts } from "./parse-text";
import { defaultReminder } from "./reminder";
import { reminderForSample, sampleItems } from "./samples";
import {
  AI_OFF_ERROR,
  AI_OFF_FOUND_ERROR,
  isActionCode,
  isCategory,
  isStatus,
  SAMPLE_NOTE,
  type ActionCode,
  type AnalysisStatus,
  type ConfidenceMap,
  type CreateItemInput,
  type Item,
  type ItemPatch,
  type OriginalType,
} from "./types";

const LIST_COLUMNS = `
  id, original_type, original_content, source_url, title, summary, category,
  extracted_date::text as extracted_date,
  extracted_time,
  expiration_date::text as expiration_date,
  location, address, amount, phone, reservation_number, coupon_brand, coupon_product,
  action_type, recommended_actions, confidence, analysis_status, analysis_error, analysis_note, status,
  reminder_date::text as reminder_date, reminder_enabled, do_today,
  created_at, updated_at,
  (image_data is not null) as has_image
`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BASE64 = 1_900_000;

type ItemRow = Record<string, unknown>;

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function asDateStr(value: unknown): string | null {
  if (value == null) return null;
  return String(value).slice(0, 10) || null;
}

function asBool(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function str(value: unknown): string | null {
  return value == null ? null : String(value);
}

function mapItem(row: ItemRow): Item {
  const categoryRaw = String(row.category ?? "other");
  const statusRaw = String(row.status ?? "inbox");
  const analysisRaw = String(row.analysis_status ?? "pending");
  const actionType = str(row.action_type);
  return {
    id: String(row.id),
    original_type: String(row.original_type) as OriginalType,
    original_content: str(row.original_content),
    // Only ever hand http(s) links to the UI (older rows could hold anything).
    source_url: /^https?:\/\//i.test(String(row.source_url ?? "")) ? String(row.source_url) : null,
    title: str(row.title),
    summary: str(row.summary),
    category: isCategory(categoryRaw) ? categoryRaw : "other",
    extracted_date: asDateStr(row.extracted_date),
    extracted_time: str(row.extracted_time),
    expiration_date: asDateStr(row.expiration_date),
    location: str(row.location),
    address: str(row.address),
    amount: str(row.amount),
    phone: str(row.phone),
    reservation_number: str(row.reservation_number),
    coupon_brand: str(row.coupon_brand),
    coupon_product: str(row.coupon_product),
    action_type: actionType && isActionCode(actionType) ? actionType : null,
    recommended_actions: parseJson<unknown[]>(row.recommended_actions, []).filter(
      (a): a is ActionCode => typeof a === "string" && isActionCode(a),
    ),
    confidence: parseJson<ConfidenceMap>(row.confidence, {}),
    analysis_status: (["pending", "done", "failed"].includes(analysisRaw) ? analysisRaw : "pending") as AnalysisStatus,
    analysis_error: str(row.analysis_error),
    analysis_note: str(row.analysis_note),
    status: isStatus(statusRaw) ? statusRaw : "inbox",
    reminder_date: asDateStr(row.reminder_date),
    reminder_enabled: asBool(row.reminder_enabled),
    do_today: asBool(row.do_today),
    has_image: asBool(row.has_image),
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  };
}

async function getItemRow(userId: string, id: string): Promise<Item | null> {
  const sql = await getSql();
  const rows = await sql.query<ItemRow>(
    `select ${LIST_COLUMNS} from items where id = $1 and user_id = $2 limit 1`,
    [id, userId],
  );
  const row = rows[0];
  return row ? mapItem(row) : null;
}

async function listRows(userId: string): Promise<Item[]> {
  const sql = await getSql();
  const rows = await sql.query<ItemRow>(
    `select ${LIST_COLUMNS} from items where user_id = $1 order by created_at desc`,
    [userId],
  );
  return rows.map(mapItem);
}

/** The caller's local date (YYYY-MM-DD), or today in Korea when missing/invalid. */
function todayOr(value: unknown): string {
  return (
    asDate(value) ??
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date())
  );
}

function cleanText(value: unknown, max: number): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  return t ? t.slice(0, max) : null;
}

function fallbackTitle(input: { original_type: OriginalType; original_content: string | null; source_url: string | null }): string {
  if (input.source_url) {
    try {
      return new URL(input.source_url).hostname.replace(/^www\./, "");
    } catch {
      return input.source_url;
    }
  }
  if (input.original_content) {
    const line = (input.original_content.trim().split("\n")[0] ?? "").trim();
    if (line.length <= 40) return line || "제목 없음";
    // Cut at a word boundary so a title never ends mid-word ("A1234, 8").
    const cut = line.slice(0, 40);
    const space = cut.lastIndexOf(" ");
    return `${space > 15 ? cut.slice(0, space) : cut}…`;
  }
  if (input.original_type === "screenshot") return "스크린샷";
  if (input.original_type === "image") return "사진";
  return "새 항목";
}

export const listItems = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listRows(context.userId));

export const getItem = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => String(id))
  .handler(async ({ context, data: id }) => getItemRow(context.userId, id));

export const getItemImage = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => String(id))
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const rows = await sql.query<{ image_data: string | null; image_mime: string | null }>(
      `select image_data, image_mime from items where id = $1 and user_id = $2 limit 1`,
      [id, context.userId],
    );
    const row = rows[0];
    if (!row?.image_data) return null;
    return { base64: row.image_data, mime: row.image_mime || "image/jpeg" };
  });

/**
 * Step 1 of capture: store the original right away, in the inbox. Analysis is
 * a separate call so a slow or failed AI request can never lose what the user
 * saved. The id comes from the client, so a retried save is idempotent.
 */
export const createItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: CreateItemInput) => input)
  .handler(async ({ context, data }) => {
    const id = String(data.id ?? "");
    if (!UUID_RE.test(id)) throw new Error("잘못된 요청입니다.");
    const originalType = data.original_type;
    if (!["image", "screenshot", "url", "text"].includes(originalType)) {
      throw new Error("지원하지 않는 입력입니다.");
    }

    let sourceUrl: string | null = null;
    if (originalType === "url") {
      sourceUrl = sanitizeHttpUrl(String(data.source_url || data.original_content || ""));
      if (!sourceUrl) throw new Error("올바른 링크를 입력해 주세요. (http:// 또는 https://)");
    }
    const originalContent = originalType === "url" ? sourceUrl : cleanText(data.original_content, 10_000);
    if (originalType === "text" && !originalContent) throw new Error("내용을 입력해 주세요.");

    const isImage = originalType === "image" || originalType === "screenshot";
    if (isImage) {
      if (typeof data.image_base64 !== "string" || !data.image_base64 || !IMAGE_MIMES.includes(String(data.image_mime))) {
        throw new Error("이미지를 선택해 주세요.");
      }
      if (data.image_base64.length > MAX_IMAGE_BASE64) throw new Error("이미지가 너무 큽니다.");
    }

    const sql = await getSql();
    await sql.query(
      `insert into items (
        id, user_id, original_type, original_content, image_data, image_mime, source_url,
        title, category, status, analysis_status
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,'other','inbox','pending')
      on conflict (id) do nothing`,
      [
        id,
        context.userId,
        originalType,
        originalContent,
        isImage ? data.image_base64 : null,
        isImage ? data.image_mime : null,
        sourceUrl,
        fallbackTitle({ original_type: originalType, original_content: originalContent, source_url: sourceUrl }),
      ],
    );

    const created = await getItemRow(context.userId, id);
    if (!created) throw new Error("항목을 저장하지 못했습니다.");
    return created;
  });

/** Analyses per user per day (Asia/Seoul) — caps what one account can spend of the AI budget. */
function aiDailyLimit(): number {
  const n = Number.parseInt(process.env.AI_DAILY_LIMIT ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 50;
}

/** Counts this attempt and throws AI_LIMIT once today's cap is used up. */
async function takeAiQuota(userId: string): Promise<void> {
  if (!process.env.OPENAI_API_KEY?.trim()) return; // Nothing is spent without a key.
  const sql = await getSql();
  const rows = await sql.query<{ count: number }>(
    `insert into ai_usage (user_id, day, count) values ($1, (now() at time zone 'Asia/Seoul')::date, 1)
     on conflict (user_id, day) do update set count = ai_usage.count + 1
     returning count`,
    [userId],
  );
  if (Number(rows[0]?.count ?? 0) > aiDailyLimit()) throw new Error("AI_LIMIT");
}

async function runAnalysis(userId: string, item: Item, today: string): Promise<void> {
  const sql = await getSql();
  let pageMeta: PageMeta | undefined;
  try {
    await takeAiQuota(userId);
    const url = item.source_url ? sanitizeHttpUrl(item.source_url) : null;
    if (item.original_type === "url" && url) pageMeta = await fetchPageMeta(url);

    let imageDataUrl: string | null = null;
    if (item.has_image) {
      const img = await sql.query<{ image_data: string | null; image_mime: string | null }>(
        `select image_data, image_mime from items where id = $1 and user_id = $2 limit 1`,
        [item.id, userId],
      );
      const row = img[0];
      if (row?.image_data) imageDataUrl = `data:${row.image_mime || "image/jpeg"};base64,${row.image_data}`;
    }

    const ex = await analyzeWithAi({
      originalType: item.original_type,
      today,
      text: item.original_content,
      sourceUrl: url ?? item.source_url,
      pageMeta,
      imageDataUrl,
    });
    if (!ex) throw new Error("AI_BAD_RESPONSE");

    const pageRead = pageMeta ? pageMeta.fetched : null;
    const note = reviewNote(ex, pageRead);
    const title =
      ex.title ||
      (pageMeta?.fetched ? pageMeta.title : null) ||
      item.title ||
      fallbackTitle(item);
    const summary = pageRead === false ? null : ex.summary;
    const reminder = defaultReminder(ex.category, ex.date, ex.expiration_date, today);

    await sql.query(
      // "다시 분석" never overwrites what is already there (the user may have typed it):
      // AI values only fill empty fields, and title/type/state change only before confirmation.
      `update items set
        title = case when status = 'inbox' then $3 else title end,
        summary = coalesce(summary, $4),
        category = case when status = 'inbox' then $5 else category end,
        extracted_date = coalesce(extracted_date, $6::date), extracted_time = coalesce(extracted_time, $7),
        expiration_date = coalesce(expiration_date, $8::date),
        location = coalesce(location, $9), address = coalesce(address, $10), amount = coalesce(amount, $11),
        phone = coalesce(phone, $12), reservation_number = coalesce(reservation_number, $13),
        coupon_brand = coalesce(coupon_brand, $14), coupon_product = coalesce(coupon_product, $15),
        source_url = coalesce(source_url, $16),
        action_type = $17, recommended_actions = $18::jsonb, confidence = $19::jsonb,
        analysis_status = 'done', analysis_error = null, analysis_note = $20,
        status = case when status = 'inbox' then $21 else status end,
        reminder_enabled = case when reminder_date is null then $23 else reminder_enabled end,
        reminder_date = coalesce(reminder_date, $22::date),
        updated_at = now()
      where id = $1 and user_id = $2`,
      [
        item.id,
        userId,
        title,
        summary,
        ex.category,
        ex.date,
        ex.time,
        ex.expiration_date,
        ex.location,
        ex.address,
        ex.amount,
        ex.phone,
        ex.reservation_number,
        ex.coupon_brand,
        ex.coupon_product,
        ex.url,
        ex.recommended_actions[0] ?? null,
        JSON.stringify(ex.recommended_actions),
        JSON.stringify(ex.confidence),
        note,
        note ? "inbox" : "active",
        reminder.reminder_date,
        reminder.reminder_enabled,
      ],
    );
  } catch (err) {
    const code = err instanceof Error ? err.message : "AI_ERROR";
    // Log only the error code — never the user's content.
    console.warn(`[items] analysis failed: ${code}`);
    const message =
      code === "AI_UNAVAILABLE"
        ? AI_OFF_ERROR
        : code === "AI_LIMIT"
          ? `오늘 자동 분석 한도(${aiDailyLimit()}회)를 다 썼어요. 내일 다시 분석하거나 직접 입력해 주세요.`
          : "정보를 정확하게 읽지 못했습니다. 직접 입력해 주세요.";
    // The page's own title/description are facts, not AI output — keep them when we have them.
    const pageTitle = pageMeta?.fetched ? pageMeta.title : null;
    const pageSummary = pageMeta?.fetched ? clampSummary(pageMeta.description) : null;
    // Without AI, still pick up plain date/time/amount phrases ("10월 2일 오후 3시", "25만원")
    // so the item gets a D-day and a reminder; empty fields only, the user confirms them.
    const facts = item.original_type === "text" ? parseTextFacts(item.original_content, today) : parseTextFacts(null);
    const reminder = item.reminder_date
      ? { reminder_date: null, reminder_enabled: false }
      : defaultReminder(item.category, item.extracted_date ?? facts.date, item.expiration_date, today);
    await sql.query(
      `update items set
        analysis_status = 'failed', analysis_error = $3, analysis_note = null,
        title = coalesce($4, title), summary = coalesce(summary, $5),
        extracted_date = coalesce(extracted_date, $6::date),
        extracted_time = coalesce(extracted_time, $7),
        amount = coalesce(amount, $8),
        reminder_enabled = case when reminder_date is null then $10 else reminder_enabled end,
        reminder_date = coalesce(reminder_date, $9::date),
        updated_at = now()
      where id = $1 and user_id = $2`,
      [
        item.id,
        userId,
        facts.date && code === "AI_UNAVAILABLE" ? AI_OFF_FOUND_ERROR : message,
        pageTitle,
        pageSummary,
        facts.date,
        facts.time,
        facts.amount,
        reminder.reminder_date,
        reminder.reminder_enabled,
      ],
    );
  }
}

/** Step 2 of capture (and "다시 분석"): read the original and fill in the fields. */
export const analyzeItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; today?: string }) => ({ id: String(input.id), today: todayOr(input.today) }))
  .handler(async ({ context, data }) => {
    const current = await getItemRow(context.userId, data.id);
    if (!current) throw new Error("항목을 찾을 수 없습니다.");
    const sql = await getSql();
    await sql.query(
      `update items set analysis_status = 'pending', analysis_error = null, updated_at = now()
       where id = $1 and user_id = $2`,
      [data.id, context.userId],
    );
    await runAnalysis(context.userId, current, data.today);
    const updated = await getItemRow(context.userId, data.id);
    if (!updated) throw new Error("항목을 찾을 수 없습니다.");
    return updated;
  });

function patchDate(value: unknown, label: string): string | null {
  if (value == null || value === "") return null;
  const d = asDate(value);
  if (!d) throw new Error(`${label} 형식이 올바르지 않습니다.`);
  return d;
}

export const updateItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; patch: ItemPatch }) => input)
  .handler(async ({ context, data }) => {
    const current = await getItemRow(context.userId, String(data.id));
    if (!current) throw new Error("항목을 찾을 수 없습니다.");

    const p = data.patch ?? {};
    const pick = <K extends keyof ItemPatch>(key: K, clean: (v: unknown) => Item[K]): Item[K] =>
      p[key] !== undefined ? clean(p[key]) : current[key];

    const title = pick("title", (v) => cleanText(v, 120));
    const summary = pick("summary", (v) => clampSummary(cleanText(v, 600)));
    const category = pick("category", (v) => (typeof v === "string" && isCategory(v) ? v : current.category));
    const extracted_date = pick("extracted_date", (v) => patchDate(v, "날짜"));
    const extracted_time = pick("extracted_time", (v) => {
      if (v == null || v === "") return null;
      const t = asTime(v);
      if (!t) throw new Error("시간 형식이 올바르지 않습니다.");
      return t;
    });
    const expiration_date = pick("expiration_date", (v) => patchDate(v, "만료일"));
    const location = pick("location", (v) => cleanText(v, 80));
    const address = pick("address", (v) => cleanText(v, 160));
    const amount = pick("amount", (v) => cleanText(v, 40));
    const phone = pick("phone", (v) => cleanText(v, 40));
    const reservation_number = pick("reservation_number", (v) => cleanText(v, 60));
    const coupon_brand = pick("coupon_brand", (v) => cleanText(v, 60));
    const coupon_product = pick("coupon_product", (v) => cleanText(v, 80));
    const source_url = pick("source_url", (v) => {
      if (v == null || v === "") return null;
      const u = asHttpUrl(v);
      if (!u) throw new Error("링크는 http:// 또는 https:// 로 시작해야 합니다.");
      return u;
    });
    const original_content = pick("original_content", (v) => cleanText(v, 10_000));
    const status = pick("status", (v) => (typeof v === "string" && isStatus(v) ? v : current.status));
    const do_today = pick("do_today", (v) => v === true);
    let reminder_date = pick("reminder_date", (v) => patchDate(v, "알림 날짜"));
    let reminder_enabled = pick("reminder_enabled", (v) => v === true);

    // Keep an automatic reminder in step with the dates it was derived from,
    // unless the user set the reminder themselves.
    const reminderTouched = p.reminder_enabled !== undefined || p.reminder_date !== undefined;
    const basisChanged =
      category !== current.category ||
      extracted_date !== current.extracted_date ||
      expiration_date !== current.expiration_date;
    if (!reminderTouched && basisChanged) {
      const today = todayOr(null);
      const oldDefault = defaultReminder(current.category, current.extracted_date, current.expiration_date, today);
      const wasAutomatic =
        (!current.reminder_enabled && !current.reminder_date) ||
        (current.reminder_enabled === oldDefault.reminder_enabled &&
          current.reminder_date === oldDefault.reminder_date);
      if (wasAutomatic) {
        const next = defaultReminder(category, extracted_date, expiration_date, today);
        reminder_date = next.reminder_date;
        reminder_enabled = next.reminder_enabled;
      }
    }
    if (reminder_enabled && !reminder_date) reminder_enabled = false;

    // Write only the fields this request changed, so two quick edits (a row button and
    // the detail screen, two tabs) never undo each other with stale values.
    const next = {
      title, summary, category, extracted_date, extracted_time, expiration_date, location, address,
      amount, phone, reservation_number, coupon_brand, coupon_product, source_url, original_content,
      status, do_today, reminder_date, reminder_enabled,
    };
    const columns = (Object.keys(next) as (keyof typeof next)[]).filter(
      (k) =>
        p[k] !== undefined ||
        ((k === "reminder_date" || k === "reminder_enabled") &&
          (reminder_date !== current.reminder_date || reminder_enabled !== current.reminder_enabled)),
    );
    const params: unknown[] = [current.id, context.userId, ...columns.map((k) => next[k])];
    const sets = columns.map((k, i) => `${k} = $${i + 3}`);
    if (columns.includes("status")) {
      const n = columns.indexOf("status") + 3;
      sets.push(
        `analysis_note = case when status = 'inbox' and $${n} <> 'inbox' then null else analysis_note end`,
        `analysis_error = case when status = 'inbox' and $${n} <> 'inbox' then null else analysis_error end`,
      );
    }
    sets.push("updated_at = now()");
    const sql = await getSql();
    await sql.query(`update items set ${sets.join(", ")} where id = $1 and user_id = $2`, params);
    const updated = await getItemRow(context.userId, current.id);
    if (!updated) throw new Error("항목을 찾을 수 없습니다.");
    return updated;
  });

export const deleteItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => String(id))
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql.query(`delete from items where id = $1 and user_id = $2`, [id, context.userId]);
    return { ok: true as const };
  });

/** Moves several items at once — one statement, so a dropped connection never applies half of it. */
export const setItemsStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { ids: string[]; status: Item["status"] }) => {
    const ids = Array.isArray(input?.ids) ? input.ids.map(String).slice(0, 200) : [];
    if (!isStatus(String(input?.status))) throw new Error("잘못된 요청입니다.");
    return { ids, status: input.status };
  })
  .handler(async ({ context, data }) => {
    if (data.ids.length) {
      const sql = await getSql();
      await sql.query(
        `update items set
          status = $3,
          do_today = case when $3 = 'active' then do_today else false end,
          analysis_note = case when status = 'inbox' and $3 <> 'inbox' then null else analysis_note end,
          analysis_error = case when status = 'inbox' and $3 <> 'inbox' then null else analysis_error end,
          updated_at = now()
        where user_id = $1 and id = any($2::text[])`,
        [context.userId, data.ids, data.status],
      );
    }
    return listRows(context.userId);
  });

/** Removes every example item ("예시 모두 지우기"). */
export const deleteSamples = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql.query(`delete from items where user_id = $1 and analysis_note = $2`, [context.userId, SAMPLE_NOTE]);
    return listRows(context.userId);
  });

/** Adds the six example items once: not while any are still around, whatever their state. */
export const seedSamples = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { today?: string }) => ({ today: todayOr(input?.today) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const existing = await sql.query<{ n: number }>(
      `select count(*)::int as n from items where user_id = $1 and (status = 'active' or analysis_note = $2)`,
      [context.userId, SAMPLE_NOTE],
    );
    if ((existing[0]?.n ?? 0) > 0) return listRows(context.userId);

    const samples = sampleItems(data.today);
    for (const [index, sample] of samples.entries()) {
      const reminder = reminderForSample(sample, data.today);
      await sql.query(
        `insert into items (
          id, user_id, original_type, original_content, image_data, image_mime, source_url,
          title, summary, category, extracted_date, extracted_time, expiration_date,
          location, address, amount, phone, coupon_brand, coupon_product,
          action_type, recommended_actions, confidence, analysis_status, analysis_note, status,
          reminder_date, reminder_enabled, created_at
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,'{}'::jsonb,
          'done',$22,'active',$23,$24, now() - ($25 || ' minutes')::interval
        )`,
        [
          crypto.randomUUID(),
          context.userId,
          sample.original_type,
          sample.original_content,
          sample.image?.base64 ?? null,
          sample.image?.mime ?? null,
          sample.source_url,
          sample.title,
          sample.summary,
          sample.category,
          sample.extracted_date,
          sample.extracted_time,
          sample.expiration_date,
          sample.location,
          sample.address,
          sample.amount,
          sample.phone,
          sample.coupon_brand,
          sample.coupon_product,
          sample.recommended_actions[0] ?? null,
          JSON.stringify(sample.recommended_actions),
          SAMPLE_NOTE,
          reminder.reminder_date,
          reminder.reminder_enabled,
          String(samples.length - index),
        ],
      );
    }
    return listRows(context.userId);
  });
