export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 28;
const STEP = 40;

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w + PAD && a.x + a.w + PAD > b.x && a.y < b.y + b.h + PAD && a.y + a.h + PAD > b.y;

/**
 * Finds the closest spot to `preferred` where a block of `size` doesn't touch any existing rectangle.
 * If the board is too crowded, it goes below everything.
 */
export function freeSpot(taken: Rect[], size: { w: number; h: number }, preferred: { x: number; y: number }, board = { w: 3000, h: 2000 }) {
  const fits = (x: number, y: number) => !taken.some((t) => overlaps({ x, y, ...size }, t));
  const px = Math.max(30, preferred.x);
  const py = Math.max(30, preferred.y);
  if (fits(px, py)) return { x: px, y: py };

  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (let y = 30; y + size.h < board.h; y += STEP) {
    for (let x = 30; x + size.w < board.w; x += STEP) {
      const d = (x - px) ** 2 + (y - py) ** 2;
      if (d < bestDist && fits(x, y)) {
        best = { x, y };
        bestDist = d;
      }
    }
  }
  if (best) return best;

  const bottom = taken.reduce((m, t) => Math.max(m, t.y + t.h), 0);
  return { x: 60, y: bottom + 60 };
}

/** The board grows with the content so nothing is ever cut off. */
export function boardSize(rects: Rect[]) {
  const right = rects.reduce((m, r) => Math.max(m, r.x + r.w), 0);
  const bottom = rects.reduce((m, r) => Math.max(m, r.y + r.h), 0);
  return { w: Math.max(3000, right + 500), h: Math.max(2000, bottom + 500) };
}
