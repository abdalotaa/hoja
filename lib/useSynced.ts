"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import type { Table } from "@/lib/model";

type Item = { id: string; updatedAt: number };
const activeWrites = new Set<string>();
const caches = new Map<string, Cache<Item>>();
const listeners = new Map<string, Set<() => void>>();
function notify(key: string) { listeners.get(key)?.forEach((listener) => listener()); }

type Cache<T> = { items: T[]; pending: string[]; deleted: string[] };

/** Durable per-account outbox. Pending edits survive navigation, reloads and failed requests. */
export function useSynced<T extends Item>(spec: Table<T>, cloud: boolean, account = "local") {
  const key = cloud ? `${spec.key}:account:${account}` : spec.key;
  const [items, renderItems] = useState<T[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const state = useRef<Cache<T>>({ items: [], pending: [], deleted: [] });
  const initialized = useRef(false);
  const remoteLoaded = useRef(!cloud);
  const reload = useRef<() => Promise<void>>(async () => {});

  const persist = useCallback(() => {
    try {
      localStorage.setItem(key, JSON.stringify(cloud ? state.current : state.current.items));
      return true;
    } catch {
      setError(true);
      return false;
    }
  }, [key, cloud]);

  const flush = useCallback(async () => {
    if (!cloud || !initialized.current || activeWrites.has(key)) return;
    if (!remoteLoaded.current) { await reload.current(); return; }
    if (!state.current.pending.length && !state.current.deleted.length) return;
    activeWrites.add(key);
    try {
      const db = getBrowserClient();
      const { data: session, error: authError } = await db.auth.getUser();
      if (authError || session.user?.id !== account) throw new Error("La sesión cambió.");
      const snapshot = state.current;
      const deleted = [...snapshot.deleted];
      const edits = snapshot.items.filter((i) => snapshot.pending.includes(i.id));
      if (deleted.length) {
        const { error } = await db.from(spec.table).delete().in("id", deleted);
        if (error) throw error;
        state.current.deleted = state.current.deleted.filter((id) => !deleted.includes(id));
      }
      if (edits.length) {
        const { error } = await db.from(spec.table).upsert(edits.map(spec.toRow));
        if (error) throw error;
        const sent = new Map(edits.map((i) => [i.id, i]));
        state.current.pending = state.current.pending.filter((id) => {
          const current = state.current.items.find((i) => i.id === id);
          return current && current !== sent.get(id);
        });
      }
      if (persist()) setError(false);
    } catch {
      setError(true);
    } finally {
      activeWrites.delete(key);
      setPending(Boolean(state.current.pending.length || state.current.deleted.length));
      notify(key);
    }
  }, [cloud, spec, persist, key, account]);

  useEffect(() => {
    let cancelled = false;
    let loading = false;
    const update = () => {
      renderItems(state.current.items);
      setPending(cloud && Boolean(state.current.pending.length || state.current.deleted.length));
    };
    const subscribers = listeners.get(key) ?? new Set<() => void>();
    subscribers.add(update);
    listeners.set(key, subscribers);
    const load = async () => {
      if (loading || cancelled) return;
      loading = true;
      try {
        const raw = localStorage.getItem(key);
        const cached = raw ? JSON.parse(raw) : null;
        state.current = (caches.get(key) as Cache<T> | undefined) ?? (cloud
          ? cached ?? { items: [], pending: [], deleted: [] }
          : { items: cached ?? [], pending: [], deleted: [] });
        caches.set(key, state.current);
      } catch { setError(true); }
      if (cloud) {
        try {
          const { data: session, error: authError } = await getBrowserClient().auth.getUser();
          if (authError || session.user?.id !== account) throw new Error("La sesión cambió.");
          const queuedAtStart = new Set([...state.current.pending, ...state.current.deleted]);
          const itemsAtStart = new Map(state.current.items.map((item) => [item.id, item]));
          let query = getBrowserClient().from(spec.table).select("*");
          if (spec.order) query = query.order(spec.order);
          const { data, error } = await query;
          if (error) throw error;
          if (cancelled) { loading = false; return; }
          const remote = (data as Record<string, unknown>[]).map(spec.fromRow);
          const cache = state.current;
          const edits = cache.items.filter((i) => cache.pending.includes(i.id) || queuedAtStart.has(i.id) ||
            itemsAtStart.get(i.id) !== i);
          const currentIds = new Set(cache.items.map((item) => item.id));
          const deletedWhileLoading = [...itemsAtStart.keys()].filter((id) => !currentIds.has(id));
          const hidden = new Set([...edits.map((item) => item.id), ...cache.pending, ...cache.deleted, ...queuedAtStart, ...deletedWhileLoading]);
          cache.items = [...remote.filter((i) => !hidden.has(i.id)), ...edits];
          // Import browser-only notes once. Never mix one account's cache with another.
          if (!remote.length && !cache.items.length && !cache.deleted.length) {
            const legacy = localStorage.getItem(spec.key);
            if (legacy) {
              cache.items = JSON.parse(legacy);
              cache.pending = cache.items.map((i) => i.id);
              if (persist()) localStorage.removeItem(spec.key);
            }
          }
          remoteLoaded.current = true;
          if (persist()) setError(false);
        } catch { if (!cancelled) setError(true); }
      }
      loading = false;
      if (cancelled) return;
      initialized.current = true;
      renderItems(state.current.items);
      setPending(Boolean(state.current.pending.length || state.current.deleted.length));
      setReady(true);
      if (remoteLoaded.current) void flush();
    };
    reload.current = load;
    void load();
    const retry = () => void flush();
    const timer = setInterval(retry, 5000);
    window.addEventListener("online", retry);
    window.addEventListener("pagehide", retry);
    return () => {
      cancelled = true;
      subscribers.delete(update);
      clearInterval(timer);
      window.removeEventListener("online", retry);
      window.removeEventListener("pagehide", retry);
      void flush();
    };
  }, [cloud, key, spec, flush, persist, account]);

  const setItems = useCallback((update: SetStateAction<T[]>) => {
    if (!initialized.current) return;
    const previous = state.current.items;
    const next = typeof update === "function" ? update(previous) : update;
    const old = new Map(previous.map((i) => [i.id, i]));
    const ids = new Set(next.map((i) => i.id));
    Object.assign(state.current, {
      items: next,
      pending: [...new Set([...state.current.pending.filter((id) => ids.has(id)), ...next.filter((i) => old.get(i.id) !== i).map((i) => i.id)])],
      deleted: [...new Set([...state.current.deleted.filter((id) => !ids.has(id)), ...previous.filter((i) => !ids.has(i.id)).map((i) => i.id)])],
    });
    if (!cloud) { state.current.pending = []; state.current.deleted = []; }
    const saved = persist();
    notify(key);
    renderItems(next);
    setPending(cloud && Boolean(state.current.pending.length || state.current.deleted.length));
    if (!cloud && saved) setError(false);
  }, [persist, cloud, key]);

  useEffect(() => {
    if (!ready || !pending) return;
    const timer = setTimeout(() => void flush(), 700);
    return () => clearTimeout(timer);
  }, [items, ready, pending, flush]);

  const remove = useCallback((ids: string[]) => {
    const gone = new Set(ids);
    setItems((all) => all.filter((i) => !gone.has(i.id)));
  }, [setItems]);

  return { items, setItems, ready, error, pending, remove, retry: flush };
}
