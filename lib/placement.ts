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

export interface World {
  /** World coordinates of the board's top-left corner. */
  ox: number;
  oy: number;
  w: number;
  h: number;
}

const MARGIN = 1400; // empty room kept around the content, on every side
const QUANT = 300; // the board's edges move in steps, not on every pixel

/**
 * The canvas has no edges: notes can sit at negative coordinates, and the board always extends
 * MARGIN past the outermost note in every direction.
 */
export function worldOf(rects: Rect[]): World {
  const minX = rects.length ? Math.min(...rects.map((r) => r.x)) : 0;
  const minY = rects.length ? Math.min(...rects.map((r) => r.y)) : 0;
  const maxX = rects.length ? Math.max(...rects.map((r) => r.x + r.w)) : 0;
  const maxY = rects.length ? Math.max(...rects.map((r) => r.y + r.h)) : 0;
  const ox = Math.floor((minX - MARGIN) / QUANT) * QUANT;
  const oy = Math.floor((minY - MARGIN) / QUANT) * QUANT;
  const x1 = Math.ceil((maxX + MARGIN) / QUANT) * QUANT;
  const y1 = Math.ceil((maxY + MARGIN) / QUANT) * QUANT;
  return { ox, oy, w: x1 - ox, h: y1 - oy };
}

/**
 * Finds the closest spot to `preferred` where a block of `size` doesn't touch any existing rectangle,
 * searching the area around the existing content. Falls back to below everything.
 */
export function freeSpot(taken: Rect[], size: { w: number; h: number }, preferred: { x: number; y: number }) {
  const fits = (x: number, y: number) => !taken.some((t) => overlaps({ x, y, ...size }, t));
  if (fits(preferred.x, preferred.y)) return { x: preferred.x, y: preferred.y };

  const x0 = Math.min(preferred.x, ...taken.map((t) => t.x)) - 400;
  const y0 = Math.min(preferred.y, ...taken.map((t) => t.y)) - 400;
  const x1 = Math.max(preferred.x + size.w, ...taken.map((t) => t.x + t.w)) + 400;
  const y1 = Math.max(preferred.y + size.h, ...taken.map((t) => t.y + t.h)) + 400;

  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (let y = y0; y + size.h < y1; y += STEP) {
    for (let x = x0; x + size.w < x1; x += STEP) {
      const d = (x - preferred.x) ** 2 + (y - preferred.y) ** 2;
      if (d < bestDist && fits(x, y)) {
        best = { x, y };
        bestDist = d;
      }
    }
  }
  if (best) return best;

  const bottom = taken.reduce((m, t) => Math.max(m, t.y + t.h), 0);
  const left = taken.reduce((m, t) => Math.min(m, t.x), preferred.x);
  return { x: left, y: bottom + 60 };
}
