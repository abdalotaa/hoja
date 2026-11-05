import { level, pcmToBase64, Resampler, toPcm16 } from "./pcm";

/** Taps a MediaStream and hands out 24 kHz PCM16 blocks plus a loudness reading. Needs AudioWorklet. */

const WORKLET = `
class Tap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(2048); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i];
      if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0)); this.n = 0; }
    }
    return true;
  }
}
registerProcessor("hoja-tap", Tap);
`;

export const canTap = () =>
  typeof AudioContext !== "undefined" && typeof AudioWorkletNode !== "undefined" && typeof WebSocket !== "undefined";

export interface Tap {
  close: () => void;
}

export async function openTap(stream: MediaStream, onBlock: (pcm: Int16Array, loudness: number) => void): Promise<Tap> {
  const ctx = new AudioContext();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
  try {
    await ctx.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});

  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "hoja-tap");
  const resampler = new Resampler(ctx.sampleRate);
  node.port.onmessage = (e: MessageEvent<Float32Array>) => {
    const block = e.data;
    onBlock(toPcm16(resampler.process(block)), level(block));
  };
  // Connected to a muted gain so the browser keeps pulling audio without playing it back (that would echo).
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(node);
  node.connect(mute);
  mute.connect(ctx.destination);

  return {
    close: () => {
      node.port.onmessage = null;
      try {
        source.disconnect();
        node.disconnect();
        mute.disconnect();
      } catch {
        // already disconnected
      }
      void ctx.close().catch(() => {});
    },
  };
}

export { pcmToBase64 };
