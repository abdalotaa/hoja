"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTourSeen } from "./Tour";

const KEY = "hoja:install:v1";
const EVENT = "hoja-install";

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
const dismissed = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
};
function dismiss() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

const PHONE = "(max-width: 820px) and (pointer: coarse)";
const subscribePhone = (cb: () => void) => {
  const m = window.matchMedia(PHONE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const isPhone = () => window.matchMedia(PHONE).matches;
const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const isApple = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

const ShareIcon = () => (
  <svg className="install-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** On a phone, a short guide to put Hoja on the home screen. It opens once after the tour, and on demand from the menu. */
export default function InstallTip({ ready, forceOpen, onClose }: { ready: boolean; forceOpen: boolean; onClose: () => void }) {
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  const done = useSyncExternalStore(subscribe, dismissed, () => true);
  const tourSeen = useTourSeen();
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep the browser's own mini-banner from showing; we offer the install ourselves
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => {
      setEvent(null);
      dismiss();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const auto = ready && phone && tourSeen && !done && !isInstalled();
  // Not the moment the tour ends: give the person a few seconds with the app first.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => setArmed(true), 6000);
    return () => clearTimeout(t);
  }, [auto]);
  if (!forceOpen && !(auto && armed)) return null;

  const close = () => {
    dismiss();
    onClose();
  };
  const apple = isApple();

  return (
    <aside className="install ds-win" role="dialog" aria-label="Agregar Hoja a la pantalla de inicio">
      <div className="note-bar" style={{ cursor: "default" }}>
        <i className="dot close" aria-hidden="true" />
        <i className="dot" aria-hidden="true" />
        <i className="dot" aria-hidden="true" />
        <span className="note-label mono">pantalla de inicio</span>
        <button className="tour-skip" onClick={close}>
          Ahora no
        </button>
      </div>
      <div className="tour-body">
        <h2>Ten Hoja a un toque</h2>
        <p>Agrégala a tu pantalla de inicio: se abre como una app, sin barra del navegador.</p>
        {event ? (
          <div className="tour-actions">
            <button
              className="btn btn-sm"
              onClick={async () => {
                await event.prompt();
                setEvent(null);
                close();
              }}
            >
              Instalar Hoja
            </button>
          </div>
        ) : apple ? (
          <ol className="install-steps">
            <li>
              Toca <b>Compartir</b> <ShareIcon /> en la barra de Safari.
            </li>
            <li>
              Elige <b>Agregar a inicio</b>.
            </li>
            <li>
              Toca <b>Agregar</b>.
            </li>
          </ol>
        ) : (
          <ol className="install-steps">
            <li>
              Abre el menú <b>⋮</b> del navegador.
            </li>
            <li>
              Elige <b>Instalar app</b> o <b>Agregar a la pantalla de inicio</b>.
            </li>
          </ol>
        )}
        <div className="tour-actions">
          <button className="btn line btn-sm" onClick={close}>
            Entendido
          </button>
        </div>
      </div>
    </aside>
  );
}
