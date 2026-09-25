import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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

export function formatKoreanDate(dateISO: string | null | undefined): string | null {
  if (!dateISO) return null;
  const [y, m, d] = dateISO.split("-").map(Number);
  if (!y || !m || !d) return null;
  return `${y}년 ${m}월 ${d}일`;
}

export function formatShortDate(dateISO: string | null | undefined): string | null {
  if (!dateISO) return null;
  const [, m, d] = dateISO.split("-").map(Number);
  if (!m || !d) return null;
  return `${m}월 ${d}일`;
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
