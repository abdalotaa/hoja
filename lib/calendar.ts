export interface CalEvent {
  title: string;
  date: string; // YYYY-MM-DD
}

/** Finds checklist lines (☐ …) that carry a YYYY-MM-DD date. */
export function extractEvents(text: string): CalEvent[] {
  const out: CalEvent[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim().startsWith("☐")) continue;
    const m = line.match(/(\d{4}-\d{2}-\d{2})/);
    if (!m) continue;
    const parts = line
      .replace("☐", "")
      .replace(m[1], "")
      .split("—")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length) out.push({ title: parts.join(" — "), date: m[1] });
  }
  return out;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

export function buildIcs(events: CalEvent[], calendarName: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hoja//ES", `X-WR-CALNAME:${esc(calendarName)}`];
  events.forEach((e, i) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:hoja-${Date.now()}-${i}@hoja.m4pl3.xyz`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${e.date.replaceAll("-", "")}`,
      `DTEND;VALUE=DATE:${nextDay(e.date)}`,
      `SUMMARY:${esc(e.title)}`,
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(events: CalEvent[], name: string) {
  const blob = new Blob([buildIcs(events, name)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.trim().replace(/[^\w-]+/g, "-").toLowerCase() || "hoja"}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
