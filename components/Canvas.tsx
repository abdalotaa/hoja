"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NoteWindow from "./NoteWindow";
import { deleteCloudNote, loadCloudNotes, saveCloudNotes } from "@/lib/cloud";
import { loadNotes, newNote, saveNotes, type Note } from "@/lib/notes";
import { extractOriginal, formatSummary, summarize } from "@/lib/summarize";
import { useSpeech } from "@/lib/useSpeech";

export default function Canvas({ userEmail }: { userEmail?: string }) {
  const cloud = Boolean(userEmail);
  const synced = useRef(new Map<string, number>());
  const [syncError, setSyncError] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const topZ = useRef(1);
  const speech = useSpeech("es-MX");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let saved = loadNotes();
      if (cloud) {
        try {
          const remote = await loadCloudNotes();
          if (remote.length === 0 && saved.length > 0) {
            // First login on this browser: move the local notes to the account.
            await saveCloudNotes(saved);
            saveNotes([]);
          } else {
            saved = remote;
          }
          saved.forEach((n) => synced.current.set(n.id, n.updatedAt));
        } catch {
          setSyncError(true);
        }
      }
      if (cancelled) return;
      topZ.current = saved.reduce((m, n) => Math.max(m, n.z), 1);
      setNotes(saved);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [cloud]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!ready) return;
    if (!cloud) {
      saveNotes(notes);
      return;
    }
    const pending = notes.filter((n) => synced.current.get(n.id) !== n.updatedAt);
    if (pending.length === 0) return;
    const t = setTimeout(() => {
      saveCloudNotes(pending)
        .then(() => {
          pending.forEach((n) => synced.current.set(n.id, n.updatedAt));
          setSyncError(false);
        })
        .catch(() => setSyncError(true));
    }, 700);
    return () => clearTimeout(t);
  }, [notes, ready, cloud]);

  const add = useCallback(() => {
    const note = newNote(notes.length, ++topZ.current);
    setNotes((all) => [...all, note]);
    setActiveId(note.id);
  }, [notes.length]);

  const change = useCallback((id: string, patch: Partial<Note>) => {
    setNotes((all) => all.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)));
  }, []);

  const focus = useCallback((id: string) => {
    setActiveId(id);
    setNotes((all) => all.map((n) => (n.id === id && n.z < topZ.current ? { ...n, z: ++topZ.current, updatedAt: Date.now() } : n)));
  }, []);

  const remove = useCallback((id: string) => {
    setNotes((all) => all.filter((n) => n.id !== id));
    if (cloud) {
      synced.current.delete(id);
      deleteCloudNote(id).catch(() => setSyncError(true));
    }
  }, [cloud]);

  const markBusy = useCallback((id: string, on: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const runSummary = useCallback(
    async (id: string, text: string, setTitle: boolean) => {
      markBusy(id, true);
      setNotice(null);
      const original = extractOriginal(text);
      try {
        const result = await summarize(original);
        setNotes((all) =>
          all.map((n) =>
            n.id === id
              ? { ...n, title: setTitle || !n.title ? result.title : n.title, text: formatSummary(result, original), updatedAt: Date.now() }
              : n,
          ),
        );
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "No se pudo resumir.");
      } finally {
        markBusy(id, false);
      }
    },
    [markBusy],
  );

  const toggleDictation = useCallback(() => {
    if (!speech.listening) {
      speech.start();
      return;
    }
    speech.stop();
    const transcript = `${speech.finalText} ${speech.interim}`.trim();
    if (!transcript) return;
    const note = newNote(notes.length, ++topZ.current);
    note.title = "Nota de voz";
    note.text = transcript;
    setNotes((all) => [...all, note]);
    setActiveId(note.id);
    if (transcript.length >= 20) void runSummary(note.id, transcript, true);
  }, [speech, notes.length, runSummary]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => (q ? notes.filter((n) => `${n.title} ${n.text}`.toLowerCase().includes(q)) : notes),
    [notes, q],
  );

  return (
    <div className="app">
      <header className="bar">
        <div className="brand">
          <img src="/m4-symbol.svg" alt="" width={26} height={26} />
          Hoja
        </div>
        <span className="spacer" />
        {syncError && (
          <span className="mono" style={{ color: "var(--accent)" }} role="status">
            sin conexión
          </span>
        )}
        <input
          className="search"
          type="search"
          placeholder="Buscar en tus notas"
          aria-label="Buscar en tus notas"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {speech.supported && (
          <button className={`btn line rec${speech.listening ? " on" : ""}`} onClick={toggleDictation}>
            <span className="rec-dot" aria-hidden="true" />
            {speech.listening ? "Detener" : "Dictar"}
          </button>
        )}
        <button className="btn" onClick={add}>
          + Nueva nota
        </button>
        {userEmail && (
          <form action="/auth/signout" method="post" className="who-form">
            <span className="who" title={userEmail}>
              {userEmail}
            </span>
            <button className="btn line" type="submit">
              Salir
            </button>
          </form>
        )}
      </header>

      <main className="canvas" onPointerDown={(e) => e.target === e.currentTarget && setActiveId(null)}>
        <div className="board" onPointerDown={(e) => e.target === e.currentTarget && setActiveId(null)}>
          {visible.map((n) => (
            <NoteWindow key={n.id} note={n} active={n.id === activeId} onChange={change} onFocus={focus} onDelete={remove} onSummarize={(id, text) => runSummary(id, text, false)} summarizing={busy.has(n.id)} />
          ))}
        </div>
        {(speech.listening || speech.error || notice) && (
          <aside className="live ds-win" role="status" aria-live="polite">
            <div className="note-bar" style={{ cursor: "default" }}>
              <i className="dot close" aria-hidden="true" />
              <i className="dot" aria-hidden="true" />
              <i className="dot" aria-hidden="true" />
              <span className="note-label mono">
                {speech.listening ? "escuchando" : "aviso"}
              </span>
            </div>
            <p className="live-text">
              {speech.listening ? (
                <>
                  {speech.finalText} <span className="live-interim">{speech.interim}</span>
                  {!speech.finalText && !speech.interim && <span className="live-interim">Habla, te escucho…</span>}
                </>
              ) : (
                speech.error ?? notice
              )}
            </p>
          </aside>
        )}
        {ready && notes.length === 0 && !speech.listening && (
          <div className="empty">
            <h1>Hoja</h1>
            <p className="hand">tu primera nota empieza aquí ↗</p>
          </div>
        )}
      </main>
    </div>
  );
}
