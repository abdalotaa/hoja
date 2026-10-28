"use client";

import { useState } from "react";
import { ai } from "@/lib/ai";
import type { Note } from "@/lib/notes";

const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Picks the notes most likely to answer the question, so only those are sent to the AI. */
function relevant(question: string, notes: Note[]): Note[] {
  const words = plain(question)
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length >= 3);
  const scored = notes.map((n) => {
    const hay = plain(`${n.title} ${n.text}`);
    const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 + (plain(n.title).includes(w) ? 1 : 0) : 0), 0);
    return { n, score };
  });
  const hits = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  const pool = hits.length ? hits : scored.sort((a, b) => b.n.updatedAt - a.n.updatedAt);
  return pool.slice(0, 8).map((s) => s.n);
}

interface Props {
  notes: Note[];
  onOpenNote: (id: string) => void;
  onClose: () => void;
}

export default function AskDialog({ notes, onOpenNote, onClose }: Props) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ answer: string; sources: Note[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const real = notes.filter((n) => n.kind !== "node" && (n.text.trim() || n.title.trim()));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || question.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const picked = relevant(question, real);
      const out = await ai("ask", {
        question: question.trim(),
        notes: picked.map((n) => ({ id: n.id, title: n.title, text: n.text })),
      });
      const byId = new Map(picked.map((n) => [n.id, n]));
      setResult({ answer: out.answer, sources: out.sources.map((id) => byId.get(id)).filter((n): n is Note => Boolean(n)) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo responder.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="ask ds-win" aria-label="Pregúntale a tus notas">
      <div className="note-bar" style={{ cursor: "default" }}>
        <button className="dot close" aria-label="Cerrar" onClick={onClose} />
        <i className="dot" aria-hidden="true" />
        <i className="dot" aria-hidden="true" />
        <span className="note-label mono">pregúntale a tus notas</span>
      </div>
      <div className="ask-body">
        {real.length === 0 ? (
          <p>Escribe algunas notas primero y después pregúntales lo que quieras.</p>
        ) : (
          <form onSubmit={submit}>
            <input
              className="search"
              autoFocus
              maxLength={300}
              placeholder="¿Qué dijo Marta sobre el presupuesto?"
              aria-label="Tu pregunta"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button className="btn" type="submit" disabled={busy || question.trim().length < 3}>
              {busy ? "Buscando…" : "Preguntar ✦"}
            </button>
          </form>
        )}
        {error && <p className="ask-error" role="alert">{error}</p>}
        {result && (
          <div className="ask-answer" role="status">
            <p>{result.answer}</p>
            {result.sources.length > 0 && (
              <p className="ask-sources">
                <span className="mono">Fuentes</span>
                {result.sources.map((n) => (
                  <button key={n.id} className="tag" onClick={() => onOpenNote(n.id)}>
                    {n.title.trim() || "Sin título"}
                  </button>
                ))}
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
