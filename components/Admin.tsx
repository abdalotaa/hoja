"use client";

import Link from "next/link";
import { useState } from "react";
import { KINDS, percent, STATUSES, type Count, type Metrics, type Status, type Suggestion } from "@/lib/admin";
import { getBrowserClient } from "@/lib/supabase/client";

const nf = new Intl.NumberFormat("es-MX");
const when = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="adm-stat">
      <b>{typeof value === "number" ? nf.format(value) : value}</b>
      <span>{label}</span>
      {hint && <small className="mono">{hint}</small>}
    </div>
  );
}

function Bars({ rows, empty }: { rows: Count[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="doc-empty">{empty}</p>;
  return (
    <ul className="adm-bars">
      {rows.map((r) => (
        <li key={r.name}>
          <span>{r.name}</span>
          <i style={{ width: `${Math.max(4, (r.count / max) * 100)}%` }} />
          <b className="mono">{nf.format(r.count)}</b>
        </li>
      ))}
    </ul>
  );
}

/** Super admin panel: numbers about use and growth, and the suggestions people sent. */
export default function Admin({ metrics: m, suggestions: initial }: { metrics: Metrics; suggestions: Suggestion[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Status | "todas">("nueva");
  const [error, setError] = useState<string | null>(null);

  const setStatus = async (id: string, status: Status) => {
    setError(null);
    const { error: err } = await getBrowserClient().rpc("admin_set_suggestion_status", { p_id: id, p_status: status });
    if (err) return setError("No se pudo cambiar el estado.");
    setItems((list) => list.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const shown = items.filter((s) => filter === "todas" || s.status === filter);
  const maxDay = Math.max(1, ...m.daily.map((d) => d.count));
  const kindLabel = (k: string) => KINDS.find((x) => x.id === k)?.label ?? k;

  return (
    <main className="adm">
      <header className="adm-head">
        <div>
          <p className="mono">super admin</p>
          <h1>Hoja en números</h1>
        </div>
        <Link href="/" className="btn line">
          Volver a mis notas
        </Link>
      </header>

      <section aria-labelledby="adm-users">
        <h2 id="adm-users">Personas</h2>
        <div className="adm-grid">
          <Stat label="cuentas" value={m.users.total} />
          <Stat label="nuevas en 7 días" value={m.users.last7} />
          <Stat label="nuevas en 30 días" value={m.users.last30} />
          <Stat label="activas en 7 días" value={m.users.active7} hint="editaron una nota" />
          <Stat label="activadas" value={`${percent(m.users.withNotes, m.users.total)}%`} hint={`${nf.format(m.users.withNotes)} con al menos una nota`} />
        </div>
      </section>

      <section aria-labelledby="adm-daily">
        <h2 id="adm-daily">Registros por día (30 días)</h2>
        <div className="adm-daily" role="img" aria-label="Cuentas nuevas por día">
          {m.daily.map((d) => (
            <div key={d.day} className="adm-col" title={`${d.day}: ${d.count}`}>
              <i style={{ height: `${(d.count / maxDay) * 100}%` }} />
            </div>
          ))}
        </div>
        <p className="doc-empty mono">
          {m.daily[0]?.day} → {m.daily[m.daily.length - 1]?.day}
        </p>
      </section>

      <div className="adm-two">
        <section aria-labelledby="adm-camp">
          <h2 id="adm-camp">De qué campaña vienen</h2>
          <Bars rows={m.campaigns} empty="Todavía no hay cuentas." />
        </section>
        <section aria-labelledby="adm-src">
          <h2 id="adm-src">De qué fuente vienen</h2>
          <Bars rows={m.sources} empty="Todavía no hay cuentas." />
        </section>
      </div>

      <section aria-labelledby="adm-content">
        <h2 id="adm-content">Lo que se crea</h2>
        <div className="adm-grid">
          <Stat label="notas" value={m.content.notes} />
          <Stat label="tablas" value={m.content.tables} />
          <Stat label="nodos de mapas" value={m.content.nodes} />
          <Stat label="libretas" value={m.content.notebooks} />
          <Stat label="conexiones" value={m.content.links} />
          <Stat label="tarjetas" value={m.content.cards} />
          <Stat label="eventos" value={m.content.events} />
          <Stat label="lienzos compartidos" value={m.content.shares} />
          <Stat label="usos de IA este mes" value={m.ai.uses} hint={`${nf.format(m.ai.people)} personas`} />
        </div>
      </section>

      <section aria-labelledby="adm-sug">
        <h2 id="adm-sug">Sugerencias</h2>
        <div className="adm-tabs" role="group" aria-label="Filtrar sugerencias">
          {(["todas", ...STATUSES] as const).map((f) => (
            <button key={f} className="btn line" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f}
              {f !== "todas" && ` · ${nf.format(items.filter((s) => s.status === f).length)}`}
            </button>
          ))}
        </div>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        {shown.length === 0 ? (
          <p className="doc-empty">No hay sugerencias {filter === "todas" ? "todavía" : `con estado «${filter}»`}.</p>
        ) : (
          <ul className="adm-list">
            {shown.map((s) => (
              <li key={s.id}>
                <p>{s.message}</p>
                <div className="adm-meta">
                  <span className="mono">
                    {kindLabel(s.kind)} · {s.email} · {when(s.created_at)}
                  </span>
                  <span className="adm-status">
                    {STATUSES.map((st) => (
                      <button key={st} className="btn line" aria-pressed={s.status === st} onClick={() => setStatus(s.id, st)}>
                        {st}
                      </button>
                    ))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
