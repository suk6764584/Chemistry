import { addDaysISO, todayISO } from "@/lib/utils";
import { CATEGORY_LABELS, isCategory, type Category, type Item } from "./types";

export type SearchFilters = {
  text: string;
  category: Category | null;
  dateFrom: string | null;
  dateTo: string | null;
  dateField: "any" | "created" | "expiration" | "event";
};

const CATEGORY_HINTS: { re: RegExp; category: Category }[] = [
  { re: /쿠폰|기프티콘|마감/, category: "coupon" },
  { re: /맛집|식당|카페|장소/, category: "place" },
  { re: /행사|일정|박람회|공연/, category: "event" },
  { re: /할\s?일|검사|예약/, category: "todo" },
  { re: /읽을|블로그|아티클|문서/, category: "read" },
  { re: /구매|쇼핑|상품|위시/, category: "buy" },
  { re: /참고|자료|개발/, category: "reference" },
];

function monthRange(year: number, monthIndex: number): { from: string; to: string } {
  const from = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const to = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

export function parseSearchQuery(raw: string): SearchFilters {
  let text = raw.trim();
  const now = new Date();
  let category: Category | null = null;
  let dateFrom: string | null = null;
  let dateTo: string | null = null;
  let dateField: SearchFilters["dateField"] = "any";

  if (/끝나는|만료|까지/.test(text)) dateField = "expiration";
  else if (/저장한|올린|등록/.test(text)) dateField = "created";
  else if (/행사|일정/.test(text)) dateField = "event";

  for (const hint of CATEGORY_HINTS) {
    if (hint.re.test(text)) {
      category = hint.category;
      text = text.replace(hint.re, " ");
      break;
    }
  }

  if (/지난달/.test(text)) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const range = monthRange(prev.getFullYear(), prev.getMonth());
    dateFrom = range.from;
    dateTo = range.to;
    if (dateField === "any") dateField = "created";
    text = text.replace(/지난달/g, " ");
  } else if (/이번\s?달/.test(text)) {
    const range = monthRange(now.getFullYear(), now.getMonth());
    dateFrom = range.from;
    dateTo = range.to;
    text = text.replace(/이번\s?달/g, " ");
  } else if (/다음\s?주/.test(text)) {
    const day = now.getDay();
    const toMonday = ((8 - day) % 7) || 7;
    const start = addDaysISO(todayISO(now), toMonday);
    dateFrom = start;
    dateTo = addDaysISO(start, 6);
    if (dateField === "any") dateField = "event";
    text = text.replace(/다음\s?주/g, " ");
  } else if (/이번\s?주/.test(text)) {
    const day = now.getDay();
    const fromMonday = day === 0 ? 6 : day - 1;
    const start = addDaysISO(todayISO(now), -fromMonday);
    dateFrom = start;
    dateTo = addDaysISO(start, 6);
    text = text.replace(/이번\s?주/g, " ");
  } else {
    const monthMatch = text.match(/(\d{1,2})월/);
    if (monthMatch) {
      const month = Number(monthMatch[1]);
      if (month >= 1 && month <= 12) {
        const year = month < now.getMonth() + 1 - 6 ? now.getFullYear() + 1 : now.getFullYear();
        const range = monthRange(year, month - 1);
        dateFrom = range.from;
        dateTo = range.to;
        text = text.replace(/(\d{1,2})월/g, " ");
      }
    }
  }

  text = text.replace(/저장한|올린|등록한|끝나는|만료|까지|관련해서|관련/g, " ");
  text = text.replace(/\s+/g, " ").trim();

  return { text, category, dateFrom, dateTo, dateField };
}

function inRange(date: string | null, from: string | null, to: string | null): boolean {
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function haystack(item: Item): string {
  return [
    item.title,
    item.summary,
    item.location,
    item.address,
    item.original_content,
    item.source_url,
    item.coupon_brand,
    item.coupon_product,
    item.phone,
    item.amount,
    CATEGORY_LABELS[item.category],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterItems(items: Item[], filters: SearchFilters, categoryOverride?: Category | "all"): Item[] {
  const category = categoryOverride && categoryOverride !== "all" ? categoryOverride : filters.category;

  return items.filter((item) => {
    if (item.status === "completed" || item.status === "archived") return false;
    if (category && item.category !== category) return false;

    if (filters.dateFrom || filters.dateTo) {
      const created = item.created_at.slice(0, 10);
      const eventDate = item.extracted_date;
      const exp = item.expiration_date;
      let ok = false;
      if (filters.dateField === "created") ok = inRange(created, filters.dateFrom, filters.dateTo);
      else if (filters.dateField === "expiration") ok = inRange(exp, filters.dateFrom, filters.dateTo);
      else if (filters.dateField === "event") ok = inRange(eventDate, filters.dateFrom, filters.dateTo);
      else {
        ok =
          inRange(created, filters.dateFrom, filters.dateTo) ||
          inRange(eventDate, filters.dateFrom, filters.dateTo) ||
          inRange(exp, filters.dateFrom, filters.dateTo);
      }
      if (!ok) return false;
    }

    if (filters.text) {
      const tokens = filters.text.toLowerCase().split(/\s+/).filter(Boolean);
      const hay = haystack(item);
      if (!tokens.every((t) => hay.includes(t))) return false;
    }

    return true;
  });
}

export function categoryFromLabel(label: string): Category | "all" {
  if (label === "all" || label === "전체") return "all";
  if (isCategory(label)) return label;
  const found = (Object.entries(CATEGORY_LABELS) as [Category, string][]).find(([, v]) => v === label);
  return found?.[0] ?? "all";
}
