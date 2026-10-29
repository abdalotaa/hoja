"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppBar from "./AppBar";
import AskDialog from "./AskDialog";
import LinksLayer from "./LinksLayer";
import Menu from "./Menu";
import NoteWindow, { type NoteAction } from "./NoteWindow";
import { ai, extractOriginal, formatMeeting, formatSummary } from "@/lib/ai";
import { exportJson, exportMarkdown } from "@/lib/export";
import { createShare, stopSharing } from "@/lib/share";
import { TEMPLATES, buildTemplate, templateSize } from "@/lib/templates";
import { buildMindMap } from "@/lib/mindmap";
import { boardSize, freeSpot } from "@/lib/placement";
import { CARDS, LINKS, NOTES, type Card } from "@/lib/model";
import { newNote, type Note } from "@/lib/notes";
import { noteText } from "@/lib/table";
import { useSpeech } from "@/lib/useSpeech";
import { useSynced } from "@/lib/useSynced";

export default function Canvas({ userEmail }: { userEmail?: string }) {
  const cloud = Boolean(userEmail);
  const notesStore = useSynced(NOTES, cloud);
  const linksStore = useSynced(LINKS, cloud);
  const cardsStore = useSynced(CARDS, cloud);
  const { items: notes, setItems: setNotes } = notesStore;
  const { items: links, setItems: setLinks } = linksStore;
  const ready = notesStore.ready && linksStore.ready;
  const syncError = notesStore.error || linksStore.error || cardsStore.error;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<Map<string, NoteAction>>(new Map());
  const [notice, setNotice] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [mode, setMode] = useState<"note" | "meeting">("note");
  const [panning, setPanning] = useState(false);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [draft, setDraft] = useState<{ fromId: string; x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLElement>(null);
  const topZ = useRef(1);
  const speech = useSpeech("es-MX");

  useEffect(() => {
    if (ready) topZ.current = Math.max(topZ.current, ...notes.map((n) => n.z), 1);
    // only when loading finishes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const rects = useMemo(() => notes.map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h })), [notes]);
  const board = useMemo(() => boardSize(rects), [rects]);

  /** A free spot for a block of this size, as close as possible to what the person is looking at. */
  const spotFor = useCallback(
    (size: { w: number; h: number }, near?: { x: number; y: number }) => {
      const c = canvasRef.current;
      const preferred = near ?? { x: (c?.scrollLeft ?? 0) + 60, y: (c?.scrollTop ?? 0) + 50 };
      return freeSpot(rects, size, preferred, board);
    },
    [rects, board],
  );
  const viewportSpot = useCallback(() => spotFor({ w: 320, h: 260 }), [spotFor]);

  const add = useCallback(() => {
    const note = newNote(notes.length, ++topZ.current, viewportSpot());
    setNotes((all) => [...all, note]);
    setActiveId(note.id);
  }, [notes.length, setNotes, viewportSpot]);

  const change = useCallback(
    (id: string, patch: Partial<Note>) => {
      setNotes((all) => all.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)));
    },
    [setNotes],
  );

  const focus = useCallback(
    (id: string) => {
      setActiveId(id);
      setNotes((all) =>
        all.map((n) => (n.id === id && n.z < topZ.current ? { ...n, z: ++topZ.current, updatedAt: Date.now() } : n)),
      );
    },
    [setNotes],
  );

  const removeLinks = linksStore.remove;
  const removeNotes = notesStore.remove;
  const remove = useCallback(
    (id: string) => {
      removeNotes([id]);
      removeLinks(links.filter((l) => l.from === id || l.to === id).map((l) => l.id));
    },
    [removeNotes, removeLinks, links],
  );

  const setBusyFor = useCallback((id: string, action: NoteAction | null) => {
    setBusy((prev) => {
      const next = new Map(prev);
      if (action) next.set(id, action);
      else next.delete(id);
      return next;
    });
  }, []);

  const runSummary = useCallback(
    async (id: string, text: string, setTitle: boolean) => {
      setBusyFor(id, "summarize");
      setNotice(null);
      const original = extractOriginal(text);
      try {
        const result = await ai("summarize", { text: original });
        setNotes((all) =>
          all.map((n) =>
            n.id === id
              ? { ...n, title: setTitle || !n.title ? result.title : n.title, text: formatSummary(result, original), updatedAt: Date.now() }
              : n,
          ),
        );
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "No se pudo resumir.");
      } finally {
        setBusyFor(id, null);
      }
    },
    [setBusyFor, setNotes],
  );

  const expandMap = useCallback(
    async (note: Note) => {
      setBusyFor(note.id, "map");
      setNotice(null);
      try {
        const source = extractOriginal(`${note.title}\n${note.text}`).trim();
        const map = await ai("mindmap", { text: source });
        const built = buildMindMap(map, topZ.current + 1);
        const origin = spotFor({ w: built.width, h: built.height }, { x: note.x + note.w + 110, y: Math.max(40, note.y) });
        built.nodes.forEach((n) => {
          n.x += origin.x;
          n.y += origin.y;
        });
        topZ.current += built.nodes.length;
        const rootLink = { id: crypto.randomUUID(), from: note.id, to: built.nodes[0].id, updatedAt: Date.now() };
        setNotes((all) => [...all, ...built.nodes]);
        setLinks((all) => [...all, rootLink, ...built.links]);
        canvasRef.current?.scrollTo({ left: Math.max(0, origin.x - 120), top: Math.max(0, origin.y - 80), behavior: "smooth" });
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "No se pudo crear el mapa.");
      } finally {
        setBusyFor(note.id, null);
      }
    },
    [setBusyFor, setNotes, setLinks, spotFor],
  );

  const makeCards = useCallback(
    async (note: Note) => {
      setBusyFor(note.id, "cards");
      setNotice(null);
      try {
        const source = extractOriginal(`${note.title}\n${note.text}`).trim();
        const result = await ai("flashcards", { text: source });
        const now = Date.now();
        const fresh: Card[] = result.cards.map((c) => ({
          id: crypto.randomUUID(),
          noteId: note.id,
          front: c.front,
          back: c.back,
          due: now,
          interval: 0,
          ease: 2.5,
          reps: 0,
          updatedAt: now,
        }));
        cardsStore.setItems((all) => [...all, ...fresh]);
        setNotice(`Creé ${fresh.length} tarjetas. Repásalas en Estudio.`);
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "No se pudieron crear las tarjetas.");
      } finally {
        setBusyFor(note.id, null);
      }
    },
    [setBusyFor, cardsStore],
  );

  const onAction = useCallback(
    (id: string, action: NoteAction) => {
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      if (action === "summarize") void runSummary(id, note.text, false);
      if (action === "map") void expandMap(note);
      if (action === "cards") void makeCards(note);
    },
    [notes, runSummary, expandMap, makeCards],
  );

  // Dragging a connection from one note to another.
  const startConnect = useCallback(
    (fromId: string, e: React.PointerEvent) => {
      const board = boardRef.current;
      if (!board) return;
      const toBoard = (ev: PointerEvent) => {
        const r = board.getBoundingClientRect();
        return { x: ev.clientX - r.left, y: ev.clientY - r.top };
      };
      setDraft({ fromId, ...toBoard(e.nativeEvent) });
      const move = (ev: PointerEvent) => setDraft({ fromId, ...toBoard(ev) });
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        setDraft(null);
        const target = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-note-id]");
        const toId = target?.dataset.noteId;
        if (!toId || toId === fromId) return;
        setLinks((all) =>
          all.some((l) => (l.from === fromId && l.to === toId) || (l.from === toId && l.to === fromId))
            ? all
            : [...all, { id: crypto.randomUUID(), from: fromId, to: toId, updatedAt: Date.now() }],
        );
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [setLinks],
  );

  // Drag the empty canvas to move around it (mouse and pen; touch already scrolls natively).
  const panStart = (e: React.PointerEvent<HTMLElement>) => {
    const onBackground = e.target === e.currentTarget || e.target === boardRef.current;
    if (!onBackground) return;
    setActiveId(null);
    if (e.button !== 0 || e.pointerType === "touch") return;
    const c = canvasRef.current;
    if (!c) return;
    e.preventDefault(); // no text selection while dragging
    (document.activeElement as HTMLElement | null)?.blur();
    pan.current = { x: e.clientX, y: e.clientY, left: c.scrollLeft, top: c.scrollTop };
    c.setPointerCapture(e.pointerId);
    setPanning(true);
  };
  const panMove = (e: React.PointerEvent<HTMLElement>) => {
    const p = pan.current;
    const c = canvasRef.current;
    if (!p || !c) return;
    c.scrollLeft = p.left - (e.clientX - p.x);
    c.scrollTop = p.top - (e.clientY - p.y);
  };
  const panEnd = (e: React.PointerEvent<HTMLElement>) => {
    if (!pan.current) return;
    pan.current = null;
    setPanning(false);
    canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  const toggleDictation = useCallback(
    (as: "note" | "meeting") => {
      if (!speech.listening) {
        setMode(as);
        speech.start();
        return;
      }
      speech.stop();
      const transcript = `${speech.finalText} ${speech.interim}`.trim();
      if (!transcript) return;
      const note = newNote(notes.length, ++topZ.current, viewportSpot());
      note.title = mode === "meeting" ? "Reunión" : "Nota de voz";
      note.text = transcript;
      setNotes((all) => [...all, note]);
      setActiveId(note.id);
      if (transcript.length < 20) return;
      if (mode === "note") {
        void runSummary(note.id, transcript, true);
        return;
      }
      void (async () => {
        setBusyFor(note.id, "summarize");
        try {
          const today = new Date().toLocaleDateString("en-CA");
          const result = await ai("meeting", { text: transcript, today });
          setNotes((all) =>
            all.map((n) => (n.id === note.id ? { ...n, title: result.title, text: formatMeeting(result, transcript), updatedAt: Date.now() } : n)),
          );
          const dated = result.actions.filter((a) => a.due).length;
          setNotice(
            dated > 0
              ? `Listo: ${result.actions.length} pendientes, ${dated} con fecha. En la nota, IA ✦ → calendario.`
              : `Listo: ${result.actions.length} pendientes.`,
          );
        } catch (e) {
          setNotice(e instanceof Error ? e.message : "No se pudo procesar la reunión.");
        } finally {
          setBusyFor(note.id, null);
        }
      })();
    },
    [speech, mode, notes.length, runSummary, setNotes, viewportSpot, setBusyFor],
  );

  const applyTemplate = useCallback(
    (id: string) => {
      const t = TEMPLATES.find((x) => x.id === id);
      if (!t) return;
      const fresh = buildTemplate(t, topZ.current + 1);
      const origin = spotFor(templateSize(t));
      fresh.forEach((n) => {
        n.x += origin.x;
        n.y += origin.y;
      });
      topZ.current += fresh.length;
      setNotes((all) => [...all, ...fresh]);
      canvasRef.current?.scrollTo({ left: Math.max(0, origin.x - 60), top: Math.max(0, origin.y - 60), behavior: "smooth" });
    },
    [setNotes, spotFor],
  );

  const openNote = useCallback(
    (id: string) => {
      const n = notes.find((x) => x.id === id);
      if (!n) return;
      setQuery("");
      focus(id);
      canvasRef.current?.scrollTo({ left: Math.max(0, n.x - 80), top: Math.max(0, n.y - 80), behavior: "smooth" });
    },
    [notes, focus],
  );

  const share = useCallback(async () => {
    try {
      const url = await createShare(notes, links, "Mi lienzo");
      await navigator.clipboard.writeText(url).catch(() => undefined);
      setNotice(`Enlace de solo lectura copiado: ${url}`);
    } catch {
      setNotice("No se pudo crear el enlace. ¿Ya ejecutaste el SQL actualizado en Supabase?");
    }
  }, [notes, links]);

  const unshare = useCallback(async () => {
    try {
      await stopSharing();
      setNotice("Dejaste de compartir: los enlaces anteriores ya no funcionan.");
    } catch {
      setNotice("No se pudieron quitar los enlaces.");
    }
  }, []);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => (q ? notes.filter((n) => `${n.title} ${noteText(n)}`.toLowerCase().includes(q)) : notes),
    [notes, q],
  );
  const shownIds = useMemo(() => new Set(visible.map((n) => n.id)), [visible]);
  const shownLinks = useMemo(() => links.filter((l) => shownIds.has(l.from) && shownIds.has(l.to)), [links, shownIds]);

  return (
    <div className="app">
      <AppBar current="lienzo" userEmail={userEmail}>
        {syncError && (
          <span className="mono" style={{ color: "var(--accent)" }} role="status">
            sin conexión
          </span>
        )}
        <input
          className="search"
          type="search"
          placeholder="Buscar en tus notas"
          aria-label="Buscar en tus notas"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn line" onClick={() => setAsking((a) => !a)} aria-pressed={asking}>
          Preguntar ✦
        </button>
        <Menu
          label="Plantillas ▾"
          items={TEMPLATES.map((t) => ({ label: t.label, hint: t.description, onSelect: () => applyTemplate(t.id) }))}
        />
        <Menu
          label="Más ▾"
          items={[
            { label: "Exportar a Markdown", hint: "Un archivo con todas tus notas", onSelect: () => exportMarkdown(notes, links), disabled: notes.length === 0 },
            { label: "Respaldo completo (JSON)", hint: "Notas, mapas y posiciones", onSelect: () => exportJson(notes, links), disabled: notes.length === 0 },
            ...(cloud
              ? [
                  { label: "Compartir lienzo (solo lectura)", hint: "Crea un enlace y lo copia", onSelect: share, disabled: notes.length === 0 },
                  { label: "Dejar de compartir", hint: "Desactiva todos tus enlaces", onSelect: unshare },
                ]
              : []),
          ]}
        />
        {speech.supported && (
          <>
            <button
              className={`btn line rec${speech.listening && mode === "meeting" ? " on" : ""}`}
              disabled={speech.listening && mode !== "meeting"}
              onClick={() => toggleDictation("meeting")}
              title="Graba una reunión y saca pendientes con fecha"
            >
              <span className="rec-dot" aria-hidden="true" />
              {speech.listening && mode === "meeting" ? "Detener" : "Reunión"}
            </button>
            <button
              className={`btn line rec${speech.listening && mode === "note" ? " on" : ""}`}
              disabled={speech.listening && mode !== "note"}
              onClick={() => toggleDictation("note")}
            >
              <span className="rec-dot" aria-hidden="true" />
              {speech.listening && mode === "note" ? "Detener" : "Dictar"}
            </button>
          </>
        )}
        <button className="btn" onClick={add}>
          + Nueva nota
        </button>
      </AppBar>

      <main
        ref={canvasRef}
        className="canvas pannable"
        data-panning={panning}
        onPointerDown={panStart}
        onPointerMove={panMove}
        onPointerUp={panEnd}
        onPointerCancel={panEnd}
      >
        <div className="board" ref={boardRef} style={{ width: board.w, height: board.h }}>
          <LinksLayer notes={visible} links={shownLinks} draft={draft} width={board.w} height={board.h} onRemove={(id) => removeLinks([id])} />
          {visible.map((n) => (
            <NoteWindow
              key={n.id}
              note={n}
              active={n.id === activeId}
              busy={busy.get(n.id) ?? null}
              onChange={change}
              onFocus={focus}
              onDelete={remove}
              onAction={onAction}
              onConnect={startConnect}
            />
          ))}
        </div>
        {(speech.listening || speech.error || notice) && (
          <aside className="live ds-win" role="status" aria-live="polite">
            <div className="note-bar" style={{ cursor: "default" }}>
              <i className="dot close" aria-hidden="true" />
              <i className="dot" aria-hidden="true" />
              <i className="dot" aria-hidden="true" />
              <span className="note-label mono">{speech.listening ? (mode === "meeting" ? "escuchando la reunión" : "escuchando") : "aviso"}</span>
            </div>
            <p className="live-text">
              {speech.listening ? (
                <>
                  {speech.finalText} <span className="live-interim">{speech.interim}</span>
                  {!speech.finalText && !speech.interim && <span className="live-interim">Habla, te escucho…</span>}
                </>
              ) : (
                (speech.error ?? notice)
              )}
            </p>
          </aside>
        )}
        {asking && <AskDialog notes={notes} onOpenNote={openNote} onClose={() => setAsking(false)} />}
        {ready && notes.length === 0 && !speech.listening && (
          <div className="empty">
            <h1>Hoja</h1>
            <p className="hand">tu primera nota empieza aquí ↗</p>
          </div>
        )}
      </main>
    </div>
  );
}
