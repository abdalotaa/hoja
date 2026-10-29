"use client";

import LinksLayer from "./LinksLayer";
import type { Link } from "@/lib/model";
import type { Note } from "@/lib/notes";

/** A read-only view of a shared canvas. */
export default function SharedBoard({ title, notes: raw, links }: { title: string; notes: Note[]; links: Link[] }) {
  // Notes may sit at negative coordinates on the (borderless) canvas: shift them into view.
  const dx = raw.length ? 60 - Math.min(...raw.map((n) => n.x)) : 0;
  const dy = raw.length ? 60 - Math.min(...raw.map((n) => n.y)) : 0;
  const notes = raw.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
  return (
    <div className="app">
      <header className="bar">
        <div className="brand">
          <img src="/m4-symbol.svg" alt="" width={26} height={26} />
          Hoja
        </div>
        <span className="mono who" style={{ maxWidth: "none" }}>
          Solo lectura{title ? ` · ${title}` : ""}
        </span>
        <span className="spacer" />
        <a className="btn" href="/">
          Crear mi Hoja
        </a>
      </header>
      <main className="canvas">
        <div className="board">
          <LinksLayer notes={notes} links={links} draft={null} />
          {notes.map((n) =>
            n.kind === "node" ? (
              <article key={n.id} className="node" data-tone={n.tone} style={{ left: n.x, top: n.y, width: n.w, minHeight: n.h, zIndex: n.z }}>
                <span className="node-grip" aria-hidden="true" />
                <p className="node-text" style={{ margin: 0 }}>
                  {n.title}
                </p>
              </article>
            ) : (
              <article key={n.id} className="note" style={{ left: n.x, top: n.y, width: n.w, height: n.h, zIndex: n.z }}>
                <header className="note-bar" style={{ cursor: "default" }}>
                  <i className="dot close" aria-hidden="true" />
                  <i className="dot" aria-hidden="true" />
                  <i className="dot" aria-hidden="true" />
                  <span className="note-label mono">{n.title.trim() || "sin título"}</span>
                </header>
                <div className="note-body" style={{ overflow: "auto" }}>
                  <h2 className="note-title" style={{ margin: 0 }}>
                    {n.title}
                  </h2>
                  <p className="note-text" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {n.text}
                  </p>
                  {n.tone !== "none" && <span className="tag" data-tone={n.tone} style={{ alignSelf: "flex-start" }}>{{ butter: "Idea", mint: "Pendiente", rust: "Importante", none: "" }[n.tone]}</span>}
                </div>
              </article>
            ),
          )}
        </div>
      </main>
    </div>
  );
}
