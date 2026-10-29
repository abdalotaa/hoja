"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "hoja:notebook-view:v1";
const EVENT = "hoja-notebook-view";

/** "all" shows every note, "none" the ones outside any notebook, anything else is a notebook id. */
export type View = string;

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
const read = (): View => {
  try {
    return localStorage.getItem(KEY) || "all";
  } catch {
    return "all";
  }
};

/** The notebook being looked at, remembered in this browser. */
export function useNotebookView(): [View, (v: View) => void] {
  const view = useSyncExternalStore(subscribe, read, () => "all");
  const set = useCallback((v: View) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [view, set];
}

export function inView(note: { notebookId?: string | null }, view: View): boolean {
  if (view === "all") return true;
  if (view === "none") return !note.notebookId;
  return note.notebookId === view;
}
