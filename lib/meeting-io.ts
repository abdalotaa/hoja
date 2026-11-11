import { deleteSession, listSessions, type SessionMeta } from "./audio-store";
import { diarizeWindows } from "./diarize";
import { getChunks } from "./audio-store";
import { transcribeLocalSamples } from "./local-whisper";
import { MIC, REMOTE, sortLines, type MeetingLine } from "./meeting";
import { transcribeChunks, type Engine } from "./useRecorder";
import { decodeMono16k } from "./wav";

/** Rebuilds a meeting from the audio saved in this browser (after a failure, a closed tab or a dropped connection). */

/** Where each saved microphone segment started: the first lasts 10 s, the rest 25 s. */
export const segmentStart = (seq: number) => (seq === 0 ? 0 : 10 + (seq - 1) * 25);

export async function remoteWindowsOf(meta: SessionMeta): Promise<string[]> {
  const all = await listSessions();
  return all
    .filter((s) => s.mode === "remote" && s.origin === meta.startedAt)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => s.id);
}

export async function recoverMeeting(
  meta: SessionMeta,
  onProgress?: (done: number, total: number, stage?: "mic" | "voices") => void,
  engine: Engine = "cloud",
): Promise<{ lines: MeetingLine[]; failed: number; error?: string }> {
  const mic = await transcribeChunks(meta.id, (done, total) => onProgress?.(done, total, "mic"), engine);
  const lines: MeetingLine[] = mic.parts
    .filter((p) => p.text.trim())
    .map((p) => ({ id: `rec:${p.seq}`, t: segmentStart(p.seq), src: "mic" as const, speaker: MIC, text: p.text.trim() }));
  let failed = mic.failed;
  let error = mic.error;

  const windows = await remoteWindowsOf(meta);
  if (windows.length > 0 && engine === "local") {
    // No speaker identification offline: the participants' side comes out as one voice, "Participantes".
    const remote = await localWindows(windows, meta.startedAt, (done, total) => onProgress?.(done, total, "voices"));
    lines.push(...remote.lines);
    failed += remote.failed;
    error = remote.error ?? error;
  } else if (windows.length > 0) {
    const remote = await diarizeWindows(windows, meta.startedAt, (done, total) => onProgress?.(done, total, "voices"));
    lines.push(...remote.lines);
    failed += remote.failed;
    error = remote.error ?? error;
  }
  return { lines: sortLines(lines), failed, error };
}

async function localWindows(
  windowIds: string[],
  origin: number,
  onProgress?: (done: number, total: number) => void,
): Promise<{ lines: MeetingLine[]; failed: number; error?: string }> {
  const sessions = await listSessions();
  const lines: MeetingLine[] = [];
  let failed = 0;
  let error: string | undefined;
  for (let i = 0; i < windowIds.length; i++) {
    onProgress?.(i, windowIds.length);
    const chunks = await getChunks(windowIds[i]);
    if (chunks.length === 0) continue;
    const meta = sessions.find((s) => s.id === windowIds[i]);
    const offset = meta ? Math.max(0, (meta.startedAt - origin) / 1000) : i * 1200;
    try {
      const samples = await decodeMono16k(new Blob(chunks.map((c) => c.blob), { type: chunks[0].mime }));
      const found = await transcribeLocalSamples(samples);
      found.forEach((l, n) => lines.push({ id: `local:${i}:${n}`, t: offset + l.start, src: "remote", speaker: REMOTE, text: l.text }));
    } catch {
      failed++;
      error = "No se pudo transcribir el audio de los participantes en este navegador.";
    }
  }
  onProgress?.(windowIds.length, windowIds.length);
  return { lines, failed, error };
}

/** Removes a meeting's saved audio: its microphone session and every participants' window. */
export async function discardMeeting(meta: SessionMeta): Promise<void> {
  const windows = await remoteWindowsOf(meta);
  await Promise.all([deleteSession(meta.id), ...windows.map(deleteSession)]);
}
