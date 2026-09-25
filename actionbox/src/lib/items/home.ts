import { daysUntil } from "@/lib/utils";
import type { Item } from "./types";

export type HomeSection = "now" | "expiring" | "later";

function dueDays(item: Item): number | null {
  return daysUntil(item.expiration_date || item.extracted_date);
}

/** Active items only. Completed / inbox / archived are excluded. */
export function homeSection(item: Item): HomeSection {
  const days = dueDays(item);
  const reminderDue =
    item.reminder_enabled &&
    item.reminder_date != null &&
    (daysUntil(item.reminder_date) ?? 1) <= 0;

  if (item.do_today || reminderDue) return "now";
  if (item.category === "todo" && (days === null || days <= 7)) return "now";
  if (days !== null && days <= 3) return "now";

  if (days !== null) return "expiring";
  if (item.category === "coupon" || item.category === "event") return "expiring";

  return "later";
}

export function groupHomeItems(items: Item[]) {
  const active = items.filter((i) => i.status === "active");
  const now: Item[] = [];
  const expiring: Item[] = [];
  const later: Item[] = [];

  for (const item of active) {
    const section = homeSection(item);
    if (section === "now") now.push(item);
    else if (section === "expiring") expiring.push(item);
    else later.push(item);
  }

  const bySoonest = (a: Item, b: Item) => {
    const da = dueDays(a);
    const db = dueDays(b);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  };

  now.sort(bySoonest);
  expiring.sort(bySoonest);

  const recent = [...items]
    .filter((i) => i.status !== "completed" && i.status !== "archived")
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 5);

  return { now, expiring, later, recent };
}

export function inboxItems(items: Item[]) {
  return items.filter((i) => i.status === "inbox");
}

export function doneItems(items: Item[]) {
  return items
    .filter((i) => i.status === "completed" || i.status === "archived")
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}
