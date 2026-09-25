import { daysUntil } from "@/lib/utils";
import { isReminderDue } from "./reminder";
import { keyDate, type Item } from "./types";

export type HomeSection = "now" | "expiring" | "later";

/** Where an active item sits on the home screen. */
export function homeSection(item: Item): HomeSection {
  const days = daysUntil(keyDate(item));
  if (item.do_today || isReminderDue(item)) return "now";
  if (days !== null && days <= 3) return "now";
  if (item.category === "todo" && (days === null || days <= 7)) return "now";
  if (days !== null) return "expiring";
  if (item.category === "coupon" || item.category === "event") return "expiring";
  return "later";
}

const byCreatedDesc = (a: Item, b: Item) => (a.created_at < b.created_at ? 1 : -1);

function bySoonest(a: Item, b: Item) {
  const da = daysUntil(keyDate(a));
  const db = daysUntil(keyDate(b));
  if (da === null && db === null) return byCreatedDesc(a, b);
  if (da === null) return 1;
  if (db === null) return -1;
  return da - db;
}

export function groupHomeItems(items: Item[]) {
  const now: Item[] = [];
  const expiring: Item[] = [];
  const later: Item[] = [];
  for (const item of items) {
    if (item.status !== "active") continue;
    const section = homeSection(item);
    if (section === "now") now.push(item);
    else if (section === "expiring") expiring.push(item);
    else later.push(item);
  }
  now.sort(bySoonest);
  expiring.sort(bySoonest);
  later.sort(byCreatedDesc);
  return { now, expiring, later };
}

export function inboxItems(items: Item[]) {
  return items.filter((i) => i.status === "inbox").sort(byCreatedDesc);
}

export function doneItems(items: Item[], status: "completed" | "archived") {
  return items
    .filter((i) => i.status === status)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}
