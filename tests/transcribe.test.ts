// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock("@/lib/supabase/env", () => ({ authEnabled: true }));
vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.user }));
import { POST } from "../app/api/transcribe/route";
import { joinParts, pickMime, tail } from "../lib/transcript";

function audioRequest(opts: { client?: boolean; size?: number; type?: string } = {}) {
  const form = new FormData();
  form.append("audio", new File([new Uint8Array(opts.size ?? 3000)], "audio.webm", { type: "audio/webm" }));
  form.append("context", "hola");
  const req = new Request("https://hoja.test/api/transcribe", {
    method: "POST",
    body: form,
    headers: opts.client === false ? {} : { "x-hoja-client": "1", "sec-fetch-site": "same-origin" },
  });
  return req;
}

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  mocks.user.mockResolvedValue({ id: `u${Math.random()}` });
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("POST /api/transcribe", () => {
  it("rejects signed-out calls without touching the provider", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await POST(audioRequest())).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects requests that don't come from the app", async () => {
    expect((await POST(audioRequest({ client: false }))).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("returns the transcript text", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ text: " Hola equipo. " }));
    const res = await POST(audioRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "Hola equipo." });
    const body = vi.mocked(fetch).mock.calls[0][1]?.body as FormData;
    expect(body.get("language")).toBe("es");
    expect(body.get("prompt")).toBe("hola");
  });
  it("falls back to whisper-1 when the default model is unavailable", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: {} }, { status: 404 })).mockResolvedValueOnce(Response.json({ text: "ok" }));
    expect((await POST(audioRequest())).status).toBe(200);
    expect((vi.mocked(fetch).mock.calls[1][1]?.body as FormData).get("model")).toBe("whisper-1");
  });
  it("reports an exhausted OpenAI balance", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ error: { code: "insufficient_quota" } }, { status: 429 }));
    const res = await POST(audioRequest());
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/saldo/);
  });
});

describe("transcript helpers", () => {
  it("joins chunks in order and skips empty ones", () => {
    expect(joinParts(["Hola", undefined, " ", " mundo "])).toBe("Hola mundo");
  });
  it("keeps only the tail as context", () => {
    expect(tail("abcdef", 3)).toBe("def");
    expect(tail("ab", 3)).toBe("ab");
  });
  it("prefers webm/opus and falls back", () => {
    expect(pickMime(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickMime((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickMime(() => false)).toBeUndefined();
  });
});
