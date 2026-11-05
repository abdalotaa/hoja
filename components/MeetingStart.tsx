"use client";

import { useRef, useState } from "react";
import { loadGlossary, saveGlossary } from "@/lib/glossary";
import { canShareAudio } from "@/lib/useMeeting";

interface Props {
  onStart: (o: { remote: boolean; glossary: string }) => void;
  onImport: (files: File[], glossary: string) => void;
  onClose: () => void;
}

const isMac = () => /Mac/i.test(navigator.userAgent) && !/iPhone|iPad/i.test(navigator.userAgent);

/** Chooses what to capture before a meeting starts, with what each computer and browser needs to share a call's sound. */
export default function MeetingStart({ onStart, onImport, onClose }: Props) {
  const share = canShareAudio();
  const mac = isMac();
  const [remote, setRemote] = useState(false);
  const [glossary, setGlossary] = useState(loadGlossary);
  const files = useRef<HTMLInputElement>(null);

  const remember = (value: string) => {
    setGlossary(value);
    saveGlossary(value);
  };

  return (
    <aside className="meet ds-win" aria-label="Nueva reunión">
      <div className="note-bar" style={{ cursor: "default" }}>
        <button className="dot close" aria-label="Cerrar" onClick={onClose} />
        <i className="dot" aria-hidden="true" />
        <i className="dot" aria-hidden="true" />
        <span className="note-label mono">reunión</span>
      </div>
      <div className="meet-body">
        <fieldset className="meet-choices">
          <legend className="sr-only">Qué grabar</legend>
          <label className={`meet-choice${!remote ? " on" : ""}`}>
            <input type="radio" name="what" checked={!remote} onChange={() => setRemote(false)} />
            <b>Solo mi micrófono</b>
            <small>Para una reunión en persona o una nota hablada.</small>
          </label>
          <label className={`meet-choice${remote ? " on" : ""}${!share ? " off" : ""}`}>
            <input type="radio" name="what" checked={remote} disabled={!share} onChange={() => setRemote(true)} />
            <b>Mi micrófono + una llamada (Zoom, Meet…)</b>
            <small>
              {share ? "Separa lo que dices tú de lo que dicen los demás, y al final los identifica por nombre." : "Necesita Chrome, Edge o Brave en una computadora."}
            </small>
          </label>
        </fieldset>

        {remote && (
          <div className="meet-help">
            <p>Al empezar, el navegador te pedirá qué compartir:</p>
            <ul>
              <li>
                <b>Zoom en el navegador:</b> elige la pestaña de Zoom y activa <b>«Compartir audio de la pestaña»</b>.
              </li>
              {mac ? (
                <li>
                  <b>App de Zoom en Mac:</b> elige <b>«Toda la pantalla»</b> y activa <b>«Compartir audio del sistema»</b>. Necesita Chrome 141 o más y macOS 14.2 o más; si no aparece esa opción, abre Zoom en el navegador.
                </li>
              ) : (
                <li>
                  <b>App de Zoom en Windows:</b> elige <b>«Toda la pantalla»</b> y activa <b>«Compartir audio del sistema»</b>.
                </li>
              )}
              <li>Usa audífonos: así tu micrófono no vuelve a captar la voz de los demás.</li>
            </ul>
            <p className="meet-warn">Avísales a los participantes que estás transcribiendo: Zoom no les muestra ningún aviso.</p>
          </div>
        )}

        <label className="meet-field">
          <span>Nombres y términos (opcional)</span>
          <input
            className="search"
            maxLength={300}
            placeholder="Marta Ruiz, Cliente Alfa, Hoja, M4PL3…"
            value={glossary}
            onChange={(e) => remember(e.target.value)}
          />
          <small>Ayuda a escribir bien los nombres propios. Se queda guardado en este navegador.</small>
        </label>

        <div className="meet-actions">
          <button className="btn" onClick={() => onStart({ remote, glossary })}>
            {remote ? "Elegir qué compartir y empezar" : "Empezar"}
          </button>
          <button className="btn line" onClick={() => files.current?.click()}>
            Importar grabación…
          </button>
          <input
            ref={files}
            type="file"
            accept="audio/*,video/mp4,.m4a,.mp3,.wav,.aac,.ogg,.webm"
            multiple
            hidden
            onChange={(e) => {
              const picked = [...(e.target.files ?? [])];
              e.target.value = "";
              if (picked.length) onImport(picked, glossary);
            }}
          />
        </div>
        <small className="meet-note">
          Importar: un archivo con todos, o uno por participante (en la app de Zoom: Configuración → Grabación → «Grabar un archivo de audio aparte por participante»).
        </small>
      </div>
    </aside>
  );
}
