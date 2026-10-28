"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NoteWindow from "./NoteWindow";
import { loadNotes, newNote, saveNotes, type Note } from "@/lib/notes";

export default function Canvas() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const topZ = useRef(1);

  useEffect(() => {
    const saved = loadNotes();
    topZ.current = saved.reduce((m, n) => Math.max(m, n.z), 1);
    setNotes(saved);
    setReady(true);
  }, []);

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
        <button className="btn" onClick={add}>
          + Nueva nota
        </button>
      </header>

      <main className="canvas" onPointerDown={(e) => e.target === e.currentTarget && setActiveId(null)}>
        <div className="board" onPointerDown={(e) => e.target === e.currentTarget && setActiveId(null)}>
          {visible.map((n) => (
            <NoteWindow key={n.id} note={n} active={n.id === activeId} onChange={change} onFocus={focus} onDelete={remove} />
          ))}
        </div>
        {ready && notes.length === 0 && (
          <div className="empty">
            <h1>Hoja</h1>
            <p className="hand">tu primera nota empieza aquí ↗</p>
          </div>
        )}
      </main>
    </div>
  );
}
