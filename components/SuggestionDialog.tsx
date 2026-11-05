"use client";

import { useState } from "react";
import { KINDS, type Kind } from "@/lib/admin";
import { getBrowserClient } from "@/lib/supabase/client";

const MAX = 2000;

/** A small box to tell the team an idea, a problem or anything else. */
export default function SuggestionDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<Kind>("idea");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || message.trim().length < 3) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await getBrowserClient().rpc("send_suggestion", { p_kind: kind, p_message: message });
    setBusy(false);
    if (err) return setError("No se pudo enviar. Inténtalo de nuevo.");
    if (data !== true) return setError("Llegaste al límite de hoy. Escríbenos mañana.");
    setSent(true);
    setMessage("");
  };

  return (
    <aside className="ask ds-win" aria-label="Sugerencias">
      <div className="note-bar" style={{ cursor: "default" }}>
        <button className="dot close" aria-label="Cerrar" onClick={onClose} />
        <i className="dot" aria-hidden="true" />
        <i className="dot" aria-hidden="true" />
        <span className="note-label mono">sugerencias</span>
      </div>
      <div className="ask-body">
        {sent ? (
          <>
            <p role="status">¡Gracias! Lo leemos todo. Tu sugerencia ya llegó.</p>
            <button className="btn" onClick={() => setSent(false)}>
              Enviar otra
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <p>¿Qué le falta a Hoja, o qué te estorba? Cuéntanos.</p>
            <div className="adm-tabs" role="group" aria-label="Tipo de sugerencia">
              {KINDS.map((k) => (
                <button type="button" key={k.id} className="btn line" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                  {k.label}
                </button>
              ))}
            </div>
            <textarea
              className="search"
              rows={5}
              autoFocus
              maxLength={MAX}
              aria-label="Tu sugerencia"
              placeholder="Me gustaría poder…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            {error && (
              <p className="ask-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn" type="submit" disabled={busy || message.trim().length < 3}>
              {busy ? "Enviando…" : "Enviar"}
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
