import { addDaysISO } from "@/lib/utils";

type CalendarEvent = {
  title: string;
  date: string;
  time?: string | null;
  location?: string | null;
  description?: string | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function compactDate(dateISO: string): string {
  return dateISO.replaceAll("-", "");
}

/** Start/end in calendar format: all-day when there is no time, otherwise one hour (local, floating time). */
function eventRange(ev: CalendarEvent): { start: string; end: string; allDay: boolean } {
  const match = ev.time?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return { start: compactDate(ev.date), end: compactDate(addDaysISO(ev.date, 1)), allDay: true };
  }
  const [y, m, d] = ev.date.split("-").map(Number);
  const start = new Date(y, m - 1, d, Number(match[1]), Number(match[2]));
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
  return { start: fmt(start), end: fmt(end), allDay: false };
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildIcs(ev: CalendarEvent): string {
  const { start, end, allDay } = eventRange(ev);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ActionBox//KR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@actionbox`,
    `DTSTAMP:${stamp}`,
    allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
    allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`,
    `SUMMARY:${escapeIcs(ev.title)}`,
    ev.location ? `LOCATION:${escapeIcs(ev.location)}` : null,
    ev.description ? `DESCRIPTION:${escapeIcs(ev.description)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .filter((line): line is string => line !== null)
    .join("\r\n");
}

export function downloadIcs(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/[\\/:*?"<>|]/g, " ").trim() || "event"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function googleCalendarUrl(ev: CalendarEvent): string {
  const { start, end } = eventRange(ev);
  const params = new URLSearchParams({ action: "TEMPLATE", text: ev.title, dates: `${start}/${end}` });
  if (ev.location) params.set("location", ev.location);
  if (ev.description) params.set("details", ev.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
