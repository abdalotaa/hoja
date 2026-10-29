"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "reset" | "link";

const MIN_PASSWORD = 8;

const TITLES: Record<Mode, string> = {
  signin: "entrar",
  signup: "crear cuenta",
  reset: "recuperar contraseña",
  link: "entrar con enlace",
};

/** Turns Supabase auth errors into messages a person can act on. */
function explain(error: { status?: number; code?: string; message?: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Falta confirmar tu correo. Revisa tu bandeja (y spam) o pide otro enlace.";
    case "weak_password":
      return "Esa contraseña es muy fácil de adivinar. Prueba con una más larga o con más variedad.";
    case "over_email_send_rate_limit":
      return "Se enviaron muchos correos. Espera unos minutos e inténtalo de nuevo.";
    case "over_request_rate_limit":
      return "Demasiados intentos. Espera unos minutos.";
    case "user_already_exists":
      return "Ese correo ya tiene cuenta. Entra o recupera tu contraseña.";
  }
  if (error.status === 429) return "Demasiados intentos. Espera unos minutos.";
  return "No se pudo completar. Revisa tus datos e inténtalo de nuevo.";
}

export default function LoginForm({ linkError }: { linkError: boolean }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<"confirm" | "reset" | "link" | null>(null);
  const [error, setError] = useState<string | null>(linkError ? "El enlace venció o ya se usó. Pide uno nuevo." : null);

  const go = (m: Mode) => {
    setMode(m);
    setError(null);
    setSent(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const mail = email.trim();
    const needsPassword = mode === "signin" || mode === "signup";
    if (needsPassword && password.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }

    setBusy(true);
    const auth = getBrowserClient().auth;
    const origin = window.location.origin;

    if (mode === "signin") {
      const { error: err } = await auth.signInWithPassword({ email: mail, password });
      if (err) return fail(err);
      window.location.assign("/");
      return;
    }

    if (mode === "signup") {
      const { data, error: err } = await auth.signUp({
        email: mail,
        password,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (err) return fail(err);
      if (data.session) {
        window.location.assign("/");
        return;
      }
      setBusy(false);
      setSent("confirm");
      return;
    }

    if (mode === "reset") {
      const { error: err } = await auth.resetPasswordForEmail(mail, {
        redirectTo: `${origin}/auth/callback?next=/cambiar-contrasena`,
      });
      if (err) return fail(err);
      setBusy(false);
      setSent("reset");
      return;
    }

    const { error: err } = await auth.signInWithOtp({ email: mail, options: { emailRedirectTo: `${origin}/auth/callback` } });
    if (err) return fail(err);
    setBusy(false);
    setSent("link");
  };

  function fail(err: { status?: number; code?: string; message?: string }) {
    setBusy(false);
    setError(explain(err));
  }

  const needsPassword = mode === "signin" || mode === "signup";

  return (
    <main className="login canvas">
      <section className="login-card note" style={{ position: "relative" }}>
        <header className="note-bar" style={{ cursor: "default" }}>
          <i className="dot close" aria-hidden="true" />
          <i className="dot" aria-hidden="true" />
          <i className="dot" aria-hidden="true" />
          <span className="note-label mono">{TITLES[mode]}</span>
        </header>
        <div className="login-body">
          <img src="/m4-symbol.svg" alt="" width={34} height={34} />
          <h1>Hoja</h1>

          {sent ? (
            <>
              <p className="hand login-hand">revisa tu correo ↗</p>
              <p>
                {sent === "confirm" && (
                  <>
                    Te enviamos un enlace a <b>{email}</b> para confirmar tu cuenta. Ábrelo en este navegador. Si no llega, mira en spam.
                  </>
                )}
                {sent === "reset" && (
                  <>
                    Si <b>{email}</b> tiene cuenta, le enviamos un enlace para elegir una contraseña nueva.
                  </>
                )}
                {sent === "link" && (
                  <>
                    Te enviamos un enlace a <b>{email}</b>. Ábrelo en este mismo navegador para entrar.
                  </>
                )}
              </p>
              <button className="btn line" onClick={() => go("signin")}>
                Volver a entrar
              </button>
            </>
          ) : (
            <form onSubmit={submit} noValidate>
              {(mode === "signin" || mode === "signup") && (
                <div className="login-tabs" role="tablist">
                  <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => go("signin")}>
                    Entrar
                  </button>
                  <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => go("signup")}>
                    Crear cuenta
                  </button>
                </div>
              )}
              {mode === "reset" && <p>Escribe tu correo y te enviamos un enlace para elegir una contraseña nueva.</p>}
              {mode === "link" && <p>Sin contraseña: te enviamos un enlace para entrar.</p>}

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

              {needsPassword && (
                <>
                  <label className="mono" htmlFor="password">
                    Contraseña
                  </label>
                  <div className="login-pass">
                    <input
                      id="password"
                      className="search login-input"
                      type={show ? "text" : "password"}
                      required
                      minLength={MIN_PASSWORD}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      placeholder={mode === "signup" ? `Mínimo ${MIN_PASSWORD} caracteres` : "Tu contraseña"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button type="button" className="tag" onClick={() => setShow((s) => !s)} aria-pressed={show}>
                      {show ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                </>
              )}

              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}

              <button className="btn" type="submit" disabled={busy || !email.trim()}>
                {busy
                  ? "Un momento…"
                  : mode === "signin"
                    ? "Entrar"
                    : mode === "signup"
                      ? "Crear mi cuenta"
                      : mode === "reset"
                        ? "Enviarme el enlace"
                        : "Enviarme el enlace"}
              </button>

              <div className="login-alt">
                {mode === "signin" && (
                  <button type="button" onClick={() => go("reset")}>
                    Olvidé mi contraseña
                  </button>
                )}
                {(mode === "signin" || mode === "signup") && (
                  <button type="button" onClick={() => go("link")}>
                    Entrar con enlace al correo
                  </button>
                )}
                {(mode === "reset" || mode === "link") && (
                  <button type="button" onClick={() => go("signin")}>
                    ← Volver
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
