import { addDaysISO, formatShortDate, todayISO } from "@/lib/utils";
import { CATEGORY_LABELS, type Category, type Item } from "./types";

/**
 * Rule-based search: date and type words in the query become metadata filters,
 * the rest is plain text matching. No AI and no embeddings — the UI shows the
 * filters it derived so the user can see exactly what was searched.
 */

export type DateField = "any" | "created" | "expiration" | "event";

export type SearchFilters = {
  terms: string[];
  categories: Category[];
  dateFrom: string | null;
  dateTo: string | null;
  dateField: DateField;
  /** The type words themselves ("카페"): an item whose text says it counts too, whatever its type. */
  hintWords: string[];
};

const CATEGORY_HINTS: { re: RegExp; categories: Category[] }[] = [
  { re: /쿠폰|기프티콘|상품권|교환권/g, categories: ["coupon"] },
  { re: /맛집|식당|카페|가게|장소|가볼\s?곳/g, categories: ["place"] },
  { re: /행사|일정|박람회|공연|전시|모임|예약/g, categories: ["event"] },
  { re: /할\s?일|검사|신청|납부/g, categories: ["todo"] },
  { re: /블로그|아티클|기사|읽을\s?거리/g, categories: ["read"] },
  { re: /구매|쇼핑|상품|살\s?것|위시/g, categories: ["buy"] },
  { re: /자료|문서|참고|개발/g, categories: ["read", "reference"] },
];

const STOPWORDS = new Set([
  "내가", "제가", "나의", "내", "저장한", "저장했던", "올린", "등록한", "끝나는", "만료되는", "만료",
  "마감", "까지", "관련", "관련해서", "관련된", "것", "거", "들", "좀", "찾아줘", "보여줘", "있는",
  "했던", "에", "에서", "의", "을", "를", "은", "는", "이", "가", "중", "전부", "모두",
]);

function monthRange(year: number, monthIndex: number): { from: string; to: string } {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const mm = String(monthIndex + 1).padStart(2, "0");
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

function weekRange(now: Date, weeksAhead: number): { from: string; to: string } {
  const fromMonday = (now.getDay() + 6) % 7;
  const start = addDaysISO(todayISO(now), -fromMonday + weeksAhead * 7);
  return { from: start, to: addDaysISO(start, 6) };
}

export function parseSearchQuery(raw: string, now = new Date()): SearchFilters {
  let text = ` ${raw.trim()} `;
  let dateFrom: string | null = null;
  let dateTo: string | null = null;
  let dateField: DateField = "any";

  if (/끝나|만료|마감|까지/.test(text)) dateField = "expiration";
  else if (/저장|올린|등록/.test(text)) dateField = "created";
  else if (/행사|일정|예약|공연|전시/.test(text)) dateField = "event";

  const categories = new Set<Category>();
  const hintWords: string[] = [];
  for (const hint of CATEGORY_HINTS) {
    if (hint.re.test(text)) {
      hint.categories.forEach((c) => categories.add(c));
      hintWords.push(...(text.match(hint.re) ?? []).map((w) => w.replace(/\s/g, "")));
      text = text.replace(hint.re, " ");
    }
    hint.re.lastIndex = 0;
  }

  const setRange = (range: { from: string; to: string }, pattern: RegExp) => {
    dateFrom = range.from;
    dateTo = range.to;
    text = text.replace(pattern, " ");
  };
  const today = todayISO(now);
  if (/오늘/.test(text)) setRange({ from: today, to: today }, /오늘/g);
  else if (/내일/.test(text)) setRange({ from: addDaysISO(today, 1), to: addDaysISO(today, 1) }, /내일/g);
  else if (/지난\s?주/.test(text)) setRange(weekRange(now, -1), /지난\s?주/g);
  else if (/이번\s?주/.test(text)) setRange(weekRange(now, 0), /이번\s?주/g);
  else if (/다음\s?주/.test(text)) setRange(weekRange(now, 1), /다음\s?주/g);
  else if (/지난\s?달/.test(text)) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    setRange(monthRange(prev.getFullYear(), prev.getMonth()), /지난\s?달/g);
  } else if (/이번\s?달/.test(text)) setRange(monthRange(now.getFullYear(), now.getMonth()), /이번\s?달/g);
  else if (/다음\s?달/.test(text)) {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    setRange(monthRange(next.getFullYear(), next.getMonth()), /다음\s?달/g);
  } else {
    const monthMatch = text.match(/(\d{1,2})\s?월/);
    const month = monthMatch ? Number(monthMatch[1]) : 0;
    if (month >= 1 && month <= 12) {
      // A month more than half a year back most likely means next year's.
      const year = month < now.getMonth() + 1 - 6 ? now.getFullYear() + 1 : now.getFullYear();
      setRange(monthRange(year, month - 1), /(\d{1,2})\s?월/g);
    }
  }

  const terms = text
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t && !STOPWORDS.has(t));

  return { terms, categories: [...categories], dateFrom, dateTo, dateField, hintWords };
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
    item.coupon_code,
    item.reservation_number,
    item.phone,
    item.amount,
    CATEGORY_LABELS[item.category],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** A trailing particle ("서울의", "자동차가") should not block a match. */
function termMatches(hay: string, term: string): boolean {
  if (hay.includes(term)) return true;
  return term.length > 2 && /[은는이가을를에의도]$/.test(term) && hay.includes(term.slice(0, -1));
}

const STATUS_RANK = { active: 0, inbox: 1, completed: 2, archived: 3 } as const;

export function filterItems(items: Item[], filters: SearchFilters, categoryOverride: Category | "all"): Item[] {
  const categories = categoryOverride !== "all" ? [categoryOverride] : filters.categories;
  const hasDate = Boolean(filters.dateFrom || filters.dateTo);

  return items
    .filter((item) => {
      if (categories.length && !categories.includes(item.category)) {
        const hay = categoryOverride === "all" ? haystack(item).replace(/\s/g, "") : "";
        if (!filters.hintWords.some((w) => hay.includes(w))) return false;
      }
      if (hasDate) {
        const created = todayISO(new Date(item.created_at));
        const { dateFrom: from, dateTo: to } = filters;
        const ok =
          filters.dateField === "created"
            ? inRange(created, from, to)
            : filters.dateField === "expiration"
              ? inRange(item.expiration_date, from, to)
              : filters.dateField === "event"
                ? inRange(item.extracted_date, from, to)
                : inRange(created, from, to) ||
                  inRange(item.extracted_date, from, to) ||
                  inRange(item.expiration_date, from, to);
        if (!ok) return false;
      }
      if (filters.terms.length) {
        const hay = haystack(item);
        if (!filters.terms.every((t) => termMatches(hay, t))) return false;
      }
      return true;
    })
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || (a.created_at < b.created_at ? 1 : -1));
}

const DATE_FIELD_LABELS: Record<DateField, string> = {
  any: "",
  created: "저장일",
  expiration: "만료·마감일",
  event: "일정 날짜",
};

/** Human-readable description of what the query was turned into. */
export function describeFilters(filters: SearchFilters): { key: string; label: string }[] {
  const chips: { key: string; label: string }[] = [];
  if (filters.categories.length) {
    const words = filters.hintWords.length ? ` 또는 '${[...new Set(filters.hintWords)].join("·")}' 포함` : "";
    chips.push({ key: "category", label: `유형 ${filters.categories.map((c) => CATEGORY_LABELS[c]).join("·")}${words}` });
  }
  if (filters.dateFrom || filters.dateTo) {
    const from = formatShortDate(filters.dateFrom);
    const to = formatShortDate(filters.dateTo);
    const range = from === to ? from : `${from}~${to}`;
    const field = DATE_FIELD_LABELS[filters.dateField];
    chips.push({ key: "date", label: field ? `${field} ${range}` : range ?? "" });
  }
  if (filters.terms.length) chips.push({ key: "terms", label: `단어 ${filters.terms.join(", ")}` });
  return chips;
}
