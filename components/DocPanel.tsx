"use client";

import { useEffect, useMemo, useState } from "react";
import DocEditor from "./DocEditor";
import type { Note } from "@/lib/notes";
import { backlinksOf, outgoingIds, outline } from "@/lib/wiki";

interface Props {
  note: Note;
  notes: Note[];
  onChange: (id: string, patch: Partial<Note>) => void;
  onOpen: (id: string) => void;
  onCreate: (title: string, near: Note) => string;
  onClose: () => void;
}

/** Side panel for writing a note as a full document, with its outline and links. */
export default function DocPanel({ note, notes, onChange, onOpen, onCreate, onClose }: Props) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector(".wiki-pop") && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const byId = useMemo(() => new Map(notes.map((n) => [n.id.toLowerCase(), n])), [notes]);
  const back = useMemo(() => backlinksOf(notes, note.id), [notes, note.id]);
  const out = useMemo(() => outgoingIds(note.text).map((id) => ({ id, note: byId.get(id) })), [note.text, byId]);
  const headings = useMemo(() => outline(note.text), [note.text]);

  const jump = (text: string) =>
    [...document.querySelectorAll<HTMLElement>(".doc-prose h1, .doc-prose h2, .doc-prose h3")]
      .find((h) => h.textContent?.trim() === text)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <aside className="doc-panel ds-win" data-expanded={expanded} aria-label="Nota abierta">
      <div className="note-bar" style={{ cursor: "default" }}>
        <button className="dot close" aria-label="Cerrar nota" onClick={onClose} />
        <i className="dot" aria-hidden="true" />
        <button className="dot" aria-label={expanded ? "Reducir" : "Ampliar a pantalla completa"} onClick={() => setExpanded((e) => !e)} />
        <span className="note-label mono">documento</span>
        <button className="tag" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Reducir ⤡" : "Ampliar ⤢"}
        </button>
      </div>

      <div className="doc-body">
        <div className="doc-main">
          <input
            className="doc-title"
            value={note.title}
            placeholder="Título"
            aria-label="Título de la nota"
            onChange={(e) => onChange(note.id, { title: e.target.value })}
          />
          <DocEditor
            key={note.id}
            note={note}
            notes={notes}
            onChange={(text) => onChange(note.id, { text })}
            onOpenNote={onOpen}
            onCreateNote={(title) => onCreate(title, note)}
          />
        </div>

        <div className="doc-rail">
          <section>
            <h3 className="mono">Índice</h3>
            {headings.length === 0 ? (
              <p className="doc-empty">Los títulos (H1, H2) que escribas aparecen aquí.</p>
            ) : (
              <ul>
                {headings.map((h, i) => (
                  <li key={`${h.text}-${i}`} style={{ paddingLeft: (h.level - 1) * 12 }}>
                    <button onClick={() => jump(h.text)}>{h.text}</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mono">Mencionada en ({back.length})</h3>
            {back.length === 0 ? (
              <p className="doc-empty">Ninguna nota enlaza aquí todavía. Escribe [[ en otra nota para enlazarla.</p>
            ) : (
              <ul>
                {back.map((n) => (
                  <li key={n.id}>
                    <button onClick={() => onOpen(n.id)}>{n.title.trim() || "Sin título"}</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mono">Enlaza a ({out.length})</h3>
            {out.length === 0 ? (
              <p className="doc-empty">Sin enlaces salientes.</p>
            ) : (
              <ul>
                {out.map((o) => (
                  <li key={o.id}>
                    {o.note ? <button onClick={() => onOpen(o.id)}>{o.note.title.trim() || "Sin título"}</button> : <span className="doc-gone">nota borrada</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </aside>
  );
}
