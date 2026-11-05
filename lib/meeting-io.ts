import { deleteSession, listSessions, type SessionMeta } from "./audio-store";
import { diarizeWindows } from "./diarize";
import { MIC, sortLines, type MeetingLine } from "./meeting";
import { transcribeChunks } from "./useRecorder";

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
  onProgress?: (done: number, total: number) => void,
): Promise<{ lines: MeetingLine[]; failed: number; error?: string }> {
  const mic = await transcribeChunks(meta.id);
  const lines: MeetingLine[] = mic.parts
    .filter((p) => p.text.trim())
    .map((p) => ({ id: `rec:${p.seq}`, t: segmentStart(p.seq), src: "mic" as const, speaker: MIC, text: p.text.trim() }));
  let failed = mic.failed;
  let error = mic.error;

  const windows = await remoteWindowsOf(meta);
  if (windows.length > 0) {
    const remote = await diarizeWindows(windows, meta.startedAt, onProgress);
    lines.push(...remote.lines);
    failed += remote.failed;
    error = remote.error ?? error;
  }
  return { lines: sortLines(lines), failed, error };
}

/** Removes a meeting's saved audio: its microphone session and every participants' window. */
export async function discardMeeting(meta: SessionMeta): Promise<void> {
  const windows = await remoteWindowsOf(meta);
  await Promise.all([deleteSession(meta.id), ...windows.map(deleteSession)]);
}
