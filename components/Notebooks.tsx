"use client";

import { useState } from "react";
import Menu from "./Menu";
import type { Notebook } from "@/lib/model";
import { TONES, type Tone } from "@/lib/notes";
import type { View } from "@/lib/useNotebookView";

interface Props {
  notebooks: Notebook[];
  counts: Map<string, number>;
  total: number;
  loose: number;
  view: View;
  onView: (v: View) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onTone: (id: string, tone: Tone) => void;
  onDelete: (id: string) => void;
}

/** The notebook strip under the top bar: Todas · each notebook · Sin libreta · + Libreta. */
export default function Notebooks({ notebooks, counts, total, loose, view, onView, onCreate, onRename, onTone, onDelete }: Props) {
  const [mode, setMode] = useState<"idle" | "new" | "rename">("idle");
  const [name, setName] = useState("");
  const current = notebooks.find((b) => b.id === view);

  const finish = () => {
    const value = name.trim().slice(0, 80);
    if (value) {
      if (mode === "new") onCreate(value);
      else if (mode === "rename" && current) onRename(current.id, value);
    }
    setMode("idle");
    setName("");
  };
  const input = (
    <input
      className="nb-input"
      autoFocus
      value={name}
      maxLength={80}
      placeholder="Nombre de la libreta"
      aria-label="Nombre de la libreta"
      onChange={(e) => setName(e.target.value)}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish();
        if (e.key === "Escape") {
          setName("");
          setMode("idle");
        }
      }}
    />
  );

  return (
    <div className="notebooks" data-tour="notebooks">
    <nav className="nb-scroll" aria-label="Libretas">
      <button className="nb" aria-pressed={view === "all"} onClick={() => onView("all")}>
        Todas <small>{total}</small>
      </button>
      {notebooks.map((b) =>
        mode === "rename" && current?.id === b.id ? (
          <span key={b.id}>{input}</span>
        ) : (
          <button key={b.id} className="nb" data-tone={b.tone} aria-pressed={view === b.id} onClick={() => onView(b.id)}>
            <i className="nb-dot" aria-hidden="true" />
            {b.name || "Sin nombre"} <small>{counts.get(b.id) ?? 0}</small>
          </button>
        ),
      )}
      {notebooks.length > 0 && (loose > 0 || view === "none") && (
        <button className="nb" aria-pressed={view === "none"} onClick={() => onView("none")}>
          Sin libreta <small>{loose}</small>
        </button>
      )}
      {mode === "new" ? (
        input
      ) : (
        <button
          className="nb nb-add"
          onClick={() => {
            setName("");
            setMode("new");
          }}
        >
          + Libreta
        </button>
      )}
    </nav>
      {current && mode === "idle" && (
        <Menu
          label="⋯"
          className="nb nb-more"
          items={[
            {
              label: "Renombrar",
              onSelect: () => {
                setName(current.name);
                setMode("rename");
              },
            },
            ...TONES.filter((t) => t !== current.tone).map((t) => ({
              label: `Color: ${t === "none" ? "blanco" : t === "butter" ? "mantequilla" : t === "mint" ? "menta" : "óxido"}`,
              onSelect: () => onTone(current.id, t),
            })),
            { label: "Eliminar libreta", hint: "Sus notas pasan a «Sin libreta»", onSelect: () => onDelete(current.id) },
          ]}
        />
      )}
    </div>
  );
}
