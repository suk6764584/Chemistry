import { addDaysISO, daysUntil } from "@/lib/utils";
import { keyDate, type Category, type Item } from "./types";

/** Quick choices relative to the item's key date (expiration or event date). */
export const REMINDER_PRESETS = [
  { days: 0, label: "당일" },
  { days: 1, label: "하루 전" },
  { days: 3, label: "3일 전" },
  { days: 7, label: "7일 전" },
] as const;

/**
 * Default policy: coupons 7 days before expiry, events the day before.
 * Everything else (reading, shopping, places, todos) gets no reminder.
 */
function defaultReminderOffset(category: Category): number | null {
  if (category === "coupon") return 7;
  if (category === "event") return 1;
  return null;
}

export function defaultReminder(
  category: Category,
  eventDate: string | null,
  expiration: string | null,
): { reminder_date: string | null; reminder_enabled: boolean } {
  const offset = defaultReminderOffset(category);
  const base = category === "coupon" ? expiration : category === "event" ? eventDate : null;
  if (offset == null || !base) return { reminder_date: null, reminder_enabled: false };
  return { reminder_date: addDaysISO(base, -offset), reminder_enabled: true };
}

/** Patch that turns the reminder on with the default offset, or null when the item has no date. */
export function reminderOnPatch(
  item: Pick<Item, "category" | "expiration_date" | "extracted_date">,
): { reminder_enabled: true; reminder_date: string } | null {
  const key = keyDate(item);
  if (!key) return null;
  const offset = defaultReminderOffset(item.category) ?? 1;
  return { reminder_enabled: true, reminder_date: addDaysISO(key, -offset) };
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
