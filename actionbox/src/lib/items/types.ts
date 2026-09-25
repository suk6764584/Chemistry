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

export type ConfidenceMap = {
  date?: number | null;
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
  action_type: string | null;
  recommended_actions: string[];
  confidence: ConfidenceMap;
  analysis_status: AnalysisStatus;
  analysis_error: string | null;
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
  recommended_actions: string[];
  confidence: ConfidenceMap;
};

export type CreateItemInput = {
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

export function relevantDate(item: Pick<Item, "expiration_date" | "extracted_date" | "reminder_date">): string | null {
  return item.expiration_date || item.extracted_date || item.reminder_date || null;
}
