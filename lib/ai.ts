export interface Summary {
  title: string;
  summary: string;
  keyPoints: string[];
  actionItems: string[];
}
export interface Branch {
  label: string;
  children?: Branch[];
}
export interface MindMap {
  root: string;
  branches: Branch[];
}
export interface Flashcards {
  cards: { front: string; back: string }[];
}
export interface Guide {
  title: string;
  sections: { heading: string; points: string[] }[];
}
export interface Meeting {
  title: string;
  summary: string;
  decisions: string[];
  actions: { task: string; owner: string | null; due: string | null }[];
}
export interface Answer {
  answer: string;
  sources: string[];
}

export interface Tasks {
  summarize: { in: { text: string }; out: Summary };
  mindmap: { in: { text: string }; out: MindMap };
  flashcards: { in: { text: string }; out: Flashcards };
  guide: { in: { text: string }; out: Guide };
  meeting: { in: { text: string; today: string }; out: Meeting };
  ask: { in: { question: string; notes: { id: string; title: string; text: string }[] }; out: Answer };
}

export async function ai<K extends keyof Tasks>(task: K, input: Tasks[K]["in"]): Promise<Tasks[K]["out"]> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hoja-Client": "1" },
    body: JSON.stringify({ task, ...input }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "No se pudo completar la solicitud.");
  return (data as { result: Tasks[K]["out"] }).result;
}

const LEGACY_MARK = "— Original —\n";
const MARK = "## Original\n";

/** If the note was already summarized, returns only its original text so a second run doesn't summarize the summary. */
export function extractOriginal(text: string): string {
  const i = text.lastIndexOf(MARK);
  if (i !== -1) return text.slice(i + MARK.length).trim();
  const j = text.lastIndexOf(LEGACY_MARK);
  return j === -1 ? text : text.slice(j + LEGACY_MARK.length).trim();
}

const list = (items: string[]) => items.map((p) => `- ${p}`).join("\n");
const tasks = (items: string[]) => items.map((p) => `- [ ] ${p}`).join("\n");

export function formatSummary(s: Summary, original: string): string {
  const parts = [s.summary];
  if (s.keyPoints.length) parts.push(`## Ideas clave\n${list(s.keyPoints)}`);
  if (s.actionItems.length) parts.push(`## Pendientes\n${tasks(s.actionItems)}`);
  parts.push(`${MARK}${original}`);
  return parts.join("\n\n");
}

export function formatMeeting(m: Meeting, original: string): string {
  const parts = [m.summary];
  if (m.decisions.length) parts.push(`## Decisiones\n${list(m.decisions)}`);
  if (m.actions.length) {
    parts.push(
      `## Pendientes\n${tasks(m.actions.map((a) => `${a.task}${a.owner ? ` — ${a.owner}` : ""}${a.due ? ` — ${a.due}` : ""}`))}`,
    );
  }
  parts.push(`${MARK}${original}`);
  return parts.join("\n\n");
}

export function formatGuide(g: Guide): string {
  return g.sections.map((s) => `## ${s.heading}\n${list(s.points)}`).join("\n\n");
}
