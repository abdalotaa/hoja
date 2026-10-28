"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppBar from "./AppBar";
import { ai, formatGuide } from "@/lib/ai";
import { CARDS, NOTES, type Card } from "@/lib/model";
import { newNote } from "@/lib/notes";
import { RATINGS, intervalLabel, schedule, type Rating } from "@/lib/srs";
import { useSynced } from "@/lib/useSynced";

export default function Study({ userEmail }: { userEmail?: string }) {
  const cloud = Boolean(userEmail);
  const cardsStore = useSynced(CARDS, cloud);
  const notesStore = useSynced(NOTES, cloud);
  const cards = cardsStore.items;
  const notes = notesStore.items.filter((n) => n.kind !== "node");

  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);
  const [flipped, setFlipped] = useState(false);
  const [source, setSource] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"cards" | "guide" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const due = useMemo(
    () => cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due || a.updatedAt - b.updatedAt),
    [cards, now],
  );
  const current = due[0];
  const noteName = useMemo(() => new Map(notes.map((n) => [n.id, n.title.trim() || "Sin título"])), [notes]);

  const rate = useCallback(
    (rating: Rating) => {
      if (!current) return;
      const t = Date.now();
      const next = schedule(current, rating, t);
      cardsStore.setItems((all) => all.map((c) => (c.id === current.id ? next : c)));
      setNow(t);
      setFlipped(false);
    },
    [current, cardsStore],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        rate(RATINGS[Number(e.key) - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, rate]);

  const generate = async () => {
    const note = notes.find((n) => n.id === source);
    if (!note) return;
    setBusy("cards");
    setMessage(null);
    try {
      const text = `${note.title}\n${note.text}`.trim().slice(0, 12000);
      const result = await ai("flashcards", { text });
      const t = Date.now();
      const fresh: Card[] = result.cards.map((c) => ({
        id: crypto.randomUUID(),
        noteId: note.id,
        front: c.front,
        back: c.back,
        due: t,
        interval: 0,
        ease: 2.5,
        reps: 0,
        updatedAt: t,
      }));
      cardsStore.setItems((all) => [...all, ...fresh]);
      setNow(t);
      setMessage(`Creé ${fresh.length} tarjetas de "${note.title.trim() || "Sin título"}".`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudieron crear las tarjetas.");
    } finally {
      setBusy(null);
    }
  };

  const makeGuide = async () => {
    const chosen = notes.filter((n) => picked.has(n.id));
    if (chosen.length === 0) return;
    setBusy("guide");
    setMessage(null);
    try {
      const text = chosen
        .map((n) => `# ${n.title}\n${n.text.slice(0, 2500)}`)
        .join("\n\n")
        .slice(0, 12000);
      const guide = await ai("guide", { text });
      const all = notesStore.items;
      const y = all.length ? Math.max(...all.map((n) => n.y + n.h)) + 40 : 60;
      const note = {
        ...newNote(all.length, Math.max(1, ...all.map((n) => n.z)) + 1, { x: 80, y }),
        title: guide.title,
        text: formatGuide(guide),
        tone: "butter" as const,
        w: 420,
        h: 420,
      };
      notesStore.setItems((prev) => [...prev, note]);
      setPicked(new Set());
      setMessage(`Guía "${guide.title}" creada. Está en tu Lienzo.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo crear la guía.");
    } finally {
      setBusy(null);
    }
  };

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 8) next.add(id);
      return next;
    });

  const byNote = useMemo(() => {
    const groups = new Map<string, Card[]>();
    for (const c of cards) {
      const key = c.noteId && noteName.has(c.noteId) ? c.noteId : "";
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    return [...groups.entries()];
  }, [cards, noteName]);

  const ready = cardsStore.ready && notesStore.ready;
  const learned = cards.filter((c) => c.interval >= 21).length;

  return (
    <div className="app study-app">
      <AppBar current="estudio" userEmail={userEmail} />
      <main className="study">
        <section className="review ds-win" aria-label="Repaso de hoy">
          <div className="note-bar" style={{ cursor: "default" }}>
            <i className="dot close" aria-hidden="true" />
            <i className="dot" aria-hidden="true" />
            <i className="dot" aria-hidden="true" />
            <span className="note-label mono">
              {ready ? `${due.length} para hoy · ${cards.length} en total · ${learned} dominadas` : "cargando"}
            </span>
          </div>
          <div className="review-body">
            {!ready ? null : current ? (
              <>
                <p className="mono review-from">{current.noteId ? (noteName.get(current.noteId) ?? "Nota borrada") : "Tarjeta"}</p>
                <p className="review-front">{current.front}</p>
                {flipped ? (
                  <>
                    <p className="review-back">{current.back}</p>
                    <div className="rate-row">
                      {RATINGS.map((r, i) => (
                        <button key={r.id} className={`btn rate rate-${r.id}`} onClick={() => rate(r.id)}>
                          <span>{r.label}</span>
                          <small className="mono">
                            {i + 1} · {intervalLabel(current, r.id)}
                          </small>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <button className="btn" onClick={() => setFlipped(true)}>
                    Mostrar respuesta <small className="mono">espacio</small>
                  </button>
                )}
              </>
            ) : cards.length === 0 ? (
              <>
                <p className="hand review-hand">aún no hay tarjetas ↘</p>
                <p>Crea tarjetas desde una de tus notas aquí abajo, o con "IA ✦ → Crear tarjetas" en el Lienzo.</p>
              </>
            ) : (
              <>
                <p className="hand review-hand">¡listo por hoy! ✦</p>
                <p>Repasaste todo lo que tocaba. Las demás tarjetas volverán a aparecer cuando les toque.</p>
              </>
            )}
          </div>
        </section>

        <section className="study-tools">
          <div className="tool ds-win">
            <div className="note-bar" style={{ cursor: "default" }}>
              <i className="dot close" aria-hidden="true" />
              <i className="dot" aria-hidden="true" />
              <i className="dot" aria-hidden="true" />
              <span className="note-label mono">tarjetas desde una nota</span>
            </div>
            <div className="tool-body">
              {notes.length === 0 ? (
                <p>
                  Primero escribe una nota en el <Link href="/">Lienzo</Link>.
                </p>
              ) : (
                <>
                  <select className="search" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Nota de origen">
                    <option value="">Elige una nota…</option>
                    {notes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title.trim() || "Sin título"}
                      </option>
                    ))}
                  </select>
                  <button className="btn" disabled={!source || busy !== null} onClick={generate}>
                    {busy === "cards" ? "Creando…" : "Crear tarjetas ✦"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="tool ds-win">
            <div className="note-bar" style={{ cursor: "default" }}>
              <i className="dot close" aria-hidden="true" />
              <i className="dot" aria-hidden="true" />
              <i className="dot" aria-hidden="true" />
              <span className="note-label mono">guía de examen</span>
            </div>
            <div className="tool-body">
              {notes.length === 0 ? (
                <p>Elige varias notas y las junto en una guía de estudio.</p>
              ) : (
                <>
                  <ul className="pick">
                    {notes.map((n) => (
                      <li key={n.id}>
                        <label>
                          <input type="checkbox" checked={picked.has(n.id)} onChange={() => togglePick(n.id)} />
                          {n.title.trim() || "Sin título"}
                        </label>
                      </li>
                    ))}
                  </ul>
                  <button className="btn" disabled={picked.size === 0 || busy !== null} onClick={makeGuide}>
                    {busy === "guide" ? "Armando…" : `Armar guía (${picked.size}) ✦`}
                  </button>
                </>
              )}
            </div>
          </div>

          {message && (
            <p className="study-msg" role="status">
              {message}
            </p>
          )}
        </section>

        {byNote.length > 0 && (
          <section className="decks" aria-label="Tus tarjetas">
            <h2 className="mono">Tus mazos</h2>
            {byNote.map(([id, group]) => (
              <details key={id || "none"} className="deck">
                <summary>
                  <b>{id ? noteName.get(id) : "Sin nota"}</b>
                  <span className="mono">
                    {group.length} tarjetas · {group.filter((c) => c.due <= now).length} para hoy
                  </span>
                </summary>
                <ul>
                  {group.map((c) => (
                    <li key={c.id}>
                      <div>
                        <p>{c.front}</p>
                        <p className="deck-back">{c.back}</p>
                      </div>
                      <button className="btn line btn-sm" onClick={() => cardsStore.remove([c.id])} aria-label="Borrar tarjeta">
                        Borrar
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
