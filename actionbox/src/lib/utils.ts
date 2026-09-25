import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the design tokens from styles.css; otherwise it reads
// `text-body` as a color and silently drops the real color class next to it.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["micro", "small", "body", "title", "display"],
      shadow: ["card", "float", "focus"],
      radius: ["seg"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return todayISO(dt);
}

export function daysUntil(dateISO: string | null | undefined, now = new Date()): number | null {
  if (!dateISO) return null;
  const [y, m, d] = dateISO.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function formatShortDate(dateISO: string | null | undefined): string | null {
  if (!dateISO) return null;
  const [, m, d] = dateISO.split("-").map(Number);
  if (!m || !d) return null;
  return `${m}월 ${d}일`;
}

/** "10.8" — for dense list rows. */
export function formatCompactDate(dateISO: string | null | undefined): string | null {
  if (!dateISO) return null;
  const [, m, d] = dateISO.split("-").map(Number);
  return m && d ? `${m}.${d}` : null;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "10월 18일 (토)" */
export function formatDateWithWeekday(dateISO: string | null | undefined): string | null {
  const short = formatShortDate(dateISO);
  if (!short || !dateISO) return null;
  const [y, m, d] = dateISO.split("-").map(Number);
  return `${short} (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}

/** "9월 25일 오후 6:30" in the viewer's time zone. */
export function formatTimestamp(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  const h = dt.getHours();
  const period = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일 ${period} ${h12}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

/** RFC 4122 v4 id. `crypto.randomUUID` only exists in secure contexts, so fall back to getRandomValues. */
export function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function formatDday(dateISO: string | null | undefined): string | null {
  const n = daysUntil(dateISO);
  if (n === null) return null;
  if (n === 0) return "D-Day";
  if (n > 0) return `D-${n}`;
  return `D+${Math.abs(n)}`;
}

export function isUnauthorized(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; message?: string };
  return e.status === 401 || e.message === "Unauthorized";
}
