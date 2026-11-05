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

const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/**
 * On silence or background noise the transcription models sometimes "hear" the context they were given (the
 * vocabulary line and the person's glossary) or loop on one phrase. Such text is not speech and is dropped.
 */
export function isNoise(text: string, glossary?: unknown): boolean {
  const words = plain(text);
  if (words.length === 0) return true;
  const prompt = new Set(plain(buildPrompt(glossary)));
  if (words.length >= 3 && words.filter((w) => prompt.has(w)).length / words.length >= 0.8) return true;
  // The same few words over and over ("This is the This is the …").
  return words.length >= 8 && new Set(words).size <= Math.max(2, Math.floor(words.length / 4));
}
