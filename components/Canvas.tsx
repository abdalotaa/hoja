"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NoteWindow from "./NoteWindow";
import { loadNotes, newNote, saveNotes, type Note } from "@/lib/notes";
import { formatSummary, summarize } from "@/lib/summarize";
import { useSpeech } from "@/lib/useSpeech";

export default function Canvas() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const topZ = useRef(1);
  const speech = useSpeech("es-MX");

  useEffect(() => {
    const saved = loadNotes();
    topZ.current = saved.reduce((m, n) => Math.max(m, n.z), 1);
    setNotes(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (ready) saveNotes(notes);
  }, [notes, ready]);

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
    setNotes((all) => all.map((n) => (n.id === id && n.z < topZ.current ? { ...n, z: ++topZ.current } : n)));
  }, []);

  const remove = useCallback((id: string) => {
    setNotes((all) => all.filter((n) => n.id !== id));
  }, []);

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
      try {
        const result = await summarize(text);
        setNotes((all) =>
          all.map((n) =>
            n.id === id
              ? { ...n, title: setTitle || !n.title ? result.title : n.title, text: formatSummary(result, text), updatedAt: Date.now() }
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
