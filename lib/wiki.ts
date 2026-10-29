import type { Link } from "./model";
import type { Note } from "./notes";

/** Links between notes are plain Markdown links: [Title](hoja:<note id>). */
export const SCHEME = "hoja:";
const LINK_RE = /\]\(hoja:([0-9a-fA-F-]{36})\)/g;

export function outgoingIds(text: string): string[] {
  return [...new Set([...text.matchAll(LINK_RE)].map((m) => m[1].toLowerCase()))];
}

const isDoc = (n: Note) => n.kind !== "node";

/** Notes whose text links to `id`. */
export function backlinksOf(notes: Note[], id: string): Note[] {
  const target = id.toLowerCase();
  return notes.filter((n) => isDoc(n) && n.id !== id && outgoingIds(n.text).includes(target));
}

/** Arrows implied by the text, so what you write and what you see on the canvas always agree. */
export function derivedLinks(notes: Note[]): Link[] {
  const ids = new Set(notes.map((n) => n.id.toLowerCase()));
  const out: Link[] = [];
  for (const n of notes) {
    if (!isDoc(n)) continue;
    for (const to of outgoingIds(n.text)) {
      if (to !== n.id.toLowerCase() && ids.has(to)) out.push({ id: `t-${n.id}-${to}`, from: n.id, to, updatedAt: 0 });
    }
  }
  return out;
}

export interface Heading {
  level: number;
  text: string;
}

export function outline(text: string): Heading[] {
  const out: Heading[] = [];
  let fenced = false;
  for (const line of text.split("\n")) {
    if (line.trim().startsWith("```")) fenced = !fenced;
    if (fenced) continue;
    const m = line.match(/^(#{1,3})\s+(.+?)\s*#*$/);
    if (m) out.push({ level: m[1].length, text: stripInline(m[2]) });
  }
  return out;
}

const stripInline = (s: string) =>
  s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~|`)/g, "")
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$|[.,;:!?])/g, "$1$2");

/** Plain text for card previews, search and read-only views. */
export function stripMarkdown(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      stripInline(
        line
          .replace(/^\s*#{1,6}\s+/, "")
          .replace(/^\s*>\s?/, "")
          .replace(/^(\s*)[-*]\s+\[ \]\s+/, "$1☐ ")
          .replace(/^(\s*)[-*]\s+\[[xX]\]\s+/, "$1☑ ")
          .replace(/^(\s*)[-*]\s+/, "$1• ")
          .replace(/^\s*---+\s*$/, ""),
      ),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const hasMarkdown = (text: string) => /^(\s*)(#{1,6}\s|[-*]\s|\d+\.\s|>\s|```)/m.test(text) || /\]\(hoja:/.test(text);

/**
 * Notes written before the editor are plain text with ☐ / • lines and single line breaks.
 * Turn them into Markdown the first time they are opened, so nothing is lost or merged.
 */
export function legacyToMarkdown(text: string): string {
  if (!text.trim()) return "";
  const converted = text
    .replace(/^(\s*)☐\s?/gm, "$1- [ ] ")
    .replace(/^(\s*)☑\s?/gm, "$1- [x] ")
    .replace(/^(\s*)•\s?/gm, "$1- ")
    .replace(/^— Original —\s*$/gm, "## Original");
  if (hasMarkdown(converted) && !/☐|☑|•/.test(text)) return converted;

  // One paragraph per line, so single line breaks survive; list items stay together.
  const out: string[] = [];
  const lines = converted.split("\n");
  lines.forEach((line, i) => {
    out.push(line);
    const next = lines[i + 1];
    const item = (l?: string) => /^\s*(?:[-*]\s|\d+\.\s)/.test(l ?? "");
    if (next !== undefined && line.trim() && next.trim() && !(item(line) && item(next))) out.push("");
  });
  return out.join("\n");
}
