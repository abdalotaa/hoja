import type { Card, CalendarEvent, Link } from "./model";
import type { Note } from "./notes";
import { parseTable, tableToMarkdown } from "./table";

function download(name: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** One Markdown file: a section per note, plus which notes each one is connected to. */
export function exportMarkdown(notes: Note[], links: Link[]) {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const name = (id: string) => byId.get(id)?.title.trim() || "Sin título";
  const body = notes
    .filter((n) => n.kind !== "node")
    .map((n) => {
      const related = links
        .filter((l) => l.from === n.id || l.to === n.id)
        .map((l) => name(l.from === n.id ? l.to : l.from));
      const connected = related.length ? `\n\n_Conectada con: ${related.join(", ")}_` : "";
      const text = n.kind === "table" ? tableToMarkdown(parseTable(n.text)) : n.text.trim();
      return `## ${n.title.trim() || "Sin título"}\n\n${text}${connected}`;
    })
    .join("\n\n---\n\n");
  download(`hoja-${stamp()}.md`, "text/markdown", `# Mis notas de Hoja\n\n${body}\n`);
}

/** A full backup, including mind-map nodes and positions. */
export function exportJson(notes: Note[], links: Link[], cards: Card[], events: CalendarEvent[]) {
  download(`hoja-respaldo-${stamp()}.json`, "application/json", JSON.stringify({ app: "hoja", version: 2, notes, links, cards, events }, null, 2));
}
