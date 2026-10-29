"use client";

import { ViewTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
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
import { arrange } from "@/lib/arrange";
import { freeSpot, worldOf } from "@/lib/placement";
import { CARDS, LINKS, NOTES, type Card } from "@/lib/model";
import { newNote, type Note } from "@/lib/notes";
import { noteText } from "@/lib/table";
import { useSpeech } from "@/lib/useSpeech";
import { useSynced } from "@/lib/useSynced";
import { backlinksOf, derivedLinks } from "@/lib/wiki";

const DocPanel = dynamic(() => import("./DocPanel"), { ssr: false });

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
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<"note" | "meeting">("note");
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const afterZoom = useRef<((c: HTMLElement) => void) | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
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
  const world = useMemo(() => worldOf(rects), [rects]);
  const originRef = useRef({ x: world.ox, y: world.oy });
  const prevOrigin = useRef<{ x: number; y: number } | null>(null);

  // The board grows in every direction. When its top-left corner moves, keep what you're looking at in place.
  useLayoutEffect(() => {
    const c = canvasRef.current;
    const prev = prevOrigin.current;
    if (prev && c && (prev.x !== world.ox || prev.y !== world.oy)) {
      c.scrollLeft += (prev.x - world.ox) * zoomRef.current;
      c.scrollTop += (prev.y - world.oy) * zoomRef.current;
    }
    prevOrigin.current = { x: world.ox, y: world.oy };
    originRef.current = { x: world.ox, y: world.oy };
  }, [world.ox, world.oy]);

  /** Scrolls so the given board point is near the top-left of the view. */
  const scrollToWorld = useCallback((x: number, y: number, margin = 60, smooth = true) => {
    const c = canvasRef.current;
    if (!c) return;
    c.scrollTo({
      left: (x - originRef.current.x) * zoomRef.current - margin,
      top: (y - originRef.current.y) * zoomRef.current - margin,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  // When the notes finish loading, start looking at them (not at an empty corner of the board).
  useLayoutEffect(() => {
    if (!ready) return;
    const x = rects.length ? Math.min(...rects.map((r) => r.x)) : 0;
    const y = rects.length ? Math.min(...rects.map((r) => r.y)) : 0;
    scrollToWorld(x, y, 60, false);
    // only when loading finishes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  /** A free spot for a block of this size, as close as possible to what the person is looking at. */
  const spotFor = useCallback(
    (size: { w: number; h: number }, near?: { x: number; y: number }) => {
      const c = canvasRef.current;
      const z = zoomRef.current;
      const preferred = near ?? {
        x: originRef.current.x + ((c?.scrollLeft ?? 0) + 60) / z,
        y: originRef.current.y + ((c?.scrollTop ?? 0) + 50) / z,
      };
      return freeSpot(rects, size, preferred);
    },
    [rects],
  );
  const viewportSpot = useCallback(() => spotFor({ w: 320, h: 260 }), [spotFor]);

  const add = useCallback(() => {
    const note = newNote(notes.length, ++topZ.current, viewportSpot());
    setNotes((all) => [...all, note]);
    setActiveId(note.id);
    setOpenId(note.id);
  }, [notes.length, setNotes, viewportSpot]);

  /** A note created from a [[link]] to a title that doesn't exist yet; it lands beside the note it was linked from. */
  const createLinked = useCallback(
    (title: string, near: Note) => {
      const spot = spotFor({ w: 320, h: 260 }, { x: near.x + near.w + 80, y: near.y });
      const fresh = { ...newNote(notes.length, ++topZ.current, spot), title };
      setNotes((all) => [...all, fresh]);
      return fresh.id;
    },
    [notes.length, setNotes, spotFor],
  );

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
        setTimeout(() => scrollToWorld(origin.x, origin.y, 120), 80);
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "No se pudo crear el mapa.");
      } finally {
        setBusyFor(note.id, null);
      }
    },
    [setBusyFor, setNotes, setLinks, spotFor, scrollToWorld],
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
        return {
          x: originRef.current.x + (ev.clientX - r.left) / zoomRef.current,
          y: originRef.current.y + (ev.clientY - r.top) / zoomRef.current,
        };
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

  /** Zooms by a factor, keeping the board point under (mx, my) fixed on screen. */
  const zoomAt = useCallback((factor: number, mx?: number, my?: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const z = zoomRef.current;
    const next = Math.min(2, Math.max(0.25, z * factor));
    if (next === z) return;
    const x = mx ?? c.clientWidth / 2;
    const y = my ?? c.clientHeight / 2;
    const px = (c.scrollLeft + x) / z;
    const py = (c.scrollTop + y) / z;
    afterZoom.current = (el) => {
      el.scrollLeft = px * next - x;
      el.scrollTop = py * next - y;
    };
    zoomRef.current = next;
    setZoom(next);
  }, []);

  const setZoomTo = useCallback(
    (value: number) => zoomAt(value / zoomRef.current),
    [zoomAt],
  );

  /** Shows every note at once. */
  const fit = useCallback(
    (list: { x: number; y: number; w: number; h: number }[] = rects) => {
      const c = canvasRef.current;
      if (!c || list.length === 0) return;
      const left = Math.min(...list.map((r) => r.x));
      const top = Math.min(...list.map((r) => r.y));
      const w = Math.max(...list.map((r) => r.x + r.w)) - left;
      const h = Math.max(...list.map((r) => r.y + r.h)) - top;
      const next = Math.min(1, Math.max(0.25, Math.min((c.clientWidth - 100) / w, (c.clientHeight - 100) / h)));
      const place = (el: HTMLElement) => {
        // Center the group of notes in the view.
        el.scrollLeft = (left + w / 2 - originRef.current.x) * next - el.clientWidth / 2;
        el.scrollTop = (top + h / 2 - originRef.current.y) * next - el.clientHeight / 2;
      };
      if (next === zoomRef.current) {
        place(c);
        return;
      }
      afterZoom.current = place;
      zoomRef.current = next;
      setZoom(next);
    },
    [rects],
  );

  // After the board resizes for the new zoom, restore the scroll position computed above.
  useLayoutEffect(() => {
    const c = canvasRef.current;
    if (c && afterZoom.current) {
      afterZoom.current(c);
      afterZoom.current = null;
    }
  }, [zoom]);

  // Ctrl/Cmd + wheel (and a trackpad pinch, which arrives as ctrl + wheel) zooms at the cursor.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = c.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top);
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Dragging a note: its position follows the pointer in board coordinates, and the view
  // scrolls on its own when the pointer nears an edge, so you can carry a note anywhere.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const startDrag = useCallback(
    (id: string, e: React.PointerEvent) => {
      const c = canvasRef.current;
      const note = notes.find((n) => n.id === id);
      if (!c || !note || e.button !== 0) return;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      focus(id);
      setDraggingId(id);

      const toWorld = (cx: number, cy: number) => {
        const r = c.getBoundingClientRect();
        const z = zoomRef.current;
        return {
          x: originRef.current.x + (c.scrollLeft + cx - r.left) / z,
          y: originRef.current.y + (c.scrollTop + cy - r.top) / z,
        };
      };
      const start = toWorld(e.clientX, e.clientY);
      const grab = { x: start.x - note.x, y: start.y - note.y };
      let last = { x: e.clientX, y: e.clientY };
      let raf = 0;

      const apply = () => {
        const p = toWorld(last.x, last.y);
        change(id, { x: Math.round(p.x - grab.x), y: Math.round(p.y - grab.y) });
      };
      const move = (ev: PointerEvent) => {
        last = { x: ev.clientX, y: ev.clientY };
        apply();
      };
      const EDGE = 64;
      const tick = () => {
        const r = c.getBoundingClientRect();
        const push = (d: number) => (d < EDGE ? Math.min(1, (EDGE - d) / EDGE) * 22 : 0);
        const dx = push(last.x - r.left) * -1 + push(r.right - last.x);
        const dy = push(last.y - r.top) * -1 + push(r.bottom - last.y);
        if (dx || dy) {
          c.scrollLeft += dx;
          c.scrollTop += dy;
          apply();
        }
        raf = requestAnimationFrame(tick);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        cancelAnimationFrame(raf);
        setDraggingId(null);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      raf = requestAnimationFrame(tick);
    },
    [notes, focus, change],
  );

  // Tidy up: pack everything into neat rows (connected notes stay together) and center the view.
  const [undo, setUndo] = useState<Map<string, { x: number; y: number }> | null>(null);
  const tidy = useCallback(() => {
    if (notes.length === 0) return;
    const target = arrange(notes, links);
    const before = new Map(notes.map((n) => [n.id, { x: n.x, y: n.y }]));
    const now = Date.now();
    setNotes((all) => all.map((n) => (target.has(n.id) ? { ...n, ...target.get(n.id)!, updatedAt: now } : n)));
    setUndo(before);
    const moved = notes.map((n) => ({ ...n, ...(target.get(n.id) ?? {}) }));
    setTimeout(() => fit(moved), 80);
  }, [notes, links, setNotes, fit]);

  const undoTidy = useCallback(() => {
    if (!undo) return;
    const now = Date.now();
    setNotes((all) => all.map((n) => (undo.has(n.id) ? { ...n, ...undo.get(n.id)!, updatedAt: now } : n)));
    const restored = notes.map((n) => ({ ...n, ...(undo.get(n.id) ?? {}) }));
    setUndo(null);
    setTimeout(() => fit(restored), 80);
  }, [undo, notes, setNotes, fit]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 10000);
    return () => clearTimeout(t);
  }, [undo]);

  // Drag the empty canvas to move around it (mouse and pen; touch already scrolls natively).
  const panStart = (e: React.PointerEvent<HTMLElement>) => {
    const onBackground = e.target === e.currentTarget || e.target === boardRef.current || e.target === frameRef.current;
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
      setTimeout(() => scrollToWorld(origin.x, origin.y), 80);
    },
    [setNotes, spotFor, scrollToWorld],
  );

  const openNote = useCallback(
    (id: string) => {
      const n = notes.find((x) => x.id === id);
      if (!n) return;
      setQuery("");
      focus(id);
      scrollToWorld(n.x, n.y, 80);
    },
    [notes, focus, scrollToWorld],
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

  const openNote_ = notes.find((n) => n.id.toLowerCase() === openId?.toLowerCase());
  useEffect(() => {
    if (openId && ready && !openNote_) setOpenId(null);
  }, [openId, ready, openNote_]);

  const textLinks = useMemo(() => derivedLinks(notes), [notes]);
  const backCounts = useMemo(() => new Map(notes.map((n) => [n.id, backlinksOf(notes, n.id).length])), [notes]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => (q ? notes.filter((n) => `${n.title} ${noteText(n)}`.toLowerCase().includes(q)) : notes),
    [notes, q],
  );
  const shownIds = useMemo(() => new Set(visible.map((n) => n.id)), [visible]);
  const shownLinks = useMemo(() => links.filter((l) => shownIds.has(l.from) && shownIds.has(l.to)), [links, shownIds]);
  const shownAuto = useMemo(() => textLinks.filter((l) => shownIds.has(l.from) && shownIds.has(l.to)), [textLinks, shownIds]);

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

      <ViewTransition
      name="page"
      share={{ "nav-forward": "page-forward", "nav-back": "page-back", default: "page-fade" }}
      default="none"
    >
      <main
        ref={canvasRef}
        className="canvas pannable"
        data-panning={panning}
        onPointerDown={panStart}
        onPointerMove={panMove}
        onPointerUp={panEnd}
        onPointerCancel={panEnd}
      >
        <div
          className="board-frame"
          ref={frameRef}
          style={
            {
              width: world.w * zoom,
              height: world.h * zoom,
              "--zoom": zoom,
              backgroundPosition: `${((((-world.ox) % 56) + 56) % 56) * zoom}px ${((((-world.oy) % 56) + 56) % 56) * zoom}px`,
            } as React.CSSProperties
          }
        >
        <div
          className="board"
          ref={boardRef}
          style={{ width: world.w, height: world.h, transform: `scale(${zoom})`, transformOrigin: "0 0" }}
        >
        <div className="world" style={{ left: -world.ox, top: -world.oy }}>
          <LinksLayer notes={visible} links={shownLinks} auto={shownAuto} draft={draft} onRemove={(id) => removeLinks([id])} />
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
              zoom={zoom}
              index={visible.indexOf(n)}
              onOpen={(id) => {
                focus(id);
                setOpenId(id);
              }}
              backlinks={backCounts.get(n.id) ?? 0}
              dragging={draggingId === n.id}
              onDragStart={startDrag}
            />
          ))}
        </div>
        </div>
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
        <div className="zoombar" role="group" aria-label="Zoom">
          <button onClick={() => zoomAt(1 / 1.25)} aria-label="Alejar" disabled={zoom <= 0.25}>
            −
          </button>
          <button className="zoom-pct" onClick={() => setZoomTo(1)} title="Volver al 100%">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => zoomAt(1.25)} aria-label="Acercar" disabled={zoom >= 2}>
            +
          </button>
          <button className="zoom-fit" onClick={() => fit()} disabled={notes.length === 0} title="Ver todas las notas">
            Ajustar
          </button>
          <button className="zoom-fit" onClick={tidy} disabled={notes.length < 2} title="Acomoda las notas en filas ordenadas y centra la vista">
            Ordenar
          </button>
        </div>
        {undo && (
          <div className="toast" role="status">
            Notas ordenadas.
            <button onClick={undoTidy}>Deshacer</button>
          </div>
        )}
        {openNote_ && (
          <DocPanel
            note={openNote_}
            notes={notes}
            onChange={change}
            onOpen={(id) => {
              const target = notes.find((n) => n.id.toLowerCase() === id.toLowerCase());
              if (target) {
                focus(target.id);
                setOpenId(target.id);
                scrollToWorld(target.x, target.y, 120);
              }
            }}
            onCreate={createLinked}
            onClose={() => setOpenId(null)}
          />
        )}
        {asking && <AskDialog notes={notes} onOpenNote={openNote} onClose={() => setAsking(false)} />}
        {ready && notes.length === 0 && !speech.listening && (
          <div className="empty">
            <h1>Hoja</h1>
            <p className="hand">tu primera nota empieza aquí ↗</p>
          </div>
        )}
      </main>
      </ViewTransition>
    </div>
  );
}
