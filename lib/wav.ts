/** Decoding and cutting audio in the browser: any file to 16 kHz mono floats, and short WAV pieces back out. */

export const RATE = 16_000;

/** Decodes at 16 kHz right away, which also keeps a long recording small in memory. */
export async function decodeMono16k(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: RATE });
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    if (buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice();
    const out = new Float32Array(buffer.length);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < out.length; i++) out[i] += data[i] / buffer.numberOfChannels;
    }
    return out;
  } finally {
    void ctx.close().catch(() => {});
  }
}

export function encodeWav(samples: Float32Array, from = 0, to = samples.length): Blob {
  const n = Math.max(0, to - from);
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[from + i]));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** The quietest 100 ms between two sample positions: a good place to cut without splitting a word. */
export function quietCut(samples: Float32Array, from: number, to: number): number {
  const frame = Math.floor(RATE / 10);
  let best = to;
  let bestEnergy = Infinity;
  for (let start = from; start + frame <= to; start += frame / 2) {
    let energy = 0;
    for (let i = start; i < start + frame; i++) energy += samples[i] * samples[i];
    if (energy < bestEnergy) {
      bestEnergy = energy;
      best = start + frame / 2;
    }
  }
  return Math.floor(best);
}

export function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
