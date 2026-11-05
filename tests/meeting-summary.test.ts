import { beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => vi.fn());
vi.mock("../lib/ai", () => ({ ai }));
import { PART_CHARS, summarizeMeeting } from "../lib/meeting-summary";

const meeting = (n: number) => ({ title: `T${n}`, summary: `Resumen ${n}`, decisions: [`Decisión ${n}`], actions: [{ task: `Tarea ${n}`, owner: "Ana", due: null }] });

beforeEach(() => ai.mockReset());

describe("summarizeMeeting", () => {
  it("uses one call for a normal meeting", async () => {
    ai.mockResolvedValue(meeting(1));
    await summarizeMeeting("Ana: hola. ".repeat(100), "2026-11-05");
    expect(ai).toHaveBeenCalledTimes(1);
    expect(ai.mock.calls[0][0]).toBe("meeting");
  });

  it("summarizes a long meeting in parts and merges them", async () => {
    ai.mockImplementation(async (task: string) => (task === "meeting" ? meeting(ai.mock.calls.length) : { ...meeting(9), title: "Final" }));
    const long = Array.from({ length: 5 }, (_, i) => `Ana: ${"palabra ".repeat(1000)}${i}`).join("\n\n").repeat(3);
    const seen: number[] = [];
    const out = await summarizeMeeting(long, "2026-11-05", (i) => seen.push(i));
    const tasks = ai.mock.calls.map((c) => c[0]);
    expect(tasks.at(-1)).toBe("meetingmerge");
    expect(tasks.filter((t) => t === "meeting").length).toBeGreaterThan(1);
    expect(ai.mock.calls.filter((c) => c[0] === "meeting").every((c) => c[1].text.length <= PART_CHARS)).toBe(true);
    expect(ai.mock.calls.at(-1)![1].text).toContain("Tarea 1 | responsable: Ana | fecha: ninguna");
    expect(out.title).toBe("Final");
    expect(seen[0]).toBe(1);
  });
});
