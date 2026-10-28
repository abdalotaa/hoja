"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

export default function LoginForm({ linkError }: { linkError: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(linkError ? "El enlace venció o ya se usó. Pide uno nuevo." : null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError(null);
    const { error } = await getBrowserClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setState("idle");
      setError(error.status === 429 ? "Pediste muchos enlaces. Espera un minuto." : "No se pudo enviar el enlace. Revisa el correo.");
      return;
    }
    setState("sent");
  };

  return (
    <main className="login canvas">
      <section className="login-card note" style={{ position: "relative" }}>
        <header className="note-bar" style={{ cursor: "default" }}>
          <i className="dot close" aria-hidden="true" />
          <i className="dot" aria-hidden="true" />
          <i className="dot" aria-hidden="true" />
          <span className="note-label mono">entrar</span>
        </header>
        <div className="login-body">
          <img src="/m4-symbol.svg" alt="" width={34} height={34} />
          <h1>Hoja</h1>
          {state === "sent" ? (
            <>
              <p className="hand login-hand">revisa tu correo ↗</p>
              <p>
                Te enviamos un enlace a <b>{email}</b>. Ábrelo en este mismo navegador para entrar. Si no llega, mira en spam.
              </p>
              <button className="btn line" onClick={() => setState("idle")}>
                Usar otro correo
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              <p>Tus notas, en cualquier dispositivo. Entra con tu correo, sin contraseña.</p>
              <label className="mono" htmlFor="email">
                Correo
              </label>
              <input
                id="email"
                className="search login-input"
                type="email"
                required
                autoComplete="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}
              <button className="btn" type="submit" disabled={state === "sending"}>
                {state === "sending" ? "Enviando…" : "Enviarme el enlace"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
