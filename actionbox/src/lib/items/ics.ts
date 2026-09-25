function pad(n: number) {
  return String(n).padStart(2, "0");
}

function icsDate(dateISO: string, time?: string | null): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  if (!time) {
    return `${y}${pad(m ?? 1)}${pad(d ?? 1)}`;
  }
  const match = time.match(/(\d{1,2}):(\d{2})/);
  const hh = match ? Number(match[1]) : 9;
  const mm = match ? Number(match[2]) : 0;
  return `${y}${pad(m ?? 1)}${pad(d ?? 1)}T${pad(hh)}${pad(mm)}00`;
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildIcs(opts: {
  title: string;
  date: string;
  time?: string | null;
  location?: string | null;
  description?: string | null;
}): string {
  const dt = icsDate(opts.date, opts.time);
  const isAllDay = !opts.time;
  const stamp = icsDate(opts.date, "00:00");
  const loc = opts.location ? `LOCATION:${escapeIcs(opts.location)}` : "";
  const desc = opts.description ? `DESCRIPTION:${escapeIcs(opts.description)}` : "";
  const start = isAllDay ? `DTSTART;VALUE=DATE:${dt}` : `DTSTART:${dt}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ActionBox//KR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@actionbox`,
    `DTSTAMP:${stamp}Z`,
    start,
    `SUMMARY:${escapeIcs(opts.title)}`,
    loc,
    desc,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .filter((line) => line !== "")
    .join("\r\n");
}

export function downloadIcs(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function googleCalendarUrl(opts: {
  title: string;
  date: string;
  time?: string | null;
  location?: string | null;
  description?: string | null;
}): string {
  const start = icsDate(opts.date, opts.time ?? "09:00");
  const [y, m, d] = opts.date.split("-").map(Number);
  const endDate = new Date(y, (m ?? 1) - 1, d ?? 1);
  if (opts.time) {
    const match = opts.time.match(/(\d{1,2}):(\d{2})/);
    endDate.setHours(match ? Number(match[1]) + 1 : 10, match ? Number(match[2]) : 0, 0, 0);
  } else {
    endDate.setDate(endDate.getDate() + 1);
  }
  const end = opts.time
    ? `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`
    : `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${start}/${end}`,
  });
  if (opts.location) params.set("location", opts.location);
  if (opts.description) params.set("details", opts.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
