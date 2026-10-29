import { describe, expect, it } from "vitest";
import { parseBackup, copyBackup } from "../lib/backup";

const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
const note = { id: a, title: "A", text: `[B](hoja:${b})`, tone: "none", x: 0, y: 0, w: 320, h: 260, z: 1, updatedAt: 1 };
const backup = () => ({ app: "hoja", version: 2, notes: [note, { ...note, id: b, text: "" }],
  links: [{ id: crypto.randomUUID(), from: a, to: b, updatedAt: 1 }],
  cards: [{ id: crypto.randomUUID(), noteId: a, front: "Q", back: "A", due: 1, interval: 1, ease: 2.5, reps: 0, updatedAt: 1 }],
  events: [{ id: crypto.randomUUID(), title: "Evento", date: "2026-10-28", done: false, updatedAt: 1 }] });

describe("backups", () => {
  it("restores all collections and remaps relationships without overwriting existing IDs", () => {
    const source = backup();
    const copied = copyBackup(parseBackup(JSON.stringify(source)));
    expect(copied.notes[0].id).not.toBe(a);
    expect(copied.links[0].from).toBe(copied.notes[0].id);
    expect(copied.links[0].to).toBe(copied.notes[1].id);
    expect(copied.cards[0].noteId).toBe(copied.notes[0].id);
    expect(copied.notes[0].text).toBe(`[B](hoja:${copied.notes[1].id})`);
    expect(copied.events).toHaveLength(1);
    expect(source.notes[0].id).toBe(a);
  });
  it("accepts original v1 backups", () => {
    expect(parseBackup(JSON.stringify({ app: "hoja", version: 1, notes: [note], links: [] })).cards).toEqual([]);
  });
  it.each([
    (b: ReturnType<typeof backup>) => { b.notes[0].w = -1; },
    (b: ReturnType<typeof backup>) => { b.notes.push(b.notes[0]); },
    (b: ReturnType<typeof backup>) => { b.links[0].to = crypto.randomUUID(); },
    (b: ReturnType<typeof backup>) => { b.cards[0].reps = 0.5; },
    (b: ReturnType<typeof backup>) => { b.events[0].date = "2026-02-31"; },
  ])("rejects malformed records before import", (corrupt) => {
    const b = backup(); corrupt(b);
    expect(() => parseBackup(JSON.stringify(b))).toThrow();
  });
});

describe("notebooks in backups", () => {
  const nb = { id: "11111111-1111-4111-8111-111111111111", name: "Biología", tone: "mint", updatedAt: 1 };
  const note = (notebookId: string | null) => ({ id: crypto.randomUUID(), title: "t", text: "x", tone: "none", x: 0, y: 0, w: 320, h: 260, z: 1, updatedAt: 1, notebookId });
  it("keeps the notebook of each note when importing, under new ids", () => {
    const source = { app: "hoja", version: 3, notebooks: [nb], notes: [note(nb.id), note(null)], links: [], cards: [], events: [] };
    const copied = copyBackup(parseBackup(JSON.stringify(source)));
    expect(copied.notebooks).toHaveLength(1);
    expect(copied.notebooks[0].id).not.toBe(nb.id);
    expect(copied.notes[0].notebookId).toBe(copied.notebooks[0].id);
    expect(copied.notes[1].notebookId).toBeNull();
  });
  it("rejects a note that points to a notebook the backup doesn't have", () => {
    const source = { app: "hoja", version: 3, notebooks: [], notes: [note("22222222-2222-4222-8222-222222222222")], links: [], cards: [], events: [] };
    expect(() => parseBackup(JSON.stringify(source))).toThrow();
  });
  it("still reads older backups without notebooks", () => {
    expect(parseBackup(JSON.stringify({ app: "hoja", version: 2, notes: [note(null)], links: [], cards: [], events: [] })).notebooks).toEqual([]);
  });
});
