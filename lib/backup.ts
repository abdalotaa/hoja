import type { Note } from "./notes";
import type { Card, CalendarEvent, Link } from "./model";

export interface Backup { app: "hoja"; version: 1 | 2; notes: Note[]; links: Link[]; cards: Card[]; events: CalendarEvent[] }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const id = (v: unknown): v is string => typeof v === "string" && uuid.test(v);

/** Validate everything before touching existing data. Accept the original notes-only backup too. */
export function parseBackup(raw: string): Backup {
  const b = JSON.parse(raw);
  const invalid = () => { throw new Error("El archivo no es un respaldo válido de Hoja."); };
  if (!b || b.app !== "hoja" || ![1, 2].includes(b.version)) return invalid();
  for (const key of ["notes", "links", "cards", "events"]) {
    if (b.version === 1 && ["cards", "events"].includes(key) && b[key] === undefined) b[key] = [];
    if (!Array.isArray(b[key]) || b[key].length > 20000) return invalid();
    const seen = new Set();
    for (const row of b[key]) {
      if (!row || !id(row.id) || !num(row.updatedAt) || seen.has(row.id)) return invalid();
      seen.add(row.id);
    }
  }
  for (const n of b.notes) {
    if (!str(n.title, 300) || !str(n.text, 60000) || !["none", "butter", "mint", "rust"].includes(n.tone) ||
      ![undefined, "note", "node", "table"].includes(n.kind) || ![n.x, n.y, n.w, n.h, n.z].every(num) || n.w <= 0 || n.h <= 0) return invalid();
  }
  const notes = new Set(b.notes.map((n: Note) => n.id));
  for (const l of b.links) if (!notes.has(l.from) || !notes.has(l.to)) return invalid();
  for (const c of b.cards) {
    if (!(c.noteId === null || id(c.noteId)) || !str(c.front, 2000) || !str(c.back, 4000) ||
      ![c.due, c.interval, c.ease, c.reps].every(num) || !Number.isInteger(c.interval) || !Number.isInteger(c.reps) || c.interval < 0 || c.reps < 0) return invalid();
  }
  for (const e of b.events) {
    if (!str(e.title, 200) || typeof e.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
      !Number.isFinite(Date.parse(e.date)) || new Date(e.date).toISOString().slice(0, 10) !== e.date || typeof e.done !== "boolean") return invalid();
  }
  return b as Backup;
}

/** Remap every ID so importing never overwrites current work. */
export function copyBackup(b: Backup): Backup {
  const ids = new Map(b.notes.map((n) => [n.id, crypto.randomUUID()]));
  const now = Date.now();
  return {
    ...b,
    notes: b.notes.map((n) => ({ ...n, id: ids.get(n.id)!, updatedAt: now,
      text: n.text.replace(/hoja:([0-9a-f-]{36})/gi, (match, id: string) => ids.has(id) ? `hoja:${ids.get(id)}` : match) })),
    links: b.links.map((l) => ({ ...l, id: crypto.randomUUID(), from: ids.get(l.from)!, to: ids.get(l.to)!, updatedAt: now })),
    cards: b.cards.map((c) => ({ ...c, id: crypto.randomUUID(), noteId: c.noteId ? ids.get(c.noteId) ?? null : null, updatedAt: now })),
    events: b.events.map((e) => ({ ...e, id: crypto.randomUUID(), updatedAt: now })),
  };
}
