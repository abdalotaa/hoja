"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { backupContinuous, backupSegmented, type Backup } from "./audio-backup";
import { saveSession, type SessionMeta } from "./audio-store";
import { canTap, openTap, type Tap } from "./audio-tap";
import { dropEchoes, MIC, REMOTE, sortLines, type MeetingLine, type Source } from "./meeting";
import { connectRealtime, fetchSecret, type LiveState, type Realtime } from "./realtime";
import { pickMime } from "./transcript";
import { isNoise } from "./vocabulary";

/**
 * A live meeting: the microphone ("Tú") and, optionally, the audio of the call ("Participantes"), each streamed to a
 * live transcription session. Both are also recorded in this browser, so a dropped connection never loses the meeting.
 */

export interface StartOptions {
  mode: "note" | "meeting";
  /** Also capture the audio of the call: a browser tab, or the whole computer's sound where the system allows it. */
  remote: boolean;
  glossary: string;
}

export interface Finished {
  /** Id of the microphone session in the audio store. */
  id: string;
  origin: number;
  lines: MeetingLine[];
  /** Saved recordings of the participants, one id per 20-minute window. */
  windows: string[];
  /** True when live text may be incomplete (a source never connected or gave up). */
  incomplete: boolean;
}

export interface Status {
  state: LiveState;
  detail?: string;
}

interface Part {
  stream: MediaStream;
  tap: Tap;
  rt: Realtime;
}

const idle: Status = { state: "closed" };
/** Audio queued while a connection is down is replayed, but only up to a minute; past this much downtime the text is rebuilt from the saved audio. */
const MAX_DOWNTIME_MS = 45_000;
const subscribe = () => () => {};
const canMeet = () => canTap() && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
const never = () => false;

/** Capturing a call's sound needs a desktop browser that can share audio. */
export const canShareAudio = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
  !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function useMeeting() {
  const supported = useSyncExternalStore(subscribe, canMeet, never);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lines, setLines] = useState<MeetingLine[]>([]);
  const [partial, setPartial] = useState<Record<Source, string>>({ mic: "", remote: "" });
  const [levels, setLevels] = useState<Record<Source, number>>({ mic: 0, remote: 0 });
  const [status, setStatus] = useState<Record<Source, Status>>({ mic: idle, remote: idle });
  const [remoteOn, setRemoteOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parts = useRef<Partial<Record<Source, Part>>>({});
  const loud = useRef<Record<Source, number>>({ mic: 0, remote: 0 });
  const startedAt = useRef(0);
  const sessionId = useRef("");
  const micBackup = useRef<Backup<void> | null>(null);
  const remoteBackup = useRef<Backup<string[]> | null>(null);
  const collected = useRef<MeetingLine[]>([]);
  const failed = useRef<Record<Source, boolean>>({ mic: false, remote: false });
  const down = useRef<Record<Source, { since: number | null; total: number }>>({ mic: { since: null, total: 0 }, remote: { since: null, total: 0 } });
  const display = useRef<MediaStream | null>(null);

  const addLine = useCallback((line: MeetingLine) => {
    collected.current = [...collected.current, line];
    setLines(collected.current);
  }, []);

  /** Opens one source: tap the audio, stream it, and keep the connection alive. */
  const openSource = useCallback(
    async (src: Source, stream: MediaStream, glossary: string) => {
      const rt = connectRealtime({
        startedAt: startedAt.current,
        getSecret: () => fetchSecret(glossary),
        onPartial: (text) => setPartial((p) => ({ ...p, [src]: text })),
        onTurn: (turn) =>
          !isNoise(turn.text, glossary) &&
          addLine({ id: `${src}:${turn.id}`, t: turn.t, src, speaker: src === "mic" ? MIC : REMOTE, text: turn.text }),
        onState: (state, detail) => {
          if (state === "failed") failed.current[src] = true;
          const d = down.current[src];
          if (state === "live" && d.since !== null) {
            d.total += Date.now() - d.since;
            d.since = null;
          } else if ((state === "connecting" || state === "reconnecting" || state === "failed") && d.since === null) {
            d.since = Date.now();
          }
          setStatus((s) => ({ ...s, [src]: { state, detail } }));
        },
      });
      const tap = await openTap(stream, (pcm, loudness) => {
        loud.current[src] = Math.max(loud.current[src] * 0.8, loudness);
        rt.send(pcm);
      });
      parts.current[src] = { stream, tap, rt };
    },
    [addLine],
  );

  const releaseAll = useCallback(() => {
    for (const p of Object.values(parts.current)) {
      p?.tap.close();
      p?.rt.close();
      p?.stream.getTracks().forEach((t) => t.stop());
    }
    parts.current = {};
    display.current?.getTracks().forEach((t) => t.stop());
    display.current = null;
  }, []);

  const start = useCallback(
    async (opts: StartOptions) => {
      if (!supported) return false;
      setError(null);

      let mic: MediaStream;
      try {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (e) {
        const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
        setError(denied ? "Permite el micrófono para grabar." : "No se encontró un micrófono.");
        return false;
      }

      let shared: MediaStream | null = null;
      if (opts.remote) {
        try {
          // The video track is required by browsers to offer "share audio"; it is never read.
          const request: DisplayMediaStreamOptions & { systemAudio?: string } = {
            video: true,
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
            systemAudio: "include",
          };
          shared = await navigator.mediaDevices.getDisplayMedia(request);
        } catch {
          mic.getTracks().forEach((t) => t.stop());
          setError("No se compartió la pantalla. Elige la pestaña de Zoom (o «Toda la pantalla») y activa «Compartir audio».");
          return false;
        }
        if (shared.getAudioTracks().length === 0) {
          shared.getTracks().forEach((t) => t.stop());
          mic.getTracks().forEach((t) => t.stop());
          setError("No llegó audio de la llamada. Al compartir, activa «Compartir audio de la pestaña» o «Compartir audio del sistema».");
          return false;
        }
        display.current = shared;
      }

      startedAt.current = Date.now();
      sessionId.current = crypto.randomUUID();
      collected.current = [];
      failed.current = { mic: false, remote: false };
      down.current = { mic: { since: null, total: 0 }, remote: { since: null, total: 0 } };
      loud.current = { mic: 0, remote: 0 };
      setLines([]);
      setPartial({ mic: "", remote: "" });
      setStatus({ mic: { state: "connecting" }, remote: shared ? { state: "connecting" } : idle });
      setElapsed(0);

      const mime = pickMime((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const meta: SessionMeta = { id: sessionId.current, mode: opts.mode, startedAt: startedAt.current };
      await saveSession(meta);

      try {
        await openSource("mic", mic, opts.glossary);
        micBackup.current = backupSegmented(mic, mime, meta.id);
        if (shared) {
          const audio = new MediaStream(shared.getAudioTracks());
          await openSource("remote", audio, opts.glossary);
          remoteBackup.current = backupContinuous(audio, mime, startedAt.current);
          // Stopping the share from the browser's own bar ends the participants' side but not the meeting.
          shared.getAudioTracks()[0].addEventListener("ended", () => {
            setStatus((s) => ({ ...s, remote: { state: "closed", detail: "Se dejó de compartir el audio." } }));
          });
        }
      } catch {
        releaseAll();
        mic.getTracks().forEach((t) => t.stop());
        micBackup.current = null;
        remoteBackup.current = null;
        setError("Tu navegador no pudo abrir el audio en vivo.");
        return false;
      }

      setRemoteOn(Boolean(shared));
      setRecording(true);
      return true;
    },
    [supported, openSource, releaseAll],
  );

  const stop = useCallback(async (): Promise<Finished> => {
    const windows = (await remoteBackup.current?.stop()) ?? [];
    await micBackup.current?.stop();
    remoteBackup.current = null;
    micBackup.current = null;
    // Let the last audio reach the live sessions, then ask each for the text of the turn in progress.
    await new Promise((r) => setTimeout(r, 400));
    await Promise.all(Object.values(parts.current).map((p) => p?.rt.finish()));
    const incomplete = () =>
      (["mic", "remote"] as Source[]).some((src) => {
        if (!parts.current[src]) return false;
        const d = down.current[src];
        return failed.current[src] || d.total + (d.since !== null ? Date.now() - d.since : 0) > MAX_DOWNTIME_MS;
      });
    const gaps = incomplete();
    releaseAll();
    setRecording(false);
    setRemoteOn(false);
    setPartial({ mic: "", remote: "" });
    return {
      id: sessionId.current,
      origin: startedAt.current,
      lines: dropEchoes(sortLines(collected.current)),
      windows,
      incomplete: gaps,
    };
  }, [releaseAll]);

  useEffect(() => {
    if (!recording) return;
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 500);
    const meter = setInterval(() => setLevels({ mic: loud.current.mic, remote: loud.current.remote }), 150);
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      clearInterval(tick);
      clearInterval(meter);
      window.removeEventListener("beforeunload", warn);
    };
  }, [recording]);

  useEffect(() => {
    if (recording || !error) return;
    const t = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(t);
  }, [recording, error]);

  useEffect(() => releaseAll, [releaseAll]);

  const shown = useMemo(() => dropEchoes(sortLines(lines)), [lines]);
  return { supported, recording, remoteOn, elapsed, lines: shown, partial, levels, status, error, start, stop };
}
