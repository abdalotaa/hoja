"use client";

import { useEffect, useRef, useState } from "react";
import { TONES, TONE_LABEL, type Note } from "@/lib/notes";

interface Props {
  note: Note;
  active: boolean;
  onChange: (id: string, patch: Partial<Note>) => void;
  onFocus: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function NoteWindow({ note, active, onChange, onFocus, onDelete }: Props) {
  const [dragging, setDragging] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const origin = useRef({ px: 0, py: 0, x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    if (active && !note.title && !note.text) titleRef.current?.focus();
    // focus once, when a fresh note mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = (e: React.PointerEvent) => {
    origin.current = { px: e.clientX, py: e.clientY, x: note.x, y: note.y, w: note.w, h: note.h };
    e.currentTarget.setPointerCapture(e.pointerId);
    onFocus(note.id);
  };

  const drag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    start(e);
    setDragging(true);
  };
  const move = (e: React.PointerEvent) => {
    if (!dragging) return;
    const o = origin.current;
    onChange(note.id, {
      x: Math.max(0, o.x + e.clientX - o.px),
      y: Math.max(0, o.y + e.clientY - o.py),
    });
  };
  const stop = () => setDragging(false);

  const resize = (e: React.PointerEvent) => {
    start(e);
    e.stopPropagation();
  };
  const resizeMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const o = origin.current;
    onChange(note.id, {
      w: Math.max(220, o.w + e.clientX - o.px),
      h: Math.max(160, o.h + e.clientY - o.py),
    });
  };

  const cycleTone = () => {
    const next = TONES[(TONES.indexOf(note.tone) + 1) % TONES.length];
    onChange(note.id, { tone: next });
  };

  return (
    <article
      className="note"
      data-active={active}
      data-dragging={dragging}
      style={{ left: note.x, top: note.y, width: note.w, height: note.h, zIndex: note.z }}
      onPointerDown={() => onFocus(note.id)}
    >
      <header className="note-bar" onPointerDown={drag} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}>
        <button className="dot close" aria-label="Borrar nota" onClick={() => onDelete(note.id)} />
        <i className="dot" aria-hidden="true" />
        <i className="dot" aria-hidden="true" />
        <span className="note-label mono">{note.title.trim() || "sin título"}</span>
      </header>
      <div className="note-body">
        <input
          ref={titleRef}
          className="note-title"
          value={note.title}
          placeholder="Título"
          aria-label="Título de la nota"
          onChange={(e) => onChange(note.id, { title: e.target.value })}
        />
        <textarea
          className="note-text"
          value={note.text}
          placeholder="Escribe aquí…"
          aria-label="Contenido de la nota"
          onChange={(e) => onChange(note.id, { text: e.target.value })}
        />
        <div className="note-foot">
          <button className="tag" data-tone={note.tone} onClick={cycleTone} title="Cambiar etiqueta">
            {TONE_LABEL[note.tone]}
          </button>
        </div>
      </div>
      <div className="grip" onPointerDown={resize} onPointerMove={resizeMove} aria-hidden="true" />
    </article>
  );
}
