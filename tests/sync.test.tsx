import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSynced } from "../lib/useSynced";
import type { Table } from "../lib/model";

const db = vi.hoisted(() => ({ select: vi.fn(), upsert: vi.fn(), remove: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => ({ auth: { getUser: db.user }, from: () => ({
  select: db.select, upsert: db.upsert, delete: () => ({ in: db.remove }),
}) }) }));
type Item = { id: string; updatedAt: number; text: string };
let spec: Table<Item>;
let key: string;
const original = { id: "one", updatedAt: 1, text: "original" };

beforeEach(() => {
  localStorage.clear();
  db.user.mockReset().mockResolvedValue({ data: { user: { id: "alice" } }, error: null });
  db.select.mockReset().mockResolvedValue({ data: [original], error: null });
  db.upsert.mockReset().mockResolvedValue({ error: null });
  db.remove.mockReset().mockResolvedValue({ error: null });
  spec = { key: crypto.randomUUID(), table: "notes", toRow: (i) => i, fromRow: (r) => r as Item };
  key = `${spec.key}:account:alice`;
});
afterEach(cleanup);

async function mount(account = "alice") {
  const hook = renderHook(() => useSynced(spec, true, account));
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
}

describe("durable sync", () => {
  it("persists an edit immediately and flushes it when navigating away before debounce", async () => {
    const hook = await mount();
    act(() => hook.result.current.setItems([{ ...original, text: "edit", updatedAt: 2 }]));
    expect(JSON.parse(localStorage.getItem(key)!).items[0].text).toBe("edit");
    hook.unmount();
    await waitFor(() => expect(db.upsert).toHaveBeenCalledWith([{ ...original, text: "edit", updatedAt: 2 }]));
  });
  it("retains failed edits and retries when connectivity returns", async () => {
    const hook = await mount();
    db.upsert.mockResolvedValueOnce({ error: new Error("offline") });
    act(() => hook.result.current.setItems([{ ...original, text: "offline", updatedAt: 2 }]));
    await act(async () => { await hook.result.current.retry(); });
    expect(hook.result.current.error).toBe(true);
    expect(JSON.parse(localStorage.getItem(key)!).pending).toEqual(["one"]);
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await waitFor(() => expect(hook.result.current.pending).toBe(false));
    expect(hook.result.current.error).toBe(false);
  });
  it("retains failed deletions through remount and removes them on retry", async () => {
    const hook = await mount();
    db.remove.mockResolvedValue({ error: new Error("offline") });
    act(() => hook.result.current.remove(["one"]));
    await act(async () => { await hook.result.current.retry(); });
    expect(JSON.parse(localStorage.getItem(key)!).deleted).toEqual(["one"]);
    hook.unmount();
    db.remove.mockResolvedValue({ error: null });
    const again = await mount();
    expect(again.result.current.items).toEqual([]);
    await act(async () => { await again.result.current.retry(); });
    expect(db.remove).toHaveBeenCalledWith("id", ["one"]);
  });
  it("does not acknowledge an edit made while an earlier save is in flight", async () => {
    const hook = await mount();
    let finish!: (value: { error: null }) => void;
    db.upsert.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    act(() => hook.result.current.setItems([{ ...original, text: "first", updatedAt: 2 }]));
    let saving!: Promise<void>;
    await act(async () => { saving = hook.result.current.retry(); });
    act(() => hook.result.current.setItems([{ ...original, text: "second", updatedAt: 3 }]));
    await act(async () => { finish({ error: null }); await saving; });
    expect(hook.result.current.pending).toBe(true);
    await act(async () => { await hook.result.current.retry(); });
    expect(db.upsert).toHaveBeenLastCalledWith([{ ...original, text: "second", updatedAt: 3 }]);
  });
  it("keeps one account's cached notes out of another account", async () => {
    localStorage.setItem(key, JSON.stringify({ items: [{ ...original, text: "private" }], pending: ["one"], deleted: [] }));
    db.select.mockResolvedValue({ data: [], error: null });
    db.user.mockResolvedValue({ data: { user: { id: "bob" } }, error: null });
    const hook = await mount("bob");
    expect(hook.result.current.items).toEqual([]);
    expect(db.upsert).not.toHaveBeenCalled();
  });
  it("shows cached data on startup failure and fetches remote data before retrying writes", async () => {
    localStorage.setItem(key, JSON.stringify({ items: [original], pending: [], deleted: [] }));
    db.select.mockResolvedValueOnce({ data: null, error: new Error("offline") });
    const hook = await mount();
    expect(hook.result.current.items).toEqual([original]);
    expect(hook.result.current.error).toBe(true);
    db.select.mockResolvedValue({ data: [{ ...original, text: "remote" }], error: null });
    await act(async () => { await hook.result.current.retry(); });
    expect(hook.result.current.items[0].text).toBe("remote");
    expect(hook.result.current.error).toBe(false);
  });
  it("does not send a pending edit under another signed-in account", async () => {
    const hook = await mount();
    act(() => hook.result.current.setItems([{ ...original, text: "private edit", updatedAt: 2 }]));
    db.user.mockResolvedValue({ data: { user: { id: "bob" } }, error: null });
    await act(async () => { await hook.result.current.retry(); });
    expect(db.upsert).not.toHaveBeenCalled();
    expect(hook.result.current.pending).toBe(true);
    expect(hook.result.current.error).toBe(true);
  });
  it("recovers pending changes from disk after the module is reloaded", async () => {
    localStorage.setItem(key, JSON.stringify({ items: [{ ...original, text: "saved on disk", updatedAt: 2 }], pending: ["one"], deleted: [] }));
    vi.resetModules();
    const { useSynced: freshHook } = await import("../lib/useSynced");
    const hook = renderHook(() => freshHook(spec, true, "alice"));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.items[0].text).toBe("saved on disk");
    await waitFor(() => expect(db.upsert).toHaveBeenCalledWith([{ ...original, text: "saved on disk", updatedAt: 2 }]));
  });

  it("keeps an acknowledged edit when a stale page-load request finishes later", async () => {
    const first = await mount();
    let finish!: (value: { data: Item[]; error: null }) => void;
    db.select.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const second = renderHook(() => useSynced(spec, true, "alice"));
    await waitFor(() => expect(db.select).toHaveBeenCalledTimes(2));
    act(() => first.result.current.setItems([{ ...original, text: "newer", updatedAt: 2 }]));
    await act(async () => { await first.result.current.retry(); });
    expect(first.result.current.pending).toBe(false);
    await act(async () => { finish({ data: [original], error: null }); });
    await waitFor(() => expect(second.result.current.ready).toBe(true));
    expect(second.result.current.items[0].text).toBe("newer");
  });

});
