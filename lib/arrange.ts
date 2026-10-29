import type { Link } from "./model";
import type { Note } from "./notes";

const GAP = 56;
const ROW_WIDTH = 2400;

interface Group {
  ids: string[];
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Groups a mind map (its bubbles and the note it grew from) so it moves as one block.
 * A link between two regular notes does not group them: they are tidied like any other note.
 */
function groupsOf(notes: Note[], links: Link[]): Group[] {
  const parent = new Map(notes.map((n) => [n.id, n.id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  const byKind = new Map(notes.map((n) => [n.id, n.kind]));
  for (const l of links) {
    if (!parent.has(l.from) || !parent.has(l.to)) continue;
    if (byKind.get(l.from) === "node" || byKind.get(l.to) === "node") parent.set(find(l.from), find(l.to));
  }
  const byRoot = new Map<string, Note[]>();
  for (const n of notes) byRoot.set(find(n.id), [...(byRoot.get(find(n.id)) ?? []), n]);

  return [...byRoot.values()].map((members) => {
    const x = Math.min(...members.map((n) => n.x));
    const y = Math.min(...members.map((n) => n.y));
    return {
      ids: members.map((n) => n.id),
      x,
      y,
      w: Math.max(...members.map((n) => n.x + n.w)) - x,
      h: Math.max(...members.map((n) => n.y + n.h)) - y,
    };
  });
}

/**
 * Packs everything into tidy rows, keeping the current reading order (top to bottom, left to right).
 * A mind map (its bubbles and the note it grew from) stays together with its shape intact.
 * Returns the new top-left of every note.
 */
export function arrange(notes: Note[], links: Link[]): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  if (notes.length === 0) return out;

  const byId = new Map(notes.map((n) => [n.id, n]));
  const groups = groupsOf(notes, links).sort((a, b) => Math.round(a.y / 360) - Math.round(b.y / 360) || a.x - b.x);

  const startX = Math.min(...notes.map((n) => n.x));
  const startY = Math.min(...notes.map((n) => n.y));
  let cx = startX;
  let cy = startY;
  let rowH = 0;

  for (const g of groups) {
    if (cx > startX && cx - startX + g.w > ROW_WIDTH) {
      cx = startX;
      cy += rowH + GAP;
      rowH = 0;
    }
    for (const id of g.ids) {
      const n = byId.get(id)!;
      out.set(id, { x: cx + (n.x - g.x), y: cy + (n.y - g.y) });
    }
    cx += g.w + GAP;
    rowH = Math.max(rowH, g.h);
  }
  return out;
}
