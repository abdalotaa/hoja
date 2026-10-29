/** Helpers for assembling a transcript from short audio chunks. */

export function joinParts(parts: (string | undefined)[]): string {
  return parts
    .map((p) => p?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

/** The end of the text so far, sent as context so names and sentences stay consistent across chunks. */
export function tail(text: string, max = 300): string {
  return text.length <= max ? text : text.slice(text.length - max);
}

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export function pickMime(isSupported: (t: string) => boolean): string | undefined {
  return MIME_CANDIDATES.find((t) => isSupported(t));
}
