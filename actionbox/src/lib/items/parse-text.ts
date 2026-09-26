/**
 * Rule-based reading of common Korean date, time and amount phrases in a memo
 * ("10월 2일 오후 3시", "내일 저녁 8시", "25만원"). Used to prefill the manual
 * form so the user doesn't type what they already wrote. No AI involved.
 */
export type TextFacts = { date: string | null; time: string | null; amount: string | null };

const pad = (n: number) => String(n).padStart(2, "0");

// Local copies of the utils date helpers keep this file dependency-free for `node --test`.
function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return todayISO(new Date(y, m - 1, d + days));
}

function validDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** A month/day without a year: this year, or next year when it is more than a month past. */
function withYear(m: number, d: number, today: string): string | null {
  const year = Number(today.slice(0, 4));
  const date = validDate(year, m, d);
  if (!date) return null;
  return date < addDaysISO(today, -31) ? validDate(year + 1, m, d) : date;
}

export function parseDate(text: string, today: string = todayISO()): string | null {
  let m = text.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (m) return validDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (m) return withYear(Number(m[1]), Number(m[2]), today);
  m = text.match(/(?<![\d.])(\d{1,2})[./](\d{1,2})(?![\d./])/);
  if (m) return withYear(Number(m[1]), Number(m[2]), today);
  const wd = text.match(/(이번\s*주|다음\s*주|담주)?\s*([월화수목금토일])요일/);
  if (wd) {
    // "금요일" is the coming one (today counts); "다음주 금요일" is in next week (weeks start Monday).
    const [y, mo, d] = today.split("-").map(Number);
    const todayDow = new Date(y, mo - 1, d).getDay();
    const target = "일월화수목금토".indexOf(wd[2]);
    if (wd[1] && /다음|담/.test(wd[1])) {
      const mondayOffset = (todayDow + 6) % 7;
      return addDaysISO(today, 7 - mondayOffset + ((target + 6) % 7));
    }
    return addDaysISO(today, (target - todayDow + 7) % 7);
  }
  if (/모레/.test(text)) return addDaysISO(today, 2);
  if (/내일/.test(text)) return addDaysISO(today, 1);
  if (/오늘/.test(text)) return today;
  return null;
}

export function parseTime(text: string): string | null {
  let m = text.match(/(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/);
  if (m) return `${pad(Number(m[1]))}:${m[2]}`;
  m = text.match(
    /(오전|오후|아침|낮|저녁|밤|새벽)?\s*(\d{1,2})\s*시(?!간)(?:\s*(반|(\d{1,2})\s*분))?/,
  );
  if (!m) return null;
  let h = Number(m[2]);
  const min = m[3] === "반" ? 30 : m[4] ? Number(m[4]) : 0;
  if (h > 24 || min > 59) return null;
  const period = m[1];
  if ((period === "오후" || period === "저녁" || period === "밤") && h < 12) h += 12;
  else if ((period === "낮" || !period) && h >= 1 && h <= 7)
    h += 12; // "3시" usually means the afternoon
  else if ((period === "오전" || period === "아침" || period === "새벽") && h === 12) h = 0;
  if (h === 24) h = 0;
  return `${pad(h)}:${pad(min)}`;
}

export function parseAmount(text: string): string | null {
  const m = text.match(/(?<![\d,])(?=\d)(?:(\d+)\s*만)?\s*(?:(\d)\s*천)?\s*([\d,]+)?\s*원/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  const won =
    Number(m[1] ?? 0) * 10_000 +
    Number(m[2] ?? 0) * 1_000 +
    Number((m[3] ?? "0").replace(/,/g, ""));
  return won > 0 ? `${won.toLocaleString("ko-KR")}원` : null;
}

export function parseTextFacts(text: string | null | undefined, today?: string): TextFacts {
  if (!text) return { date: null, time: null, amount: null };
  return { date: parseDate(text, today), time: parseTime(text), amount: parseAmount(text) };
}
