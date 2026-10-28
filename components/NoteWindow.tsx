"use client";

import { useEffect, useRef, useState } from "react";
import { TONES, TONE_LABEL, type Note } from "@/lib/notes";
import { downloadIcs, extractEvents } from "@/lib/calendar";

export type NoteAction = "summarize" | "map" | "cards";

interface Props {
  note: Note;
  active: boolean;
  busy: NoteAction | null;
  onChange: (id: string, patch: Partial<Note>) => void;
  onFocus: (id: string) => void;
  onDelete: (id: string) => void;
  onAction: (id: string, action: NoteAction) => void;
  onConnect: (id: string, e: React.PointerEvent) => void;
}

export default function NoteWindow({ note, active, busy, onChange, onFocus, onDelete, onAction, onConnect }: Props) {
  const [dragging, setDragging] = useState(false);
  const [menu, setMenu] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLTextAreaElement>(null);
  const origin = useRef({ px: 0, py: 0, x: 0, y: 0, w: 0, h: 0 });
  const isNode = note.kind === "node";

  useEffect(() => {
    if (active && !note.title && !note.text) (isNode ? nodeRef : titleRef).current?.focus();
    // focus once, when a fresh note mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = (e: React.PointerEvent) => {
    origin.current = { px: e.clientX, py: e.clientY, x: note.x, y: note.y, w: note.w, h: note.h };
    e.currentTarget.setPointerCapture(e.pointerId);
    onFocus(note.id);
  };
  const drag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, textarea, input")) return;
    start(e);
    setDragging(true);
  };
  const move = (e: React.PointerEvent) => {
    if (!dragging) return;
    const o = origin.current;
    onChange(note.id, { x: Math.max(0, o.x + e.clientX - o.px), y: Math.max(0, o.y + e.clientY - o.py) });
  };
  const stop = () => setDragging(false);

  const resize = (e: React.PointerEvent) => {
    start(e);
    e.stopPropagation();
  };
  const resizeMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const o = origin.current;
    onChange(note.id, { w: Math.max(220, o.w + e.clientX - o.px), h: Math.max(160, o.h + e.clientY - o.py) });
  };

  const cycleTone = () => onChange(note.id, { tone: TONES[(TONES.indexOf(note.tone) + 1) % TONES.length] });
  const events = extractEvents(note.text);
  const run = (a: NoteAction) => {
    setMenu(false);
    onAction(note.id, a);
  };

  const connector = (
    <span
      className="connector"
      title="Arrastra hasta otra nota para conectarlas"
      onPointerDown={(e) => {
        e.stopPropagation();
        onConnect(note.id, e);
      }}
    />
  );

  if (isNode) {
    return (
      <article
        className="node"
        data-note-id={note.id}
        data-tone={note.tone}
        data-active={active}
        data-dragging={dragging}
        style={{ left: note.x, top: note.y, width: note.w, minHeight: note.h, zIndex: note.z }}
        onPointerDown={drag}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
      >
        <span className="node-grip" aria-hidden="true" />
        <textarea
          ref={nodeRef}
          className="node-text"
          rows={2}
          value={note.title}
          placeholder="Idea"
          aria-label="Idea del mapa"
          onChange={(e) => onChange(note.id, { title: e.target.value })}
        />
        <button className="node-x" aria-label="Borrar idea" onClick={() => onDelete(note.id)}>
          ×
        </button>
        {connector}
      </article>
    );
  }

  return (
    <article
      className="note"
      data-note-id={note.id}
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
          <span className="spacer" />
          <div className="ai-menu">
            <button
              className="tag ai"
              aria-expanded={menu}
              disabled={busy !== null || (note.text.trim().length < 20 && note.title.trim().length < 3)}
              onClick={() => setMenu((m) => !m)}
              title="Acciones con IA"
            >
              {busy ? "Trabajando…" : "IA ✦"}
            </button>
            {menu && (
              <div className="ai-pop" role="menu">
                <button role="menuitem" onClick={() => run("summarize")}>Resumir</button>
                <button role="menuitem" onClick={() => run("map")}>Expandir en mapa mental</button>
                <button role="menuitem" onClick={() => run("cards")}>Crear tarjetas de estudio</button>
                {events.length > 0 && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      downloadIcs(events, note.title || "Hoja");
                    }}
                  >
                    Pendientes al calendario ({events.length})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {connector}
      <div className="grip" onPointerDown={resize} onPointerMove={resizeMove} aria-hidden="true" />
    </article>
  );
}
