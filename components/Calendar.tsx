"use client";

import Link from "next/link";
import { ViewTransition, useEffect, useMemo, useState } from "react";
import AppBar from "./AppBar";
import SyncStatus from "./SyncStatus";
import { downloadIcs, parseTaskLine, toggleTaskLine } from "@/lib/calendar";
import { dayLabel, fromYmd, monthGrid, monthLabel, ymd } from "@/lib/dates";
import { CARDS, EVENTS, NOTES, type CalendarEvent } from "@/lib/model";
import { useSynced } from "@/lib/useSynced";

interface Entry {
  key: string;
  title: string;
  date: string;
  done: boolean;
  /** "event" lives on the calendar; "task" is a ☐ line inside a note. */
  kind: "event" | "task";
  source?: string;
  noteId?: string;
  line?: number;
  eventId?: string;
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function Calendar({ userEmail, userName, userId }: { userEmail?: string; userName?: string; userId?: string }) {
  const cloud = Boolean(userEmail);
  const eventsStore = useSynced(EVENTS, cloud, userId);
  const notesStore = useSynced(NOTES, cloud, userId);
  const cardsStore = useSynced(CARDS, cloud, userId);

  const [today, setToday] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ y: number; m: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      const now = new Date();
      setToday(ymd(now));
      setSelected(ymd(now));
      setCursor({ y: now.getFullYear(), m: now.getMonth() });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const entries = useMemo(() => {
    const out: Entry[] = eventsStore.items.map((e) => ({
      key: `e-${e.id}`,
      title: e.title,
      date: e.date,
      done: e.done,
      kind: "event",
      eventId: e.id,
    }));
    for (const n of notesStore.items) {
      if (n.kind === "node" || n.kind === "table") continue;
      n.text.split("\n").forEach((line, i) => {
        const task = parseTaskLine(line);
        if (!task) return;
        out.push({
          key: `t-${n.id}-${i}`,
          title: task.title,
          date: task.date,
          done: task.done,
          kind: "task",
          source: n.title.trim() || "Sin título",
          noteId: n.id,
          line: i,
        });
      });
    }
    return out;
  }, [eventsStore.items, notesStore.items]);

  const byDate = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [entries]);

  const dueCards = useMemo(() => {
    if (!today) return 0;
    const end = fromYmd(today).getTime() + 24 * 60 * 60 * 1000;
    return cardsStore.items.filter((c) => c.due < end).length;
  }, [cardsStore.items, today]);

  const toggle = (e: Entry) => {
    if (e.kind === "event" && e.eventId) {
      eventsStore.setItems((all) => all.map((x) => (x.id === e.eventId ? { ...x, done: !x.done, updatedAt: Date.now() } : x)));
      return;
    }
    if (e.noteId === undefined || e.line === undefined) return;
    notesStore.setItems((all) =>
      all.map((n) => {
        if (n.id !== e.noteId) return n;
        const lines = n.text.split("\n");
        lines[e.line!] = toggleTaskLine(lines[e.line!]);
        return { ...n, text: lines.join("\n"), updatedAt: Date.now() };
      }),
    );
  };

  const add = (ev: React.FormEvent) => {
    ev.preventDefault();
    const t = title.trim();
    if (!t || !selected) return;
    const item: CalendarEvent = { id: crypto.randomUUID(), title: t.slice(0, 200), date: selected, done: false, updatedAt: Date.now() };
    eventsStore.setItems((all) => [...all, item]);
    setTitle("");
  };

  const exportAll = () => {
    const open = entries.filter((e) => !e.done);
    if (open.length) downloadIcs(open.map((e) => ({ title: e.title, date: e.date })), "Hoja");
  };

  const move = (delta: number) =>
    setCursor((c) => {
      if (!c) return c;
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const ready = today && cursor && selected && eventsStore.ready && notesStore.ready;
  const days = cursor ? monthGrid(cursor.y, cursor.m) : [];
  const chosen = (selected && byDate.get(selected)) || [];

  return (
    <div className="app study-app">
      <AppBar current="calendario" userEmail={userEmail} userName={userName}>
        <SyncStatus stores={[notesStore, cardsStore, eventsStore]} cloud={cloud} />
        <button className="btn line" onClick={exportAll} disabled={!entries.some((e) => !e.done)} title="Descarga un .ics con todo lo pendiente">
          Exportar .ics
        </button>
      </AppBar>
      <ViewTransition
      name="page"
      share={{ "nav-forward": "page-forward", "nav-back": "page-back", default: "page-fade" }}
      default="none"
    >
      <main className="cal">
        {!ready || !cursor ? (
          <p className="mono">cargando…</p>
        ) : (
          <>
            <section className="cal-main ds-win" aria-label="Calendario">
              <div className="note-bar" style={{ cursor: "default" }}>
                <i className="dot close" aria-hidden="true" />
                <i className="dot" aria-hidden="true" />
                <i className="dot" aria-hidden="true" />
                <span className="note-label mono">{monthLabel(cursor.y, cursor.m)}</span>
                <span className="cal-nav">
                  <button className="tag" onClick={() => move(-1)} aria-label="Mes anterior">
                    ←
                  </button>
                  <button
                    className="tag"
                    onClick={() => {
                      const n = new Date();
                      setCursor({ y: n.getFullYear(), m: n.getMonth() });
                      setSelected(ymd(n));
                    }}
                  >
                    Hoy
                  </button>
                  <button className="tag" onClick={() => move(1)} aria-label="Mes siguiente">
                    →
                  </button>
                </span>
              </div>
              <div className="cal-grid" role="grid">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="cal-wd mono" role="columnheader">
                    {d}
                  </div>
                ))}
                {days.map((d) => {
                  const list = byDate.get(d) ?? [];
                  const inMonth = fromYmd(d).getMonth() === cursor.m;
                  return (
                    <button
                      key={d}
                      role="gridcell"
                      className="cal-day"
                      data-out={!inMonth}
                      data-today={d === today}
                      data-selected={d === selected}
                      onClick={() => setSelected(d)}
                      aria-label={`${dayLabel(d)}${list.length ? `, ${list.length} pendientes` : ""}`}
                    >
                      <span className="cal-num">{Number(d.slice(8))}</span>
                      {list.slice(0, 3).map((e) => (
                        <span key={e.key} className="cal-pill" data-done={e.done} data-kind={e.kind}>
                          {e.title}
                        </span>
                      ))}
                      {list.length > 3 && <span className="cal-more mono">+{list.length - 3}</span>}
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="cal-side ds-win" aria-label="Detalle del día">
              <div className="note-bar" style={{ cursor: "default" }}>
                <i className="dot close" aria-hidden="true" />
                <i className="dot" aria-hidden="true" />
                <i className="dot" aria-hidden="true" />
                <span className="note-label mono">{selected ? dayLabel(selected) : ""}</span>
              </div>
              <div className="cal-side-body">
                {selected === today && dueCards > 0 && (
                  <p className="cal-cards">
                    <b>{dueCards}</b> tarjetas por repasar hoy. <Link href="/estudio">Ir a Estudio →</Link>
                  </p>
                )}
                {chosen.length === 0 ? (
                  <p className="cal-empty">Nada para este día.</p>
                ) : (
                  <ul className="cal-list">
                    {chosen.map((e) => (
                      <li key={e.key} data-done={e.done}>
                        <label>
                          <input type="checkbox" checked={e.done} onChange={() => toggle(e)} />
                          <span>
                            {e.title}
                            {e.source && <small className="mono">de «{e.source}»</small>}
                          </span>
                        </label>
                        {e.kind === "event" && e.eventId && (
                          <button className="tag" onClick={() => eventsStore.remove([e.eventId!])} aria-label="Borrar">
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <form onSubmit={add} className="cal-add">
                  <input
                    className="search"
                    placeholder="Agregar al día…"
                    aria-label="Agregar un pendiente a este día"
                    maxLength={200}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <button className="btn" type="submit" disabled={!title.trim()}>
                    Agregar
                  </button>
                </form>
                <p className="cal-hint">
                  También aparecen aquí las líneas <b>☐ tarea — AAAA-MM-DD</b> de tus notas (las de reuniones y resúmenes ya salen así).
                </p>
              </div>
            </aside>
          </>
        )}
      </main>
      </ViewTransition>
    </div>
  );
}
