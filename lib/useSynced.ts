"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import type { Table } from "@/lib/model";

type Item = { id: string; updatedAt: number };

function readLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocal<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

/**
 * A collection that lives in localStorage (local mode) or in a Supabase table (signed in).
 * Changes are saved shortly after they happen; the first login moves local items to the account.
 */
export function useSynced<T extends Item>(spec: Table<T>, cloud: boolean) {
  const [items, setItems] = useState<T[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const synced = useRef(new Map<string, number>());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loaded = readLocal<T>(spec.key);
      if (cloud) {
        try {
          const db = getBrowserClient();
          let query = db.from(spec.table).select("*");
          if (spec.order) query = query.order(spec.order);
          const { data, error: err } = await query;
          if (err) throw err;
          const remote = (data as Record<string, unknown>[]).map(spec.fromRow);
          if (remote.length === 0 && loaded.length > 0) {
            const { error: upErr } = await db.from(spec.table).upsert(loaded.map(spec.toRow));
            if (upErr) throw upErr;
            writeLocal(spec.key, []);
          } else {
            loaded = remote;
          }
          loaded.forEach((i) => synced.current.set(i.id, i.updatedAt));
        } catch {
          setError(true);
        }
      }
      if (cancelled) return;
      setItems(loaded);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [spec, cloud]);

  useEffect(() => {
    if (!ready) return;
    if (!cloud) {
      writeLocal(spec.key, items);
      return;
    }
    const pending = items.filter((i) => synced.current.get(i.id) !== i.updatedAt);
    if (pending.length === 0) return;
    const t = setTimeout(() => {
      getBrowserClient()
        .from(spec.table)
        .upsert(pending.map(spec.toRow))
        .then(({ error: err }: { error: unknown }) => {
          if (err) {
            setError(true);
            return;
          }
          pending.forEach((i) => synced.current.set(i.id, i.updatedAt));
          setError(false);
        });
    }, 700);
    return () => clearTimeout(t);
  }, [items, ready, cloud, spec]);

  const remove = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const gone = new Set(ids);
      setItems((all) => all.filter((i) => !gone.has(i.id)));
      if (cloud) {
        ids.forEach((id) => synced.current.delete(id));
        getBrowserClient()
          .from(spec.table)
          .delete()
          .in("id", ids)
          .then(({ error: err }: { error: unknown }) => err && setError(true));
      }
    },
    [cloud, spec],
  );

  return { items, setItems, ready, error, remove };
}
