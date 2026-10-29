"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const KEY = "hoja:tour:v1";
const EVENT = "hoja-tour";

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true; // storage blocked: don't nag on every visit
  }
}
/** Whether the first-run tour has been seen (or skipped) in this browser. */
export function useTourSeen(): boolean {
  return useSyncExternalStore(subscribe, seen, () => false);
}
function markSeen() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

interface Step {
  title: string;
  body: string;
  target?: string;
}

const STEPS: Step[] = [
  {
    title: "Bienvenida a Hoja",
    body: "Tus notas son ventanas sobre un lienzo sin bordes. Muévete arrastrando el fondo y haz zoom con los botones de abajo (o pellizcando, si tu dispositivo lo permite).",
  },
  {
    title: "Crea una nota",
    body: "Cada nota se abre como un documento. Arrástrala por su barra para moverla y escribe [[ para enlazarla con otra nota.",
    target: "new",
  },
  {
    title: "Ordena con libretas",
    body: "Cada libreta es su propio lienzo. Crea una por materia, cliente o proyecto, y mueve una nota entre libretas desde el editor.",
    target: "notebooks",
  },
  {
    title: "Habla en vez de escribir",
    body: "Dictar pasa tu voz a texto. Reunión además saca el resumen, las decisiones y los pendientes con su fecha.",
    target: "voice",
  },
  {
    title: "Pregúntale a tus notas",
    body: "Hoja responde con lo que tú escribiste y te dice de qué nota lo sacó. También hay plantillas para empezar rápido.",
    target: "ask",
  },
  {
    title: "Estudia y planea",
    body: "Estudio convierte tus notas en tarjetas de repaso, y Calendario junta tus pendientes con fecha.",
    target: "tabs",
  },
];

/** First-run walkthrough. Opens by itself for someone with no notes yet, and again from the menu. */
export default function Tour({
  name,
  ready,
  empty,
  forceOpen,
  onClose,
  onSample,
}: {
  name?: string;
  ready: boolean;
  empty: boolean;
  forceOpen: boolean;
  onClose: () => void;
  onSample: () => void;
}) {
  const done = useSyncExternalStore(subscribe, seen, () => true);
  const [step, setStep] = useState(0);
  const open = forceOpen || (ready && empty && !done);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  const close = () => {
    markSeen();
    setStep(0);
    onClose();
  };

  // Ring the control the step talks about, and make sure it is on screen (the mobile dock scrolls sideways).
  useEffect(() => {
    if (!open || !s.target) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${s.target}"]`);
    if (!el) return;
    el.classList.add("tour-hl");
    el.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    return () => el.classList.remove("tour-hl");
  }, [open, s.target]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // close only touches stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <aside className="tour ds-win" role="dialog" aria-label="Recorrido de Hoja" aria-live="polite">
      <div className="note-bar" style={{ cursor: "default" }}>
        <i className="dot close" aria-hidden="true" />
        <i className="dot" aria-hidden="true" />
        <i className="dot" aria-hidden="true" />
        <span className="note-label mono">
          paso {step + 1} de {STEPS.length}
        </span>
        <button className="tour-skip" onClick={close}>
          Saltar
        </button>
      </div>
      <div className="tour-body">
        <h2>{step === 0 && name ? `Hola, ${name.split(" ")[0]}` : s.title}</h2>
        <p>{s.body}</p>
        <div className="tour-dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <i key={i} data-on={i === step} />
          ))}
        </div>
        <div className="tour-actions">
          {step > 0 && (
            <button className="btn line btn-sm" onClick={() => setStep(step - 1)}>
              Atrás
            </button>
          )}
          {last ? (
            <>
              <button
                className="btn line btn-sm"
                onClick={() => {
                  close();
                  onSample();
                }}
              >
                Probar con una nota de ejemplo
              </button>
              <button className="btn btn-sm" onClick={close}>
                Empezar
              </button>
            </>
          ) : (
            <button className="btn btn-sm" onClick={() => setStep(step + 1)}>
              Siguiente
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
