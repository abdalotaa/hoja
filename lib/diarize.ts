import { getChunks, listSessions } from "./audio-store";
import { mergeSegments, type MeetingLine, type Segment } from "./meeting";
import { decodeMono16k, encodeWav, RATE, toDataUrl } from "./wav";

/** Speaker identification: sends audio windows to /api/diarize and keeps the same person under the same label. */

const TRIES = 3;
const REQUEST_TIMEOUT_MS = 240_000; // a 20-minute window can take a couple of minutes to process
const MAX_REFS = 4;
const REF_SECONDS = 3.5;
const MIN_REF_SECONDS = 1.5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Ref {
  name: string;
  data: string;
}

type Result = { ok: true; segments: Segment[] } | { ok: false; fatal: boolean; error: string };

async function request(blob: Blob, filename: string, refs: Ref[]): Promise<Result> {
  const form = new FormData();
  form.append("audio", new File([blob], filename, { type: blob.type }));
  for (const r of refs) {
    form.append("known_speaker_names[]", r.name);
    form.append("known_speaker_references[]", r.data);
  }
  let res: Response;
  try {
    res = await fetch("/api/diarize", { method: "POST", headers: { "X-Hoja-Client": "1" }, body: form, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    return { ok: false, fatal: false, error: "Sin conexión o tardó demasiado." };
  }
  const data = (await res.json().catch(() => ({}))) as { segments?: { text: string; speaker: string; start: number; end: number }[]; error?: string };
  if (res.ok && Array.isArray(data.segments)) return { ok: true, segments: data.segments };
  const fatal = [401, 403, 413].includes(res.status) || data.error?.includes("saldo") === true;
  return { ok: false, fatal, error: data.error ?? "No se pudo identificar a los hablantes." };
}

async function withRetries(blob: Blob, filename: string, refs: Ref[]): Promise<Result> {
  let last: Result = { ok: false, fatal: false, error: "No se pudo identificar a los hablantes." };
  for (let i = 0; i < TRIES; i++) {
    last = await request(blob, filename, refs);
    if (last.ok || last.fatal) return last;
    await sleep(4000 * 2 ** i);
  }
  return last;
}

const extension = (mime: string) => (mime.includes("mp4") ? "m4a" : mime.includes("wav") ? "wav" : mime.includes("ogg") ? "ogg" : "webm");

/**
 * Remembers a short sample of each voice heard so far and hands them to the next window, so "speaker A" in minute
 * 40 is the same person as in minute 2.
 */
export class Diarizer {
  private refs: Ref[] = [];

  /**
   * `samples` is the same audio at 16 kHz, used only to cut voice samples. With `fixed`, every segment belongs to that
   * speaker (a file that already holds one person) and no samples are needed.
   */
  async window(
    blob: Blob,
    filename: string,
    offset: number,
    samples: Float32Array | null,
    fixed?: string,
  ): Promise<{ lines: MeetingLine[]; error?: string; fatal?: boolean }> {
    const sent = await withRetries(blob, filename, fixed ? [] : this.refs);
    if (!sent.ok) return { lines: [], error: sent.error, fatal: sent.fatal };

    const key = (label: string) => fixed ?? `sp-${label}`;
    const merged = mergeSegments(sent.segments.map((s) => ({ ...s, speaker: key(s.speaker) })));
    const lines = merged.map((s, i) => ({
      id: `${filename}:${offset}:${i}`,
      t: offset + s.start,
      src: "remote" as const,
      speaker: s.speaker,
      text: s.text,
    }));
    if (!fixed && samples) {
      try {
        await this.learn(sent.segments, samples);
      } catch {
        // Voice samples only help the next window; the lines of this one are already good.
      }
    }
    return { lines };
  }

  private async learn(segments: Segment[], samples: Float32Array) {
    const known = new Set(this.refs.map((r) => r.name));
    const longest = new Map<string, Segment>();
    for (const s of segments) {
      const best = longest.get(s.speaker);
      if (!best || s.end - s.start > best.end - best.start) longest.set(s.speaker, s);
    }
    const order = [...longest.entries()].sort((a, b) => b[1].end - b[1].start - (a[1].end - a[1].start));
    for (const [label, seg] of order) {
      if (this.refs.length >= MAX_REFS) break;
      if (known.has(label) || seg.end - seg.start < MIN_REF_SECONDS) continue;
      const from = Math.floor(seg.start * RATE);
      const to = Math.min(samples.length, from + Math.floor(Math.min(REF_SECONDS, seg.end - seg.start) * RATE));
      if (to - from < MIN_REF_SECONDS * RATE) continue;
      this.refs.push({ name: label, data: await toDataUrl(encodeWav(samples, from, to)) });
    }
  }
}

/** Who spoke in the saved recording of the participants (one or more 20-minute windows). */
export async function diarizeWindows(
  windowIds: string[],
  origin: number,
  onProgress?: (done: number, total: number) => void,
): Promise<{ lines: MeetingLine[]; failed: number; error?: string }> {
  const sessions = await listSessions();
  const diarizer = new Diarizer();
  const lines: MeetingLine[] = [];
  let failed = 0;
  let error: string | undefined;
  for (let i = 0; i < windowIds.length; i++) {
    onProgress?.(i, windowIds.length);
    const id = windowIds[i];
    const chunks = await getChunks(id);
    if (chunks.length === 0) continue;
    const mime = chunks[0].mime;
    const blob = new Blob(chunks.map((c) => c.blob), { type: mime });
    const meta = sessions.find((s) => s.id === id);
    const offset = meta ? Math.max(0, (meta.startedAt - origin) / 1000) : i * 1200;
    let samples: Float32Array | null = null;
    try {
      samples = await decodeMono16k(blob);
    } catch {
      // Without a decoded copy the window is still labeled; it just can't contribute voice samples.
    }
    const done = await diarizer.window(blob, `ventana-${i}.${extension(mime)}`, offset, samples);
    if (done.error) {
      failed++;
      error = done.error;
      if (done.fatal) break;
    }
    lines.push(...done.lines);
  }
  onProgress?.(windowIds.length, windowIds.length);
  return { lines, failed, error };
}
