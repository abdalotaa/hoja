import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), user: vi.fn(), guard: vi.fn() }));
vi.mock("@/lib/supabase/env", () => ({ authEnabled: true }));
vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.user, getServerClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/guards", () => ({ guardAiRequest: mocks.guard }));
vi.mock("@/lib/ai-tasks", () => ({ TASKS: { summarize: { build: () => ({ ok: true, user: "text" }), maxTokens: 10, system: "test", schemaName: "summary", schema: {} } } }));
import { POST } from "../app/api/ai/route";

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  mocks.user.mockResolvedValue({ id: "alice" });
  mocks.guard.mockResolvedValue({ ok: true, body: { task: "summarize" } });
  mocks.rpc.mockReset();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("AI quota", () => {
  it("does not spend when quota verification fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("unavailable") });
    expect((await POST(new Request("https://hoja.test/api/ai", { method: "POST" }))).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects exhausted quota without calling the provider", async () => {
    mocks.rpc.mockResolvedValue({ data: -1, error: null });
    expect((await POST(new Request("https://hoja.test/api/ai", { method: "POST" }))).status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated calls", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await POST(new Request("https://hoja.test/api/ai", { method: "POST" }))).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
