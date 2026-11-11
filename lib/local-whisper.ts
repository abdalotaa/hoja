import { isNoise } from "./vocabulary";
import { decodeMono16k, RATE } from "./wav";

/**
 * Speech to text that runs inside the browser (Whisper through transformers.js), so it costs nothing and the audio
 * never leaves the computer. The model (~250 MB) is downloaded once and kept by the browser.
 */

const MODEL = "onnx-community/whisper-small";

export interface LocalLine {
  /** Seconds from the start of the audio. */
  start: number;
  text: string;
}

type Listener = (message: string) => void;
let listener: Listener | null = null;

/** Receives short status texts ("Descargando el modelo… 42%") while the model loads. */
export const onLocalStatus = (fn: Listener | null) => {
  listener = fn;
};

// The pipeline's type is huge and only needed here, so it stays loose.
type Asr = (audio: Float32Array, options: Record<string, unknown>) => Promise<{ text: string; chunks?: { timestamp: [number, number | null]; text: string }[] }>;
let loading: Promise<Asr> | null = null;

export const localSupported = () => typeof WebAssembly !== "undefined" && typeof AudioContext !== "undefined";

async function load(): Promise<Asr> {
  const { pipeline, env } = await import("@huggingface/transformers");
  env.allowLocalModels = false;
  const gpu = typeof navigator !== "undefined" && "gpu" in navigator;
  const files = new Map<string, { loaded: number; total: number }>();
  const progress = (p: { status?: string; file?: string; loaded?: number; total?: number }) => {
    if (p.status !== "progress" || !p.file || !p.total) return;
    files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    listener?.(`Descargando el modelo de voz (solo la primera vez)… ${Math.round((loaded / total) * 100)}%`);
  };
  const make = (device: "webgpu" | "wasm") =>
    pipeline("automatic-speech-recognition", MODEL, {
      device,
      dtype: device === "webgpu" ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8",
      progress_callback: progress,
    });
  try {
    return (await make(gpu ? "webgpu" : "wasm")) as unknown as Asr;
  } catch (e) {
    if (!gpu) throw e;
    return (await make("wasm")) as unknown as Asr; // some graphics drivers refuse; the processor always works
  }
}

function model(): Promise<Asr> {
  loading ??= load().catch((e) => {
    loading = null; // let the next try start over instead of caching the failure
    throw e;
  });
  return loading;
}

/** Text of one recording, cut into timed lines. Works for a short chunk or a window of 20 minutes. */
export async function transcribeLocalSamples(samples: Float32Array): Promise<LocalLine[]> {
  const asr = await model();
  listener?.("Transcribiendo en este navegador…");
  const out = await asr(samples, {
    language: "spanish",
    task: "transcribe",
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
  });
  const lines = (out.chunks?.length ? out.chunks : [{ timestamp: [0, null] as [number, null], text: out.text }])
    .map((c) => ({ start: c.timestamp[0] ?? 0, text: c.text.trim() }))
    .filter((l) => l.text && !isNoise(l.text));
  return lines;
}

/** The text of one saved audio chunk. */
export async function transcribeLocalBlob(blob: Blob): Promise<string> {
  const samples = await decodeMono16k(blob);
  if (samples.length < RATE / 2) return "";
  const lines = await transcribeLocalSamples(samples);
  return lines.map((l) => l.text).join(" ");
}
