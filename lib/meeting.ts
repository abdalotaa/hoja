/** Who said what in a meeting: line model, echo removal, speaker names and the final transcript text. */

export type Source = "mic" | "remote";

export interface MeetingLine {
  id: string;
  /** Seconds since the meeting started. */
  t: number;
  src: Source;
  /** A key, not a display name: "mic", "remote", "sp-A" (speaker A) or "f:Marta" (a per-person file). */
  speaker: string;
  text: string;
}

export const MIC = "mic";
export const REMOTE = "remote";

export const sortLines = (lines: MeetingLine[]) => [...lines].sort((a, b) => a.t - b.t);

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9ñ\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );

/**
 * Without headphones the microphone also hears the call coming out of the speakers, so the same sentence shows up
 * twice. A microphone line that closely repeats a participants' line said at about the same time is dropped.
 */
export function dropEchoes(lines: MeetingLine[], window = 10, threshold = 0.6): MeetingLine[] {
  const remote = lines.filter((l) => l.src === "remote").map((l) => ({ t: l.t, w: words(l.text) }));
  if (remote.length === 0) return lines;
  return lines.filter((l) => {
    if (l.src !== "mic") return true;
    const mine = words(l.text);
    if (mine.size < 3) return true;
    return !remote.some((r) => {
      if (Math.abs(r.t - l.t) > window || r.w.size === 0) return false;
      let shared = 0;
      for (const w of mine) if (r.w.has(w)) shared++;
      return shared / Math.min(mine.size, r.w.size) >= threshold;
    });
  });
}

export interface Segment {
  start: number;
  end: number;
  speaker: string;
  text: string;
}

/** Diarization returns many short pieces; consecutive ones from the same speaker read better as one line. */
export function mergeSegments(segments: Segment[], gap = 2.5): Segment[] {
  const out: Segment[] = [];
  for (const s of [...segments].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && last.speaker === s.speaker && s.start - last.end <= gap) {
      last.text = `${last.text} ${s.text}`.replace(/\s+/g, " ").trim();
      last.end = Math.max(last.end, s.end);
    } else {
      out.push({ ...s, text: s.text.trim() });
    }
  }
  return out;
}

export function defaultName(key: string): string {
  if (key === MIC) return "Tú";
  if (key === REMOTE) return "Participantes";
  if (key.startsWith("f:")) return key.slice(2);
  if (key.startsWith("sp-")) return `Hablante ${key.slice(3)}`;
  return key;
}

export interface SpeakerInfo {
  key: string;
  count: number;
  sample: string;
}

export function speakersOf(lines: MeetingLine[]): SpeakerInfo[] {
  const map = new Map<string, SpeakerInfo>();
  for (const l of sortLines(lines)) {
    const info = map.get(l.speaker) ?? { key: l.speaker, count: 0, sample: "" };
    info.count++;
    if (info.sample.length < 80 && l.text.length > info.sample.length) info.sample = l.text;
    map.set(l.speaker, info);
  }
  return [...map.values()];
}

/** The transcript as text. A meeting with only the microphone stays plain; with several voices each turn gets a name. */
export function renderTranscript(lines: MeetingLine[], names: Record<string, string> = {}): string {
  const sorted = sortLines(lines).filter((l) => l.text.trim());
  if (sorted.length > 0 && sorted.every((l) => l.speaker === MIC)) return sorted.map((l) => l.text.trim()).join(" ");
  const out: string[] = [];
  let current: string | null = null;
  for (const l of sorted) {
    const name = names[l.speaker]?.trim() || defaultName(l.speaker);
    if (name === current) out[out.length - 1] += ` ${l.text.trim()}`;
    else out.push(`${name}: ${l.text.trim()}`);
    current = name;
  }
  return out.join("\n\n");
}

/** A person's name from a Zoom per-participant file name, e.g. "audioMarta López3046718.m4a" → "Marta López". */
export function fileSpeaker(filename: string, index: number): string {
  const base = filename
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/^audio[\s_-]*/i, "")
    .replace(/[\d_]+$/g, "")
    .replace(/_/g, " ")
    .trim();
  return `f:${base || `Participante ${index + 1}`}`;
}

export const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
