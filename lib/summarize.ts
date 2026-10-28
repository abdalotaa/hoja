import type { SummaryResult } from "@/app/api/summarize/route";

export async function summarize(text: string): Promise<SummaryResult> {
  const res = await fetch("/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hoja-Client": "1" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "No se pudo resumir.");
  return data as SummaryResult;
}

const ORIGINAL_MARK = "— Original —\n";

/** If the note was already summarized, returns only its original text so a second run doesn't summarize the summary. */
export function extractOriginal(text: string): string {
  const i = text.lastIndexOf(ORIGINAL_MARK);
  return i === -1 ? text : text.slice(i + ORIGINAL_MARK.length).trim();
}

/** Renders a summary as plain note text, followed by the original content. */
export function formatSummary(s: SummaryResult, original: string): string {
  const parts = [s.summary];
  if (s.keyPoints.length) parts.push("Ideas clave\n" + s.keyPoints.map((p) => `• ${p}`).join("\n"));
  if (s.actionItems.length) parts.push("Pendientes\n" + s.actionItems.map((p) => `☐ ${p}`).join("\n"));
  parts.push(`${ORIGINAL_MARK}${original}`);
  return parts.join("\n\n");
}
