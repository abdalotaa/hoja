"use client";

import Link from "next/link";
import { useState } from "react";
import { cleanName, MAX_NAME } from "@/lib/profile";
import { getBrowserClient } from "@/lib/supabase/client";

export default function AccountForm({ email, name: initial }: { email: string; name: string }) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    const { error: err } = await getBrowserClient().auth.updateUser({ data: { name: cleanName(name) } });
    setBusy(false);
    if (err) {
      setError("No se pudo guardar tu nombre. Inténtalo de nuevo.");
      return;
    }
    setName(cleanName(name));
    setSaved(true);
  };

  return (
    <main className="login canvas">
      <section className="login-card note" style={{ position: "relative" }}>
        <header className="note-bar" style={{ cursor: "default" }}>
          <i className="dot close" aria-hidden="true" />
          <i className="dot" aria-hidden="true" />
          <i className="dot" aria-hidden="true" />
          <span className="note-label mono">mi cuenta</span>
        </header>
        <div className="login-body">
          <img src="/m4-symbol.svg" alt="" width={34} height={34} />
          <h1>Hola{name ? `, ${name.split(" ")[0]}` : ""}</h1>
          <form onSubmit={submit} noValidate>
            <label className="mono" htmlFor="name">
              Tu nombre
            </label>
            <input
              id="name"
              className="search login-input"
              autoComplete="name"
              maxLength={MAX_NAME}
              placeholder="Cómo quieres que te llame"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
            />
            <p className="doc-empty">Correo: {email}</p>
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            {saved && <p role="status">Listo, guardé tu nombre.</p>}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </form>
          <p>
            <Link href="/cambiar-contrasena">Cambiar contraseña</Link> · <Link href="/">Volver a mis notas</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
