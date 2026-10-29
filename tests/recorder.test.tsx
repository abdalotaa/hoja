import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ chunks: new Map<string, { text?: string }>() }));
vi.mock("@/lib/audio-store", () => ({
  saveSession: vi.fn(async () => undefined),
  saveChunk: vi.fn(async (c: { session: string; seq: number; text?: string }) => {
    store.chunks.set(`${c.session}:${c.seq}`, { text: c.text });
  }),
  getChunks: vi.fn(async () => []),
  listSessions: vi.fn(async () => []),
  deleteSession: vi.fn(async () => undefined),
}));
import { useRecorder } from "../lib/useRecorder";

class FakeRecorder {
  static isTypeSupported = () => true;
  state = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob([new Uint8Array(4000)]) });
    this.onstop?.();
  }
}

beforeEach(() => {
  store.chunks.clear();
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
  });
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

async function record(h: ReturnType<typeof renderHook<ReturnType<typeof useRecorder>, unknown>>) {
  await act(async () => { await h.result.current.start("meeting"); });
  let out: Awaited<ReturnType<ReturnType<typeof useRecorder>["stop"]>> | undefined;
  await act(async () => { out = await h.result.current.stop(); });
  return out!;
}

describe("useRecorder", () => {
  it("returns the transcript of a recording", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ text: "Hola equipo." }));
    const out = await record(renderHook(() => useRecorder()));
    expect(out.text).toBe("Hola equipo.");
    expect(out.failed).toBe(0);
  });

  it("keeps the audio and reports the failure when the service rejects it", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ error: "Inicia sesión para transcribir." }, { status: 401 }));
    const out = await record(renderHook(() => useRecorder()));
    expect(out.text).toBe("");
    expect(out.failed).toBe(1);
    expect(out.error).toMatch(/Inicia sesión/);
    expect(store.chunks.size).toBe(1); // the chunk was stored before the upload was attempted
  });

  it("retries a dropped connection instead of losing the chunk", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("offline")).mockResolvedValue(Response.json({ text: "Sigue la reunión." }));
    const h = renderHook(() => useRecorder());
    await act(async () => { await h.result.current.start("meeting"); });
    let out: Awaited<ReturnType<ReturnType<typeof useRecorder>["stop"]>> | undefined;
    await act(async () => {
      const done = h.result.current.stop().then((r) => { out = r; });
      await vi.advanceTimersByTimeAsync(2000);
      await done;
    });
    expect(out?.text).toBe("Sigue la reunión.");
    expect(out?.failed).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
