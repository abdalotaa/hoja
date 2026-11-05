/** Context handed to the transcription models so names and the app's own words come out spelled right. */

const BASE = "Reunión de trabajo en español de México. Vocabulario: Hoja (nombre de la app), M4PL3, pendientes, calendario.";

/** Free text typed by the person: names and terms, one line. Control characters and length are bounded. */
export function cleanGlossary(raw: unknown, max = 300): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** The prompt for one transcription: fixed vocabulary, the person's glossary, and the end of the text so far. */
export function buildPrompt(glossary?: unknown, context = ""): string {
  const extra = cleanGlossary(glossary);
  const parts = [BASE, extra ? `Nombres y términos: ${extra}.` : "", context ? context.slice(-400) : ""];
  return parts.filter(Boolean).join(" ");
}
