// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock("@/lib/supabase/env", () => ({ authEnabled: true }));
vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.user }));
import { POST as token } from "../app/api/realtime-token/route";
import { POST as diarize } from "../app/api/diarize/route";

const headers = { "x-hoja-client": "1", "sec-fetch-site": "same-origin" };

function tokenRequest(body: unknown = {}, opts: { client?: boolean } = {}) {
  return new Request("https://hoja.test/api/realtime-token", {
    method: "POST",
    body: JSON.stringify(body),
    headers: opts.client === false ? { "content-type": "application/json" } : { ...headers, "content-type": "application/json" },
  });
}

function diarizeRequest(extra: [string, string][] = [], size = 3000) {
  const form = new FormData();
  form.append("audio", new File([new Uint8Array(size)], "audio.webm", { type: "audio/webm" }));
  for (const [k, v] of extra) form.append(k, v);
  return new Request("https://hoja.test/api/diarize", { method: "POST", body: form, headers });
}

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  mocks.user.mockResolvedValue({ id: `u${Math.random()}` });
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/realtime-token", () => {
  it("rejects signed-out calls and calls from outside the app", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await token(tokenRequest())).status).toBe(401);
    mocks.user.mockResolvedValue({ id: "u1" });
    expect((await token(tokenRequest({}, { client: false }))).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns only the short-lived key, never the real one", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ value: "ek_temporal", expires_at: 1 }));
    const res = await token(tokenRequest({ glossary: "Marta Ruiz" }));
    expect(await res.json()).toEqual({ secret: "ek_temporal" });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("/v1/realtime/client_secrets");
    const sent = JSON.parse(String(init?.body));
    expect(sent.session.type).toBe("transcription");
    expect(sent.session.audio.input.transcription.language).toBe("es");
    expect(sent.session.audio.input.transcription.prompt).toContain("Marta Ruiz");
    expect(JSON.stringify(sent)).not.toContain("test-key");
  });

  it("limits how often keys can be minted", async () => {
    vi.mocked(fetch).mockImplementation(async () => Response.json({ value: "ek" }));
    mocks.user.mockResolvedValue({ id: "same-person" });
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await token(tokenRequest())).status);
    expect(statuses.slice(0, 6).every((s) => s === 200)).toBe(true);
    expect(statuses[7]).toBe(429);
  });

  it("reports an exhausted balance", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ error: { code: "insufficient_quota" } }, { status: 429 }));
    const res = await token(tokenRequest());
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/saldo/);
  });
});

describe("POST /api/diarize", () => {
  it("returns clean segments with speaker labels", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        segments: [
          { text: " Hola. ", speaker: "A", start: 0, end: 1 },
          { text: "  ", speaker: "B", start: 1, end: 2 },
          { text: "Listo.", speaker: "B", start: 2, end: 3 },
        ],
      }),
    );
    const res = await diarize(diarizeRequest());
    expect(await res.json()).toEqual({
      segments: [
        { text: "Hola.", speaker: "A", start: 0, end: 1 },
        { text: "Listo.", speaker: "B", start: 2, end: 3 },
      ],
    });
    const body = vi.mocked(fetch).mock.calls[0][1]?.body as FormData;
    expect(body.get("model")).toBe("gpt-4o-transcribe-diarize");
    expect(body.get("response_format")).toBe("diarized_json");
    expect(body.get("chunking_strategy")).toBe("auto");
  });

  it("passes voice samples through so a person keeps their label", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ segments: [] }));
    const sample = "data:audio/wav;base64,AAAA";
    await diarize(diarizeRequest([["known_speaker_names[]", "A"], ["known_speaker_references[]", sample]]));
    const body = vi.mocked(fetch).mock.calls[0][1]?.body as FormData;
    expect(body.getAll("known_speaker_names[]")).toEqual(["A"]);
    expect(body.getAll("known_speaker_references[]")).toEqual([sample]);
  });

  it("rejects mismatched or non-audio voice samples without calling the provider", async () => {
    expect((await diarize(diarizeRequest([["known_speaker_names[]", "A"]]))).status).toBe(400);
    expect((await diarize(diarizeRequest([["known_speaker_names[]", "A"], ["known_speaker_references[]", "http://evil"]]))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects signed-out calls", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await diarize(diarizeRequest())).status).toBe(401);
  });
});
