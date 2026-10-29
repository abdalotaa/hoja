import type { Note, Tone } from "./notes";

export interface Link {
  id: string;
  from: string;
  to: string;
  updatedAt: number;
}

/** A notebook groups notes; each one is its own canvas. */
export interface Notebook {
  id: string;
  name: string;
  tone: Tone;
  updatedAt: number;
}

/** A flashcard with SM-2 style scheduling. */
export interface Card {
  id: string;
  noteId: string | null;
  front: string;
  back: string;
  due: number; // epoch ms
  interval: number; // days
  ease: number;
  reps: number;
  updatedAt: number;
}

/** A dated item added by hand on the calendar. */
export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  done: boolean;
  updatedAt: number;
}

type Row = Record<string, unknown>;

export interface Table<T> {
  key: string; // localStorage key
  table: string; // Supabase table
  order?: string;
  toRow: (item: T) => Row;
  fromRow: (row: Row) => T;
}

export const NOTES: Table<Note> = {
  key: "hoja:notes:v1",
  table: "notes",
  order: "z",
  toRow: (n) => ({
    id: n.id,
    title: n.title,
    text: n.text,
    tone: n.tone,
    kind: n.kind ?? "note",
    notebook_id: n.notebookId ?? null,
    x: Math.round(n.x),
    y: Math.round(n.y),
    w: Math.round(n.w),
    h: Math.round(n.h),
    z: n.z,
    updated_at: n.updatedAt,
  }),
  fromRow: (r) => ({
    id: r.id as string,
    title: r.title as string,
    text: r.text as string,
    tone: r.tone as Note["tone"],
    kind: (r.kind as Note["kind"]) ?? "note",
    notebookId: (r.notebook_id as string | null | undefined) ?? null,
    x: r.x as number,
    y: r.y as number,
    w: r.w as number,
    h: r.h as number,
    z: r.z as number,
    updatedAt: r.updated_at as number,
  }),
};

export const NOTEBOOKS: Table<Notebook> = {
  key: "hoja:notebooks:v1",
  table: "notebooks",
  order: "created_at",
  toRow: (b) => ({ id: b.id, name: b.name, tone: b.tone, updated_at: b.updatedAt }),
  fromRow: (r) => ({ id: r.id as string, name: r.name as string, tone: r.tone as Tone, updatedAt: r.updated_at as number }),
};

export const LINKS: Table<Link> = {
  key: "hoja:links:v1",
  table: "links",
  toRow: (l) => ({ id: l.id, from_id: l.from, to_id: l.to, updated_at: l.updatedAt }),
  fromRow: (r) => ({ id: r.id as string, from: r.from_id as string, to: r.to_id as string, updatedAt: r.updated_at as number }),
};

export const CARDS: Table<Card> = {
  key: "hoja:cards:v1",
  table: "cards",
  toRow: (c) => ({
    id: c.id,
    note_id: c.noteId,
    front: c.front,
    back: c.back,
    due: c.due,
    interval: c.interval,
    ease: c.ease,
    reps: c.reps,
    updated_at: c.updatedAt,
  }),
  fromRow: (r) => ({
    id: r.id as string,
    noteId: (r.note_id as string | null) ?? null,
    front: r.front as string,
    back: r.back as string,
    due: r.due as number,
    interval: r.interval as number,
    ease: r.ease as number,
    reps: r.reps as number,
    updatedAt: r.updated_at as number,
  }),
};

export const EVENTS: Table<CalendarEvent> = {
  key: "hoja:events:v1",
  table: "events",
  toRow: (e) => ({ id: e.id, title: e.title, date: e.date, done: e.done, updated_at: e.updatedAt }),
  fromRow: (r) => ({
    id: r.id as string,
    title: r.title as string,
    date: r.date as string,
    done: Boolean(r.done),
    updatedAt: r.updated_at as number,
  }),
};
