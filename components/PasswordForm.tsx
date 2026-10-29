"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

const MIN_PASSWORD = 8;

export default function PasswordForm({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== again) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    const { error: err } = await getBrowserClient().auth.updateUser({ password });
    if (err) {
      setBusy(false);
      setError(
        err.code === "weak_password"
          ? "Esa contraseña es muy fácil de adivinar. Prueba con una más larga o con más variedad."
          : err.code === "same_password"
            ? "La contraseña nueva debe ser distinta a la anterior."
            : "No se pudo cambiar la contraseña. Inténtalo de nuevo.",
      );
      return;
    }
    window.location.assign("/");
  };

  return (
    <main className="login canvas">
      <section className="login-card note" style={{ position: "relative" }}>
        <header className="note-bar" style={{ cursor: "default" }}>
          <i className="dot close" aria-hidden="true" />
          <i className="dot" aria-hidden="true" />
          <i className="dot" aria-hidden="true" />
          <span className="note-label mono">nueva contraseña</span>
        </header>
        <div className="login-body">
          <img src="/m4-symbol.svg" alt="" width={34} height={34} />
          <h1>Hoja</h1>
          <form onSubmit={submit} noValidate>
            <p>
              Elige una contraseña nueva{email ? <> para <b>{email}</b></> : null}.
            </p>
            <label className="mono" htmlFor="new-password">
              Contraseña nueva
            </label>
            <div className="login-pass">
              <input
                id="new-password"
                className="search login-input"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="tag" onClick={() => setShow((s) => !s)} aria-pressed={show}>
                {show ? "Ocultar" : "Ver"}
              </button>
            </div>
            <label className="mono" htmlFor="again">
              Repítela
            </label>
            <input
              id="again"
              className="search login-input"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
            />
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
