"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TONES, TONE_LABEL, type Note } from "@/lib/notes";
import TableEditor from "./TableEditor";
import { downloadIcs, extractEvents } from "@/lib/calendar";
import { downloadCsv, parseTable } from "@/lib/table";
import { stripMarkdown } from "@/lib/wiki";

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
  zoom?: number;
  dragging?: boolean;
  index?: number;
  onOpen: (id: string) => void;
  backlinks?: number;
  onDragStart: (id: string, e: React.PointerEvent) => void;
}

export default function NoteWindow({ note, active, busy, onChange, onFocus, onDelete, onAction, onConnect, zoom = 1, dragging = false, index = 0, onOpen, backlinks = 0, onDragStart }: Props) {
  const [menu, setMenu] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLTextAreaElement>(null);
  const origin = useRef({ px: 0, py: 0, x: 0, y: 0, w: 0, h: 0 });
  const isNode = note.kind === "node";
  const isTable = note.kind === "table";

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
    onDragStart(note.id, e);
  };

  const resize = (e: React.PointerEvent) => {
    start(e);
    e.stopPropagation();
  };
  const resizeMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const o = origin.current;
    onChange(note.id, { w: Math.max(220, o.w + (e.clientX - o.px) / zoom), h: Math.max(160, o.h + (e.clientY - o.py) / zoom) });
  };

  const cycleTone = () => onChange(note.id, { tone: TONES[(TONES.indexOf(note.tone) + 1) % TONES.length] });
  const events = extractEvents(note.text);
  const preview = useMemo(() => stripMarkdown(note.text), [note.text]);
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
        style={{ left: note.x, top: note.y, width: note.w, minHeight: note.h, zIndex: note.z, "--i": index } as React.CSSProperties}
        onPointerDown={drag}
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
      style={{ left: note.x, top: note.y, width: note.w, height: note.h, zIndex: note.z, "--i": index } as React.CSSProperties}
      onPointerDown={() => onFocus(note.id)}
    >
      <header className="note-bar" onPointerDown={drag}>
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
        {isTable ? (
          <TableEditor value={note.text} onChange={(text) => onChange(note.id, { text })} />
        ) : (
          <button type="button" className="note-preview" onClick={() => onOpen(note.id)} aria-label="Abrir la nota para escribir">
            {preview ? <span>{preview}</span> : <span className="note-preview-empty">Escribe aquí…</span>}
          </button>
        )}
        <div className="note-foot">
          <button className="tag" data-tone={note.tone} onClick={cycleTone} title="Cambiar etiqueta">
            {TONE_LABEL[note.tone]}
          </button>
          {backlinks > 0 && (
            <span className="tag" title="Notas que enlazan a esta" style={{ background: "var(--mint)" }}>
              ↩ {backlinks}
            </span>
          )}
          <span className="spacer" />
          {!isTable && (
            <button className="tag" onClick={() => onOpen(note.id)} title="Abrir para escribir (doble clic en la tarjeta)">
              Abrir ⤢
            </button>
          )}
          {isTable ? (
            <button className="tag ai" onClick={() => downloadCsv(parseTable(note.text), note.title || "tabla")} title="Descargar como CSV (abre en Excel o Sheets)">
              CSV ↓
            </button>
          ) : (
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
          )}
        </div>
      </div>
      {connector}
      <div className="grip" onPointerDown={resize} onPointerMove={resizeMove} aria-hidden="true" />
    </article>
  );
}
