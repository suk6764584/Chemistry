import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  analyzeWithAi,
  defaultReminder,
  fetchPageMeta,
  sanitizeHttpUrl,
} from "./ai";
import { reminderForSample, sampleItems } from "./samples";
import {
  isCategory,
  isStatus,
  type AnalysisStatus,
  type Category,
  type ConfidenceMap,
  type CreateItemInput,
  type Item,
  type ItemPatch,
  type ItemStatus,
  type OriginalType,
} from "./types";

const LIST_COLUMNS = `
  id, original_type, original_content, source_url, title, summary, category,
  extracted_date::text as extracted_date,
  extracted_time,
  expiration_date::text as expiration_date,
  location, address, amount, phone, reservation_number, coupon_brand, coupon_product,
  action_type, recommended_actions, confidence, analysis_status, analysis_error, status,
  reminder_date::text as reminder_date, reminder_enabled, do_today,
  created_at, updated_at,
  (image_data is not null) as has_image
`;

type ItemRow = Record<string, unknown>;

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function asDateStr(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value);
  return s.slice(0, 10) || null;
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

function mapItem(row: ItemRow): Item {
  const categoryRaw = String(row.category ?? "other");
  const statusRaw = String(row.status ?? "inbox");
  const analysisRaw = String(row.analysis_status ?? "pending");
  return {
    id: String(row.id),
    original_type: String(row.original_type) as OriginalType,
    original_content: row.original_content == null ? null : String(row.original_content),
    source_url: row.source_url == null ? null : String(row.source_url),
    title: row.title == null ? null : String(row.title),
    summary: row.summary == null ? null : String(row.summary),
    category: isCategory(categoryRaw) ? categoryRaw : "other",
    extracted_date: asDateStr(row.extracted_date),
    extracted_time: row.extracted_time == null ? null : String(row.extracted_time),
    expiration_date: asDateStr(row.expiration_date),
    location: row.location == null ? null : String(row.location),
    address: row.address == null ? null : String(row.address),
    amount: row.amount == null ? null : String(row.amount),
    phone: row.phone == null ? null : String(row.phone),
    reservation_number: row.reservation_number == null ? null : String(row.reservation_number),
    coupon_brand: row.coupon_brand == null ? null : String(row.coupon_brand),
    coupon_product: row.coupon_product == null ? null : String(row.coupon_product),
    action_type: row.action_type == null ? null : String(row.action_type),
    recommended_actions: parseJson<string[]>(row.recommended_actions, []),
    confidence: parseJson<ConfidenceMap>(row.confidence, {}),
    analysis_status: (["pending", "done", "failed"].includes(analysisRaw)
      ? analysisRaw
      : "pending") as AnalysisStatus,
    analysis_error: row.analysis_error == null ? null : String(row.analysis_error),
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

function fallbackTitle(input: CreateItemInput): string {
  if (input.source_url) {
    try {
      return new URL(input.source_url).hostname.replace(/^www\./, "");
    } catch {
      return input.source_url;
    }
  }
  if (input.original_content) {
    const line = input.original_content.trim().split("\n")[0] ?? "";
    return line.slice(0, 40) || "제목 없음";
  }
  if (input.original_type === "screenshot" || input.original_type === "image") return "이미지";
  return "새 항목";
}

export const listItems = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<ItemRow>(
      `select ${LIST_COLUMNS} from items where user_id = $1 order by created_at desc`,
      [context.userId],
    );
    return rows.map(mapItem);
  });

export const getItem = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    return getItemRow(context.userId, id);
  });

export const getItemImage = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
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

async function analyzeAndUpdate(userId: string, item: Item, image?: { base64: string; mime: string } | null) {
  const sql = await getSql();
  try {
    let pageMeta:
      | { title: string | null; description: string | null; excerpt: string | null; fetched: boolean }
      | undefined;
    const url = item.source_url ? sanitizeHttpUrl(item.source_url) : null;
    if (item.original_type === "url" && url) {
      pageMeta = await fetchPageMeta(url);
    }

    const imageDataUrl =
      image?.base64 && image.mime ? `data:${image.mime};base64,${image.base64}` : null;

    const extracted = await analyzeWithAi({
      originalType: item.original_type,
      text: item.original_content,
      sourceUrl: url ?? item.source_url,
      pageMeta,
      imageDataUrl,
    });

    const title =
      extracted.title ||
      (pageMeta?.fetched ? pageMeta.title : null) ||
      item.title ||
      fallbackTitle({
        original_type: item.original_type,
        original_content: item.original_content,
        source_url: item.source_url,
      });

    const reminder = defaultReminder(extracted.category, extracted.date, extracted.expiration_date);

    await sql.query(
      `update items set
        title = $3,
        summary = $4,
        category = $5,
        extracted_date = $6,
        extracted_time = $7,
        expiration_date = $8,
        location = $9,
        address = $10,
        amount = $11,
        phone = $12,
        reservation_number = $13,
        coupon_brand = $14,
        coupon_product = $15,
        recommended_actions = $16::jsonb,
        confidence = $17::jsonb,
        analysis_status = 'done',
        analysis_error = null,
        status = 'active',
        reminder_date = $18,
        reminder_enabled = $19,
        updated_at = now()
      where id = $1 and user_id = $2`,
      [
        item.id,
        userId,
        title,
        extracted.summary,
        extracted.category,
        extracted.date,
        extracted.time,
        extracted.expiration_date,
        extracted.location,
        extracted.address,
        extracted.amount,
        extracted.phone,
        extracted.reservation_number,
        extracted.coupon_brand,
        extracted.coupon_product,
        JSON.stringify(extracted.recommended_actions),
        JSON.stringify(extracted.confidence),
        reminder.reminder_date,
        reminder.reminder_enabled,
      ],
    );
  } catch (err) {
    const code = err instanceof Error ? err.message : "AI_ERROR";
    let message = "정보를 정확하게 읽지 못했습니다. 직접 입력해 주세요.";
    if (code === "AI_UNAVAILABLE") {
      message = "지금은 자동 분석을 사용할 수 없습니다. 직접 입력해 주세요.";
    }
    await sql.query(
      `update items set
        analysis_status = 'failed',
        analysis_error = $3,
        updated_at = now()
      where id = $1 and user_id = $2`,
      [item.id, userId, message],
    );
  }
  return getItemRow(userId, item.id);
}

export const createItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: CreateItemInput) => input)
  .handler(async ({ context, data }) => {
    const originalType = data.original_type;
    if (!["image", "screenshot", "url", "text"].includes(originalType)) {
      throw new Error("지원하지 않는 입력입니다.");
    }

    let sourceUrl = data.source_url?.trim() || null;
    if (originalType === "url") {
      const raw = sourceUrl || data.original_content?.trim() || "";
      const clean = sanitizeHttpUrl(raw);
      if (!clean) throw new Error("올바른 링크를 입력해 주세요.");
      sourceUrl = clean;
    }

    const originalContent =
      originalType === "url" ? sourceUrl : data.original_content?.trim() || null;

    if (originalType === "text" && !originalContent) {
      throw new Error("내용을 입력해 주세요.");
    }
    if ((originalType === "image" || originalType === "screenshot") && !data.image_base64) {
      throw new Error("이미지를 선택해 주세요.");
    }
    if (data.image_base64 && data.image_base64.length > 1_800_000) {
      throw new Error("이미지가 너무 큽니다.");
    }

    const id = crypto.randomUUID();
    const sql = await getSql();
    const title = fallbackTitle({
      original_type: originalType,
      original_content: originalContent,
      source_url: sourceUrl,
    });

    await sql.query(
      `insert into items (
        id, user_id, original_type, original_content, image_data, image_mime, source_url,
        title, category, status, analysis_status
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,'other','inbox','pending')`,
      [
        id,
        context.userId,
        originalType,
        originalContent,
        data.image_base64 ?? null,
        data.image_mime ?? null,
        sourceUrl,
        title,
      ],
    );

    const created = await getItemRow(context.userId, id);
    if (!created) throw new Error("항목을 저장하지 못했습니다.");

    const image =
      data.image_base64 && data.image_mime
        ? { base64: data.image_base64, mime: data.image_mime }
        : null;
    const analyzed = await analyzeAndUpdate(context.userId, created, image);
    return analyzed ?? created;
  });

export const updateItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; patch: ItemPatch }) => input)
  .handler(async ({ context, data }) => {
    const current = await getItemRow(context.userId, data.id);
    if (!current) throw new Error("항목을 찾을 수 없습니다.");

    const p = data.patch;
    const title = p.title !== undefined ? p.title : current.title;
    const summary = p.summary !== undefined ? p.summary : current.summary;
    const category: Category =
      p.category !== undefined && isCategory(p.category) ? p.category : current.category;
    const extracted_date = p.extracted_date !== undefined ? p.extracted_date : current.extracted_date;
    const extracted_time = p.extracted_time !== undefined ? p.extracted_time : current.extracted_time;
    const expiration_date = p.expiration_date !== undefined ? p.expiration_date : current.expiration_date;
    const location = p.location !== undefined ? p.location : current.location;
    const address = p.address !== undefined ? p.address : current.address;
    const amount = p.amount !== undefined ? p.amount : current.amount;
    const phone = p.phone !== undefined ? p.phone : current.phone;
    const reservation_number =
      p.reservation_number !== undefined ? p.reservation_number : current.reservation_number;
    const coupon_brand = p.coupon_brand !== undefined ? p.coupon_brand : current.coupon_brand;
    const coupon_product = p.coupon_product !== undefined ? p.coupon_product : current.coupon_product;
    const source_url = p.source_url !== undefined ? p.source_url : current.source_url;
    const original_content = p.original_content !== undefined ? p.original_content : current.original_content;
    let status: ItemStatus = p.status !== undefined && isStatus(p.status) ? p.status : current.status;
    if (status === "inbox" && current.analysis_status === "failed" && title) {
      status = "active";
    }
    if (current.status === "inbox" && p.category) status = "active";
    const reminder_date = p.reminder_date !== undefined ? p.reminder_date : current.reminder_date;
    const reminder_enabled =
      p.reminder_enabled !== undefined ? p.reminder_enabled : current.reminder_enabled;
    const do_today = p.do_today !== undefined ? p.do_today : current.do_today;

    const sql = await getSql();
    await sql.query(
      `update items set
        title = $3, summary = $4, category = $5,
        extracted_date = $6, extracted_time = $7, expiration_date = $8,
        location = $9, address = $10, amount = $11, phone = $12,
        reservation_number = $13, coupon_brand = $14, coupon_product = $15,
        source_url = $16, original_content = $17, status = $18,
        reminder_date = $19, reminder_enabled = $20, do_today = $21,
        updated_at = now()
      where id = $1 and user_id = $2`,
      [
        data.id,
        context.userId,
        title,
        summary,
        category,
        extracted_date,
        extracted_time,
        expiration_date,
        location,
        address,
        amount,
        phone,
        reservation_number,
        coupon_brand,
        coupon_product,
        source_url,
        original_content,
        status,
        reminder_date,
        reminder_enabled,
        do_today,
      ],
    );
    const updated = await getItemRow(context.userId, data.id);
    if (!updated) throw new Error("항목을 찾을 수 없습니다.");
    return updated;
  });

export const deleteItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql.query(`delete from items where id = $1 and user_id = $2`, [id, context.userId]);
    return { ok: true as const };
  });

export const seedSamples = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const existing = await sql.query<{ n: number }>(
      `select count(*)::int as n from items where user_id = $1`,
      [context.userId],
    );
    if ((existing[0]?.n ?? 0) > 0) {
      const rows = await sql.query<ItemRow>(
        `select ${LIST_COLUMNS} from items where user_id = $1 order by created_at desc`,
        [context.userId],
      );
      return rows.map(mapItem);
    }

    for (const sample of sampleItems()) {
      const id = crypto.randomUUID();
      const reminder = reminderForSample(sample);
      await sql.query(
        `insert into items (
          id, user_id, original_type, original_content, image_data, image_mime, source_url,
          title, summary, category, extracted_date, extracted_time, expiration_date,
          location, address, amount, phone, coupon_brand, coupon_product,
          recommended_actions, confidence, analysis_status, status,
          reminder_date, reminder_enabled
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21::jsonb,
          'done','active',$22,$23
        )`,
        [
          id,
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
          JSON.stringify(sample.recommended_actions),
          JSON.stringify({}),
          reminder.reminder_date,
          reminder.reminder_enabled,
        ],
      );
    }

    const rows = await sql.query<ItemRow>(
      `select ${LIST_COLUMNS} from items where user_id = $1 order by created_at desc`,
      [context.userId],
    );
    return rows.map(mapItem);
  });

export const reanalyzeItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const current = await getItemRow(context.userId, id);
    if (!current) throw new Error("항목을 찾을 수 없습니다.");
    const sql = await getSql();
    await sql.query(
      `update items set analysis_status = 'pending', analysis_error = null, updated_at = now()
       where id = $1 and user_id = $2`,
      [id, context.userId],
    );
    const img = await sql.query<{ image_data: string | null; image_mime: string | null }>(
      `select image_data, image_mime from items where id = $1 and user_id = $2 limit 1`,
      [id, context.userId],
    );
    const image = img[0]?.image_data
      ? { base64: img[0].image_data, mime: img[0].image_mime || "image/jpeg" }
      : null;
    const pending = { ...current, analysis_status: "pending" as const };
    return analyzeAndUpdate(context.userId, pending, image);
  });
