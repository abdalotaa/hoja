import { pcmToBase64, TARGET_RATE } from "./pcm";

/**
 * One live transcription connection to OpenAI, opened with a short-lived key from our server.
 * Text arrives one spoken turn at a time. Audio sent while the connection is down is queued and replayed.
 */

const WS_URL = "wss://api.openai.com/v1/realtime?intent=transcription";
const FORCE_COMMIT_MS = 12_000; // someone talking without a pause still gets text this often
const MAX_QUEUE_SECONDS = 60;
const RETRIES = 6;
const SESSION_REFRESH_MS = 50 * 60_000; // sessions are capped near an hour; renew before that

export type LiveState = "connecting" | "live" | "reconnecting" | "closed" | "failed";

export interface Turn {
  id: string;
  /** Seconds since the meeting started, when the person began speaking. */
  t: number;
  text: string;
}

export interface RealtimeOptions {
  getSecret: () => Promise<string>;
  /** Milliseconds timestamp of the meeting start, so every source shares one clock. */
  startedAt: number;
  onPartial: (text: string) => void;
  onTurn: (turn: Turn) => void;
  onState: (state: LiveState, detail?: string) => void;
}

export interface Realtime {
  send: (pcm: Int16Array) => void;
  /** Closes the audio turn in progress and waits (briefly) for the last text. */
  finish: () => Promise<void>;
  close: () => void;
}

export function connectRealtime(opts: RealtimeOptions): Realtime {
  let ws: WebSocket | null = null;
  let wanted = true;
  let attempts = 0;
  let queue: Int16Array[] = [];
  let queued = 0;
  let speaking = false;
  let speechAt = 0;
  let heardSinceCommit = false;
  let pending = 0;
  const starts: number[] = [];
  const turnStart = new Map<string, number>();
  const partial = new Map<string, string>();
  let refresh: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let idle: (() => void) | null = null;

  const now = () => (Date.now() - opts.startedAt) / 1000;
  const open = () => ws !== null && ws.readyState === WebSocket.OPEN;
  const emit = (state: LiveState, detail?: string) => opts.onState(state, detail);

  const transmit = (pcm: Int16Array) => {
    ws?.send(JSON.stringify({ type: "input_audio_buffer.append", audio: pcmToBase64(pcm) }));
    heardSinceCommit = true;
  };

  const enqueue = (pcm: Int16Array) => {
    queue.push(pcm);
    queued += pcm.length;
    while (queued > MAX_QUEUE_SECONDS * TARGET_RATE && queue.length > 1) queued -= queue.shift()!.length;
  };

  const settled = () => {
    if (pending <= 0 && idle) {
      idle();
      idle = null;
    }
  };

  const handle = (raw: string) => {
    let e: { type?: string; item_id?: string; delta?: string; transcript?: string; error?: { message?: string; code?: string } };
    try {
      e = JSON.parse(raw);
    } catch {
      return;
    }
    switch (e.type) {
      case "input_audio_buffer.speech_started":
        speaking = true;
        speechAt = Date.now();
        starts.push(now());
        break;
      case "input_audio_buffer.speech_stopped":
        speaking = false;
        break;
      case "input_audio_buffer.committed":
        heardSinceCommit = false;
        pending++;
        if (e.item_id) turnStart.set(e.item_id, starts.shift() ?? now());
        break;
      case "conversation.item.input_audio_transcription.delta":
        if (e.item_id && e.delta) {
          partial.set(e.item_id, (partial.get(e.item_id) ?? "") + e.delta);
          opts.onPartial([...partial.values()].join(" ").trim());
        }
        break;
      case "conversation.item.input_audio_transcription.completed": {
        pending = Math.max(0, pending - 1);
        const id = e.item_id ?? crypto.randomUUID();
        partial.delete(id);
        opts.onPartial([...partial.values()].join(" ").trim());
        const text = (e.transcript ?? "").trim();
        if (text) opts.onTurn({ id, t: turnStart.get(id) ?? now(), text });
        turnStart.delete(id);
        settled();
        break;
      }
      case "conversation.item.input_audio_transcription.failed":
        pending = Math.max(0, pending - 1);
        settled();
        break;
      case "error":
        // Committing a buffer with almost no audio is harmless; anything else is worth knowing.
        if (e.error?.code !== "input_audio_buffer_commit_empty") emit("live", e.error?.message);
        break;
    }
  };

  const connect = async () => {
    emit(attempts === 0 ? "connecting" : "reconnecting");
    let secret: string;
    try {
      secret = await opts.getSecret();
    } catch (err) {
      return retry(err instanceof Error ? err.message : "No se pudo conectar.", err instanceof FatalError);
    }
    if (!wanted) return;
    const socket = new WebSocket(WS_URL, ["realtime", `openai-insecure-api-key.${secret}`]);
    ws = socket;
    socket.onopen = () => {
      attempts = 0;
      speaking = false;
      starts.length = 0;
      pending = 0;
      for (const block of queue) transmit(block);
      queue = [];
      queued = 0;
      emit("live");
      clearTimeout(refresh);
      refresh = setTimeout(() => socket.close(4000, "refresh"), SESSION_REFRESH_MS);
    };
    socket.onmessage = (m) => handle(String(m.data));
    socket.onclose = () => {
      if (ws === socket) ws = null;
      clearTimeout(refresh);
      if (wanted) retry("Se cortó la conexión.");
    };
    socket.onerror = () => {};
  };

  const retry = (why: string, fatal = false) => {
    if (!wanted) return;
    if (fatal || attempts >= RETRIES) {
      wanted = false;
      emit("failed", why);
      settled();
      return;
    }
    attempts++;
    emit("reconnecting", why);
    retryTimer = setTimeout(() => void connect(), Math.min(8000, 700 * 2 ** (attempts - 1)));
  };

  // Without a pause the server never closes the turn, so long stretches of talking would show no text.
  const watchdog = setInterval(() => {
    if (open() && speaking && Date.now() - speechAt > FORCE_COMMIT_MS) {
      speechAt = Date.now();
      ws!.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    }
  }, 1000);

  void connect();

  return {
    send: (pcm) => {
      if (!wanted) return;
      if (open()) transmit(pcm);
      else enqueue(pcm);
    },
    finish: () =>
      new Promise<void>((resolve) => {
        if (!open()) return resolve();
        if (heardSinceCommit) ws!.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        const done = () => {
          clearTimeout(timeout);
          resolve();
        };
        const timeout = setTimeout(done, 6000);
        idle = done;
        // The commit's reply increments pending; give it a moment before checking.
        setTimeout(settled, 700);
      }),
    close: () => {
      wanted = false;
      clearInterval(watchdog);
      clearTimeout(refresh);
      clearTimeout(retryTimer);
      ws?.close(1000);
      ws = null;
      emit("closed");
      settled();
    },
  };
}

export class FatalError extends Error {}

/** Asks our server for a short-lived key. A missing session or credit is not worth retrying. */
export async function fetchSecret(glossary: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/realtime-token", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hoja-Client": "1" },
      body: JSON.stringify({ glossary }),
    });
  } catch {
    throw new Error("Sin conexión.");
  }
  const data = (await res.json().catch(() => ({}))) as { secret?: string; error?: string };
  if (res.ok && typeof data.secret === "string") return data.secret;
  const message = data.error ?? "No se pudo iniciar la transcripción en vivo.";
  if ([401, 403, 500].includes(res.status) || message.includes("saldo")) throw new FatalError(message);
  throw new Error(message);
}
