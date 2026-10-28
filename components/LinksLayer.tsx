"use client";

import type { Link } from "@/lib/model";
import type { Note } from "@/lib/notes";

interface Props {
  notes: Note[];
  links: Link[];
  /** A link being dragged from a note to the pointer. */
  draft: { fromId: string; x: number; y: number } | null;
  onRemove?: (id: string) => void;
}

interface Anchor {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

function anchors(a: Note, b: Note): [Anchor, Anchor] {
  const ay = a.y + a.h / 2;
  const by = b.y + b.h / 2;
  // If one note sits fully beside the other, connect side to side (the natural reading of a tree).
  if (b.x >= a.x + a.w - 12 || a.x >= b.x + b.w - 12) {
    const right = b.x >= a.x + a.w - 12;
    return [
      { x: right ? a.x + a.w : a.x, y: ay, dx: right ? 1 : -1, dy: 0 },
      { x: right ? b.x : b.x + b.w, y: by, dx: right ? -1 : 1, dy: 0 },
    ];
  }
  const ax = a.x + a.w / 2;
  const bx = b.x + b.w / 2;
  const down = by >= ay;
  return [
    { x: ax, y: down ? a.y + a.h : a.y, dx: 0, dy: down ? 1 : -1 },
    { x: bx, y: down ? b.y : b.y + b.h, dx: 0, dy: down ? -1 : 1 },
  ];
}

function curve(p: Anchor, q: Anchor) {
  const k = Math.max(40, Math.hypot(q.x - p.x, q.y - p.y) / 3);
  const c1 = `${p.x + p.dx * k},${p.y + p.dy * k}`;
  const c2 = `${q.x + q.dx * k},${q.y + q.dy * k}`;
  return { d: `M${p.x},${p.y} C${c1} ${c2} ${q.x},${q.y}`, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2 };
}

export default function LinksLayer({ notes, links, draft, onRemove }: Props) {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const drawn = links
    .map((l) => {
      const a = byId.get(l.from);
      const b = byId.get(l.to);
      if (!a || !b) return null;
      const [p, q] = anchors(a, b);
      return { id: l.id, ...curve(p, q) };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  const from = draft ? byId.get(draft.fromId) : undefined;

  return (
    <>
      <svg className="links" width="3000" height="2000" aria-hidden="true">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#17140f" />
          </marker>
        </defs>
        {drawn.map((l) => (
          <path key={l.id} d={l.d} className="link-path" markerEnd="url(#arrow)" />
        ))}
        {draft && from && (
          <path
            d={`M${from.x + from.w},${from.y + from.h / 2} L${draft.x},${draft.y}`}
            className="link-path draft"
          />
        )}
      </svg>
      {onRemove &&
        drawn.map((l) => (
          <button
            key={l.id}
            className="link-x"
            style={{ left: l.mx, top: l.my }}
            aria-label="Quitar conexión"
            title="Quitar conexión"
            onClick={() => onRemove(l.id)}
          >
            ×
          </button>
        ))}
    </>
  );
}
