export const CATEGORIES = [
  "event",
  "place",
  "todo",
  "coupon",
  "buy",
  "read",
  "reference",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  event: "일정",
  place: "장소",
  todo: "할 일",
  coupon: "쿠폰/마감",
  buy: "구매 후보",
  read: "읽을거리",
  reference: "참고자료",
  other: "기타",
};

export const ORIGINAL_TYPES = ["image", "screenshot", "url", "text"] as const;
export type OriginalType = (typeof ORIGINAL_TYPES)[number];

export const STATUSES = ["inbox", "active", "completed", "archived"] as const;
export type ItemStatus = (typeof STATUSES)[number];

export const ANALYSIS_STATUSES = ["pending", "done", "failed"] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

/**
 * Actions the AI may recommend. Only codes the app can actually perform —
 * the model picks from this list, so every recommended button works.
 */
export const ACTION_CODES = [
  "calendar",
  "remind",
  "map",
  "call",
  "open",
  "visit",
  "today",
  "complete",
  "archive",
] as const;
export type ActionCode = (typeof ACTION_CODES)[number];

export type ConfidenceMap = {
  category?: number | null;
  date?: number | null;
  time?: number | null;
  expiration_date?: number | null;
  location?: number | null;
  address?: number | null;
  phone?: number | null;
};

export type Item = {
  id: string;
  original_type: OriginalType;
  original_content: string | null;
  source_url: string | null;
  title: string | null;
  summary: string | null;
  category: Category;
  extracted_date: string | null;
  extracted_time: string | null;
  expiration_date: string | null;
  location: string | null;
  address: string | null;
  amount: string | null;
  phone: string | null;
  reservation_number: string | null;
  coupon_brand: string | null;
  coupon_product: string | null;
  action_type: ActionCode | null;
  recommended_actions: ActionCode[];
  confidence: ConfidenceMap;
  analysis_status: AnalysisStatus;
  analysis_error: string | null;
  /** User-facing note from analysis (what to check), or null. */
  analysis_note: string | null;
  status: ItemStatus;
  reminder_date: string | null;
  reminder_enabled: boolean;
  do_today: boolean;
  has_image: boolean;
  created_at: string;
  updated_at: string;
};

export type ItemPatch = Partial<
  Pick<
    Item,
    | "title"
    | "summary"
    | "category"
    | "extracted_date"
    | "extracted_time"
    | "expiration_date"
    | "location"
    | "address"
    | "amount"
    | "phone"
    | "reservation_number"
    | "coupon_brand"
    | "coupon_product"
    | "source_url"
    | "original_content"
    | "status"
    | "reminder_date"
    | "reminder_enabled"
    | "do_today"
  >
>;

export type AiExtraction = {
  title: string | null;
  summary: string | null;
  category: Category;
  date: string | null;
  time: string | null;
  expiration_date: string | null;
  location: string | null;
  address: string | null;
  amount: string | null;
  phone: string | null;
  reservation_number: string | null;
  coupon_brand: string | null;
  coupon_product: string | null;
  url: string | null;
  recommended_actions: ActionCode[];
  confidence: ConfidenceMap;
  /** Field labels whose value was dropped for low confidence. */
  uncertain: string[];
};

export type CreateItemInput = {
  /** Client-generated UUID so a retried save never creates a duplicate. */
  id: string;
  original_type: OriginalType;
  original_content?: string | null;
  source_url?: string | null;
  image_base64?: string | null;
  image_mime?: string | null;
};

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function isStatus(value: string): value is ItemStatus {
  return (STATUSES as readonly string[]).includes(value);
}

export function isActionCode(value: string): value is ActionCode {
  return (ACTION_CODES as readonly string[]).includes(value);
}

/** Note shown on the example items so they are never mistaken for AI output. */
export const SAMPLE_NOTE = "예시 항목이에요. AI 분석 없이 미리 채워 둔 값입니다.";

/** Why analysis did not run when no AI is configured — a normal state, not a failure. */
export const AI_OFF_ERROR = "지금은 자동 분석을 사용할 수 없어요. 직접 입력해 주세요.";
export const AI_OFF_FOUND_ERROR = "자동 분석을 쓸 수 없어 메모에서 날짜만 찾았어요. 맞는지 확인해 주세요.";

export function isAiOff(item: Pick<Item, "analysis_status" | "analysis_error">): boolean {
  return item.analysis_status === "failed" && (item.analysis_error === AI_OFF_ERROR || item.analysis_error === AI_OFF_FOUND_ERROR);
}

/** The date that drives D-day: expiration for deadlines, otherwise the event date. */
export function keyDate(item: Pick<Item, "expiration_date" | "extracted_date">): string | null {
  return item.expiration_date || item.extracted_date || null;
}
