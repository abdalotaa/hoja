"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { deleteSession, getChunks, listSessions, saveChunk, saveSession, type SessionMeta } from "./audio-store";
import { joinParts, pickMime, tail } from "./transcript";

const SEGMENT_MS = 25_000;
const FIRST_SEGMENT_MS = 10_000; // the first text shows up sooner
const MIN_BYTES = 1_500;
const TRIES = 4;

type Sent = { ok: true; text: string } | { ok: false; fatal: boolean; error: string };

/** One audio chunk to text. Fatal errors (no session, no credit) are not worth retrying. */
async function sendChunk(blob: Blob, mime: string, context: string): Promise<Sent> {
  const form = new FormData();
  form.append("audio", new File([blob], mime.includes("mp4") ? "audio.mp4" : "audio.webm", { type: mime }));
  if (context) form.append("context", context);
  let res: Response;
  try {
    res = await fetch("/api/transcribe", { method: "POST", headers: { "X-Hoja-Client": "1" }, body: form });
  } catch {
    return { ok: false, fatal: false, error: "Sin conexión." };
  }
  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (res.ok && typeof data.text === "string") return { ok: true, text: data.text };
  const fatal = [401, 403, 413].includes(res.status) || data.error?.includes("saldo") === true;
  return { ok: false, fatal, error: data.error ?? "No se pudo transcribir." };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sendWithRetries(blob: Blob, mime: string, context: string): Promise<Sent> {
  let last: Sent = { ok: false, fatal: false, error: "No se pudo transcribir." };
  for (let i = 0; i < TRIES; i++) {
    last = await sendChunk(blob, mime, context);
    if (last.ok || last.fatal) return last;
    await sleep(1500 * 2 ** i);
  }
  return last;
}

/** Transcribes every saved chunk of a session that doesn't have text yet. Used to recover an interrupted recording. */
export async function transcribeStored(id: string): Promise<{ text: string; failed: number; error?: string }> {
  const chunks = await getChunks(id);
  let failed = 0;
  let error: string | undefined;
  const texts: string[] = [];
  for (const c of chunks) {
    if (c.text !== undefined) {
      texts.push(c.text);
      continue;
    }
    const sent = await sendWithRetries(c.blob, c.mime, tail(joinParts(texts)));
    if (sent.ok) {
      texts.push(sent.text);
      await saveChunk({ ...c, text: sent.text });
    } else {
      failed++;
      error = sent.error;
    }
  }
  return { text: joinParts(texts), failed, error };
}

export { deleteSession, listSessions, type SessionMeta };

const subscribeSupport = () => () => {};
const canRecord = () => typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
const noSupport = () => false;

/**
 * Records the microphone in short, self-contained segments and transcribes each on the server.
 * Every segment is stored in IndexedDB first, so a network or service error never loses what was said.
 */
export function useRecorder() {
  const supported = useSyncExternalStore(subscribeSupport, canRecord, noSupport);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [texts, setTexts] = useState<string[]>([]);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wanted = useRef(false);
  const session = useRef<SessionMeta | null>(null);
  const seq = useRef(0);
  const mime = useRef("audio/webm");
  const queue = useRef<Promise<void>>(Promise.resolve());
  const collected = useRef<string[]>([]);
  const failures = useRef(0);
  const lastError = useRef<string | null>(null);
  const lastSegment = useRef<Promise<void>>(Promise.resolve());
  const next = useRef<() => void>(() => {});

  const enqueue = useCallback((blob: Blob, n: number) => {
    const meta = session.current;
    if (!meta || blob.size < MIN_BYTES) return;
    setPending((p) => p + 1);
    queue.current = queue.current.then(async () => {
      await saveChunk({ session: meta.id, seq: n, blob, mime: mime.current });
      const sent = await sendWithRetries(blob, mime.current, tail(joinParts(collected.current)));
      if (sent.ok) {
        collected.current[n] = sent.text;
        setTexts([...collected.current]);
        await saveChunk({ session: meta.id, seq: n, blob, mime: mime.current, text: sent.text });
      } else {
        failures.current++;
        lastError.current = sent.error;
        setError(`${sent.error} El audio quedó guardado en este navegador.`);
      }
      setPending((p) => p - 1);
    });
  }, []);

  const startSegment = useCallback(() => {
    if (!stream.current) return;
    const parts: Blob[] = [];
    const r = new MediaRecorder(stream.current, { mimeType: mime.current });
    const n = seq.current++;
    recorder.current = r;
    lastSegment.current = new Promise<void>((done) => {
      r.ondataavailable = (e) => e.data.size && parts.push(e.data);
      r.onstop = () => {
        enqueue(new Blob(parts, { type: mime.current }), n);
        done();
      };
    });
    r.start();
    timer.current = setTimeout(() => {
      if (!wanted.current) return;
      // Start the next segment before closing this one so no speech falls in the gap.
      next.current();
      if (r.state !== "inactive") r.stop();
    }, n === 0 ? FIRST_SEGMENT_MS : SEGMENT_MS);
  }, [enqueue]);

  useEffect(() => {
    next.current = startSegment;
  }, [startSegment]);

  const start = useCallback(
    async (mode: "note" | "meeting") => {
      if (!supported) return false;
      setError(null);
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (e) {
        const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
        setError(denied ? "Permite el micrófono para grabar." : "No se encontró un micrófono.");
        return false;
      }
      mime.current = pickMime((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      session.current = { id: crypto.randomUUID(), mode, startedAt: Date.now() };
      await saveSession(session.current);
      seq.current = 0;
      collected.current = [];
      failures.current = 0;
      lastError.current = null;
      setTexts([]);
      setElapsed(0);
      wanted.current = true;
      startSegment();
      setRecording(true);
      return true;
    },
    [supported, startSegment],
  );

  /** Stops recording, waits for the last chunks, and returns the transcript. */
  const stop = useCallback(async () => {
    wanted.current = false;
    if (timer.current) clearTimeout(timer.current);
    const r = recorder.current;
    if (r && r.state !== "inactive") r.stop();
    await lastSegment.current;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setRecording(false);
    await queue.current;
    setError(null);
    return {
      id: session.current?.id ?? "",
      text: joinParts(collected.current),
      failed: failures.current,
      error: lastError.current ?? undefined,
    };
  }, []);

  // A permission or device error shown outside a recording clears itself.
  useEffect(() => {
    if (recording || !error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [recording, error]);

  useEffect(() => {
    if (!recording) return;
    const t0 = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      clearInterval(tick);
      window.removeEventListener("beforeunload", warn);
    };
  }, [recording]);

  useEffect(
    () => () => {
      wanted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return { supported, recording, elapsed, text: joinParts(texts), pending, error, start, stop };
}
