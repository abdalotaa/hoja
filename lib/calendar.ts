export interface CalEvent {
  title: string;
  date: string; // YYYY-MM-DD
}

export interface TaskLine {
  title: string;
  date: string;
  done: boolean;
}

const TASK_RE = /^\s*(?:[-*]\s+\[([ xX])\]|([☐☑]))\s*(.*)$/;

/** Reads a checklist line ("- [ ] tarea — 2026-11-05" or the older "☐ tarea — 2026-11-05") that carries a date. */
export function parseTaskLine(line: string): TaskLine | null {
  const m = line.match(TASK_RE);
  if (!m) return null;
  const date = m[3].match(/(\d{4}-\d{2}-\d{2})/);
  if (!date) return null;
  const parts = m[3]
    .replace(date[1], "")
    .split("—")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  return { title: parts.join(" — "), date: date[1], done: m[1] ? m[1] !== " " : m[2] === "☑" };
}

/** The same line with its checkbox flipped. */
export function toggleTaskLine(line: string): string {
  return line
    .replace(/\[([ xX])\]/, (_, c: string) => (c === " " ? "[x]" : "[ ]"))
    .replace(/[☐☑]/, (c) => (c === "☐" ? "☑" : "☐"));
}

/** Finds checklist lines that carry a YYYY-MM-DD date. */
export function extractEvents(text: string): CalEvent[] {
  return text
    .split("\n")
    .map(parseTaskLine)
    .filter((t): t is TaskLine => t !== null)
    .map((t) => ({ title: t.title, date: t.date }));
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
