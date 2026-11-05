/** Audio helpers for live transcription: browser audio (any sample rate, floats) to 24 kHz 16-bit PCM. */

export const TARGET_RATE = 24_000;

/** Linear resampler that keeps its place between blocks, so there are no clicks at block boundaries. */
export class Resampler {
  private pos = 0;
  private prev = 0;
  private readonly step: number;

  constructor(from: number, to: number = TARGET_RATE) {
    this.step = from / to;
  }

  process(input: Float32Array): Float32Array {
    if (input.length === 0) return new Float32Array(0);
    if (this.step === 1) {
      this.prev = input[input.length - 1];
      return input;
    }
    const out: number[] = [];
    // pos is relative to the start of this block; -1 means "the last sample of the previous block".
    while (Math.floor(this.pos) + 1 < input.length) {
      const i = Math.floor(this.pos);
      const frac = this.pos - i;
      const a = i < 0 ? this.prev : input[i];
      out.push(a + (input[i + 1] - a) * frac);
      this.pos += this.step;
    }
    this.pos -= input.length;
    this.prev = input[input.length - 1];
    return Float32Array.from(out);
  }
}

export function toPcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

export function pcmToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Loudness of a block, 0 to 1, for the level meter. */
export function level(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
}
