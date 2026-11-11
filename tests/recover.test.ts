import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ chunks: [] as { session: string; seq: number; blob: Blob; mime: string; text?: string }[], saved: vi.fn() }));
vi.mock("../lib/audio-store", () => ({
  getChunks: async () => store.chunks,
  saveChunk: store.saved,
  saveSession: vi.fn(),
  listSessions: async () => [],
  deleteSession: vi.fn(),
}));
import { transcribeChunks } from "../lib/useRecorder";

const chunk = (seq: number, text?: string) => ({ session: "s", seq, blob: new Blob(["x"]), mime: "audio/webm", text });

beforeEach(() => {
  store.saved.mockReset();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe("transcribeChunks", () => {
  it("reports progress and skips chunks that already have text", async () => {
    store.chunks = [chunk(0, "ya está"), chunk(1), chunk(2)];
    vi.mocked(fetch).mockImplementation(async () => Response.json({ text: "nuevo" }));
    const seen: [number, number][] = [];
    const r = await transcribeChunks("s", (done, total) => seen.push([done, total]));
    expect(r.failed).toBe(0);
    expect(r.parts.map((p) => p.text)).toEqual(["ya está", "nuevo", "nuevo"]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(seen[0]).toEqual([0, 3]);
    expect(seen.at(-1)).toEqual([3, 3]);
  });

  it("stops at the first fatal error instead of asking for every remaining chunk", async () => {
    store.chunks = [chunk(0), chunk(1), chunk(2), chunk(3)];
    vi.mocked(fetch).mockImplementation(async () => Response.json({ error: "Inicia sesión para transcribir." }, { status: 401 }));
    const r = await transcribeChunks("s");
    expect(r.failed).toBe(1);
    expect(r.error).toMatch(/Inicia sesión/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives every request a time limit so a silent server cannot hang the recovery", async () => {
    store.chunks = [chunk(0)];
    vi.mocked(fetch).mockImplementation(async () => Response.json({ text: "hola" }));
    await transcribeChunks("s");
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("transcribeChunks with rate limits", () => {
  it("waits and retries a chunk that was rejected for going too fast", async () => {
    vi.useFakeTimers();
    store.chunks = [chunk(0)];
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ error: "Demasiados audios seguidos. Intenta en un momento." }, { status: 429 }))
      .mockResolvedValue(Response.json({ text: "listo" }));
    const done = transcribeChunks("s");
    await vi.runAllTimersAsync();
    const r = await done;
    vi.useRealTimers();
    expect(r.failed).toBe(0);
    expect(r.parts[0].text).toBe("listo");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

vi.mock("../lib/local-whisper", () => ({ transcribeLocalBlob: vi.fn(async () => "texto local"), transcribeLocalSamples: vi.fn(), onLocalStatus: vi.fn(), localSupported: () => true }));

describe("transcribeChunks with the local engine", () => {
  it("never calls the server and saves the text it produced", async () => {
    store.chunks = [chunk(0), chunk(1, "ya estaba")];
    const r = await transcribeChunks("s", undefined, "local");
    expect(fetch).not.toHaveBeenCalled();
    expect(r.failed).toBe(0);
    expect(r.parts.map((p) => p.text)).toEqual(["texto local", "ya estaba"]);
    expect(store.saved).toHaveBeenCalledTimes(1);
  });
});
