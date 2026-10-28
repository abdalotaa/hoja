import type { Link } from "./model";
import { newNote, type Note, type Tone } from "./notes";
import type { Branch, MindMap } from "./ai";

const NODE_W = 170;
const NODE_H = 64;
const COL = 230;
const ROW = 86;

interface Placed {
  label: string;
  depth: number;
  y: number; // vertical center, in rows
  parent: number; // index in the placed list, -1 for the root
}

/** Lays a branch tree out left-to-right and returns the placed nodes in creation order. */
function layout(root: string, branches: Branch[]): Placed[] {
  const placed: Placed[] = [];
  let nextRow = 0;

  const place = (label: string, children: Branch[] | undefined, depth: number, parent: number): number => {
    const index = placed.length;
    placed.push({ label, depth, y: 0, parent });
    if (!children || children.length === 0) {
      placed[index].y = nextRow++;
    } else {
      const ys = children.map((c) => placed[place(c.label, c.children, depth + 1, index)].y);
      placed[index].y = (ys[0] + ys[ys.length - 1]) / 2;
    }
    return index;
  };

  place(root, branches, 0, -1);
  return placed;
}

/** Builds the nodes and links of a mind map at (0, 0); the caller moves it to a free spot. */
export function buildMindMap(map: MindMap, startZ: number) {
  const origin = { x: 0, y: 0 };
  const placed = layout(map.root.trim() || "Idea", map.branches.slice(0, 8));
  const nodes: Note[] = placed.map((p, i) => {
    const tone: Tone = p.depth === 0 ? "butter" : p.depth === 1 ? "mint" : "none";
    const note = newNote(i, startZ + i, { x: origin.x + p.depth * COL, y: origin.y + p.y * ROW });
    return { ...note, kind: "node", title: p.label.replace(/[{}\[\]"\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "Idea", tone, w: NODE_W, h: NODE_H };
  });
  const links: Link[] = placed
    .map((p, i) => (p.parent >= 0 ? { id: crypto.randomUUID(), from: nodes[p.parent].id, to: nodes[i].id, updatedAt: Date.now() } : null))
    .filter((l): l is Link => l !== null);
  const depth = Math.max(...placed.map((p) => p.depth));
  return {
    nodes,
    links,
    width: depth * COL + NODE_W,
    height: Math.max(...placed.map((p) => p.y)) * ROW + NODE_H,
  };
}
