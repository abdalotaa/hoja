import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectRealtime, type LiveState, type Turn } from "../lib/realtime";

class FakeSocket {
  static all: FakeSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  sent: { type: string; audio?: string }[] = [];
  protocols: string[];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(
    public url: string,
    protocols: string[],
  ) {
    this.protocols = protocols;
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  say(event: object) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const flush = async () => {
  await vi.advanceTimersByTimeAsync(0);
};

function setup() {
  const turns: Turn[] = [];
  const states: LiveState[] = [];
  const getSecret = vi.fn().mockResolvedValue("ek_test");
  const rt = connectRealtime({
    getSecret,
    startedAt: Date.now(),
    onPartial: () => {},
    onTurn: (t) => turns.push(t),
    onState: (s) => states.push(s),
  });
  return { rt, turns, states, getSecret };
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.all = [];
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const block = () => new Int16Array(2400);

describe("live transcription connection", () => {
  it("connects with the short-lived key as a subprotocol and streams audio", async () => {
    const { rt } = setup();
    await flush();
    const ws = FakeSocket.all[0];
    expect(ws.protocols).toEqual(["realtime", "openai-insecure-api-key.ek_test"]);
    ws.open();
    rt.send(block());
    expect(ws.sent[0].type).toBe("input_audio_buffer.append");
    rt.close();
  });

  it("turns finished transcriptions into timed lines", async () => {
    const { rt, turns } = setup();
    await flush();
    const ws = FakeSocket.all[0];
    ws.open();
    await vi.advanceTimersByTimeAsync(2000);
    ws.say({ type: "input_audio_buffer.speech_started" });
    ws.say({ type: "input_audio_buffer.committed", item_id: "i1" });
    ws.say({ type: "conversation.item.input_audio_transcription.completed", item_id: "i1", transcript: " Hola equipo. " });
    expect(turns).toHaveLength(1);
    expect(turns[0].text).toBe("Hola equipo.");
    expect(turns[0].t).toBeCloseTo(2, 0);
    rt.close();
  });

  it("forces a turn to close when someone talks without a pause", async () => {
    const { rt } = setup();
    await flush();
    const ws = FakeSocket.all[0];
    ws.open();
    ws.say({ type: "input_audio_buffer.speech_started" });
    await vi.advanceTimersByTimeAsync(11_000);
    expect(ws.sent.some((m) => m.type === "input_audio_buffer.commit")).toBe(false);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(ws.sent.filter((m) => m.type === "input_audio_buffer.commit")).toHaveLength(1);
    rt.close();
  });

  it("keeps the audio while disconnected and replays it after reconnecting", async () => {
    const { rt, states, getSecret } = setup();
    await flush();
    const first = FakeSocket.all[0];
    first.open();
    first.drop();
    rt.send(block());
    rt.send(block());
    expect(states).toContain("reconnecting");
    await vi.advanceTimersByTimeAsync(1000);
    expect(getSecret).toHaveBeenCalledTimes(2);
    const second = FakeSocket.all[1];
    second.open();
    expect(second.sent.filter((m) => m.type === "input_audio_buffer.append")).toHaveLength(2);
    rt.close();
  });

  it("gives up after repeated failures and says so", async () => {
    const turns: Turn[] = [];
    const states: LiveState[] = [];
    const rt = connectRealtime({
      getSecret: vi.fn().mockRejectedValue(new Error("Sin conexión.")),
      startedAt: Date.now(),
      onPartial: () => {},
      onTurn: (t) => turns.push(t),
      onState: (s) => states.push(s),
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(states.at(-1)).toBe("failed");
    rt.close();
  });
});
