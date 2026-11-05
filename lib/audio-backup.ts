import { saveChunk, saveSession } from "./audio-store";

/** Keeps the audio of a live meeting in this browser while it is transcribed, so nothing depends on the connection. */

const MIN_BYTES = 1_500;
const FIRST_SEGMENT_MS = 10_000;
const SEGMENT_MS = 25_000;
export const WINDOW_MS = 20 * 60_000;
const SLICE_MS = 5_000;
const REMOTE_BITRATE = 20_000;

export interface Backup<T> {
  stop: () => Promise<T>;
}

/** Self-contained segments (like the plain recorder), so a failed session can be transcribed chunk by chunk. */
export function backupSegmented(stream: MediaStream, mime: string, session: string): Backup<void> {
  let seq = 0;
  let wanted = true;
  let current: MediaRecorder | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let saves: Promise<unknown> = Promise.resolve();

  const next = () => {
    const parts: Blob[] = [];
    const n = seq++;
    const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    current = r;
    r.ondataavailable = (e) => e.data.size && parts.push(e.data);
    r.onstop = () => {
      const blob = new Blob(parts, { type: mime });
      if (blob.size >= MIN_BYTES) saves = saves.then(() => saveChunk({ session, seq: n, blob, mime }));
    };
    r.start();
    timer = setTimeout(() => {
      if (!wanted) return;
      // Start the next segment before closing this one so no speech falls in the gap.
      next();
      if (r.state !== "inactive") r.stop();
    }, n === 0 ? FIRST_SEGMENT_MS : SEGMENT_MS);
  };
  next();

  return {
    stop: async () => {
      wanted = false;
      clearTimeout(timer);
      const r = current;
      if (r && r.state !== "inactive") {
        await new Promise<void>((done) => {
          const prev = r.onstop;
          r.onstop = (e) => {
            prev?.call(r, e);
            done();
          };
          r.stop();
        });
      }
      await saves;
    },
  };
}

/**
 * One continuous low-bitrate recording of the participants, cut into windows of 20 minutes. Every slice is saved as it
 * arrives, and slices of a window join into one playable file, which is what speaker identification needs.
 */
export function backupContinuous(stream: MediaStream, mime: string, origin: number): Backup<string[]> {
  const windows: string[] = [];
  let wanted = true;
  let current: MediaRecorder | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let saves: Promise<unknown> = Promise.resolve();

  const openWindow = () => {
    const w = windows.length;
    const id = `${origin}:r${w}`;
    windows.push(id);
    saves = saves.then(() => saveSession({ id, mode: "remote", startedAt: Date.now(), origin }));
    let seq = 0;
    const r = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: REMOTE_BITRATE });
    current = r;
    r.ondataavailable = (e) => {
      if (!e.data.size) return;
      const n = seq++;
      saves = saves.then(() => saveChunk({ session: id, seq: n, blob: e.data, mime }));
    };
    r.start(SLICE_MS);
    timer = setTimeout(() => {
      if (!wanted) return;
      r.stop();
      openWindow();
    }, WINDOW_MS);
  };
  openWindow();

  return {
    stop: async () => {
      wanted = false;
      clearTimeout(timer);
      const r = current;
      if (r && r.state !== "inactive") {
        await new Promise<void>((done) => {
          r.addEventListener("stop", () => done(), { once: true });
          r.stop();
        });
      }
      await saves;
      return windows;
    },
  };
}
