"use client";

import { useState } from "react";
import { speakersOf, defaultName, type MeetingLine } from "@/lib/meeting";

interface Props {
  lines: MeetingLine[];
  busy: boolean;
  /** True when voices were told apart automatically, so the names are worth checking. */
  detected: boolean;
  onSave: (names: Record<string, string>, polish: boolean) => void;
}

/** After a call: name each voice (or leave "Hablante A"), choose whether to fix spelling, and save the note. */
export default function MeetingFinish({ lines, busy, detected, onSave }: Props) {
  const speakers = speakersOf(lines);
  const [names, setNames] = useState<Record<string, string>>({});
  const [polish, setPolish] = useState(true);

  return (
    <aside className="meet ds-win" aria-label="¿Quién habló?">
      <div className="note-bar" style={{ cursor: "default" }}>
        <i className="dot close" aria-hidden="true" />
        <i className="dot" aria-hidden="true" />
        <i className="dot" aria-hidden="true" />
        <span className="note-label mono">¿quién habló?</span>
      </div>
      <div className="meet-body">
        <p>
          {detected
            ? "Separé las voces. Ponles nombre para que el resumen y los pendientes digan quién es responsable de qué; si no, quedan como «Hablante A», «Hablante B»…"
            : "Revisa los nombres antes de guardar."}
        </p>
        <div className="speakers">
          {speakers.map((s) => (
            <label key={s.key} className="speaker">
              <span className="speaker-name">{defaultName(s.key)}</span>
              <input
                className="search"
                maxLength={40}
                placeholder={defaultName(s.key)}
                value={names[s.key] ?? ""}
                onChange={(e) => setNames((n) => ({ ...n, [s.key]: e.target.value }))}
              />
              <small>
                {s.count} {s.count === 1 ? "intervención" : "intervenciones"} · «{s.sample.slice(0, 70)}
                {s.sample.length > 70 ? "…" : ""}»
              </small>
            </label>
          ))}
        </div>
        <label className="meet-check">
          <input type="checkbox" checked={polish} onChange={(e) => setPolish(e.target.checked)} />
          Corregir ortografía y puntuación (no cambia lo que se dijo)
        </label>
        <div className="meet-actions">
          <button className="btn" disabled={busy} onClick={() => onSave(names, polish)}>
            {busy ? "Guardando…" : "Guardar reunión"}
          </button>
        </div>
      </div>
    </aside>
  );
}
