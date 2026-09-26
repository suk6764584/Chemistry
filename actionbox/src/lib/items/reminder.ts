import { addDaysISO, daysUntil, todayISO } from "@/lib/utils";
import { keyDate, type Category, type Item } from "./types";

/** Quick choices relative to the item's key date (expiration or event date). */
export const REMINDER_PRESETS = [
  { days: 0, label: "당일" },
  { days: 1, label: "하루 전" },
  { days: 3, label: "3일 전" },
  { days: 7, label: "7일 전" },
] as const;

/**
 * Default policy: coupons 7 days before expiry; anything else with a date the day before.
 * Items without a date get no reminder.
 */
function defaultReminderOffset(category: Category): number {
  return category === "coupon" ? 7 : 1;
}

/**
 * The reminder day for a key date: `offset` days before it, moved closer when that day
 * has already passed (7일 전 → 3일 전 → 하루 전 → 당일). Null when the date itself is past.
 */
export function reminderDateFor(key: string, offset: number, today: string = todayISO()): string | null {
  if (key < today) return null;
  for (const days of [offset, ...REMINDER_PRESETS.map((p) => p.days).filter((d) => d < offset).reverse()]) {
    const date = addDaysISO(key, -days);
    if (date >= today) return date;
  }
  return today;
}

export function defaultReminder(
  category: Category,
  eventDate: string | null,
  expiration: string | null,
  today?: string,
): { reminder_date: string | null; reminder_enabled: boolean } {
  const base = keyDate({ expiration_date: expiration, extracted_date: eventDate });
  const date = base ? reminderDateFor(base, defaultReminderOffset(category), today) : null;
  if (!date) return { reminder_date: null, reminder_enabled: false };
  return { reminder_date: date, reminder_enabled: true };
}

/** Patch that turns the reminder on with the default offset, or null when the item has no date. */
export function reminderOnPatch(
  item: Pick<Item, "category" | "expiration_date" | "extracted_date">,
): { reminder_enabled: true; reminder_date: string } | null {
  const key = keyDate(item);
  if (!key) return null;
  return { reminder_enabled: true, reminder_date: reminderDateFor(key, defaultReminderOffset(item.category)) ?? key };
}

/** Days between the reminder and the key date, when the reminder matches a preset. */
export function reminderPreset(
  item: Pick<Item, "reminder_enabled" | "reminder_date" | "expiration_date" | "extracted_date">,
): number | "custom" | null {
  if (!item.reminder_enabled || !item.reminder_date) return null;
  const key = keyDate(item);
  if (!key) return "custom";
  const reminderIn = daysUntil(item.reminder_date);
  const keyIn = daysUntil(key);
  if (reminderIn === null || keyIn === null) return "custom";
  const diff = keyIn - reminderIn;
  return REMINDER_PRESETS.some((p) => p.days === diff) ? diff : "custom";
}

export function isReminderDue(item: Pick<Item, "reminder_enabled" | "reminder_date">): boolean {
  if (!item.reminder_enabled || !item.reminder_date) return false;
  const n = daysUntil(item.reminder_date);
  return n !== null && n <= 0;
}
