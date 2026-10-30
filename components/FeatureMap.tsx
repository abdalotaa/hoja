"use client";

import { useState } from "react";

const NODES = [
  { id: "lienzo", label: "Lienzo sin bordes", tone: "butter", title: "Un lienzo sin bordes", body: "Cada nota es una ventana. Muévete arrastrando el fondo, haz zoom con los dedos y acomódalo todo con un botón. Si no te gusta, Deshacer.", chips: ["Arrastra y haz zoom", "Ordenar y centrar", "Igual en el teléfono"] },
  { id: "enlaces", label: "Notas conectadas", tone: "mint", title: "Notas que se conectan", body: "Escribe [[ y elige otra nota. Hoja dibuja la flecha entre las dos y cada nota sabe quién la menciona.", chips: ["Enlaces con [[ ]]", "Flechas automáticas", "Menciones e índice"] },
  { id: "mapa", label: "Mapas mentales", tone: "butter", title: "De una nota a un mapa mental", body: "Con IA ✦, una nota se vuelve un mapa de ideas conectadas: el tema al centro y cada rama a su lugar.", chips: ["Un clic", "Se mueve como bloque", "Editable"] },
  { id: "reunion", label: "Reuniones", tone: "rust", title: "Reuniones que terminan en pendientes", body: "Pulsa Reunión y habla. Al terminar tienes el resumen, las decisiones y los pendientes con responsable y fecha, listos para el calendario.", chips: ["Transcribe en español", "Pendientes con fecha", "Tu audio no se pierde"] },
  { id: "tablas", label: "Tablas con totales", tone: "mint", title: "Tablas con totales", body: "Una tabla es una nota más: texto, números, dinero y fechas. El total, el promedio y lo que gastas por categoría, siempre a la vista.", chips: ["Plantillas de gastos y clientes", "Enter baja de fila", "CSV"] },
  { id: "estudio", label: "Estudio", tone: "butter", title: "Estudia lo que escribiste", body: "De tus apuntes salen tarjetas de repaso. Las repasas con la barra espaciadora y Hoja decide cuándo mostrártelas otra vez. Para el examen, una guía con varias notas.", chips: ["Repetición espaciada", "Teclas 1 a 4", "Guías de examen"] },
  { id: "libretas", label: "Libretas", tone: "mint", title: "Libretas para cada cosa", body: "Una libreta por materia, cliente o proyecto, cada una con su propio lienzo. Las notas se mueven entre libretas desde el editor.", chips: ["Cada libreta, su lienzo", "Búsqueda en todas", "Respaldo en JSON"] },
] as const;

// Where each branch sits on the map (percent of the box) and where its line leaves the central note.
const SLOTS = [8, 22, 36, 50, 64, 78, 92];

/** The product as a mind map: pick a branch and its note opens on the right. */
export default function FeatureMap() {
  const [active, setActive] = useState(0);
  const node = NODES[active];
  return (
    <div className="lx-map lx-canvas">
      <svg className="lx-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {SLOTS.map((y, i) => (
          <path key={i} d={`M 23 50 C 33 50, 33 ${y}, 41 ${y}`} fill="none" stroke={i === active ? "#8c2f1e" : "#17140f"} strokeWidth={i === active ? 2.6 : 1.6} vectorEffect="non-scaling-stroke" strokeDasharray={i === active ? "0" : "5 5"} />
        ))}
      </svg>
      <div className="lx-map-root">
        <b>Hoja</b>
        <span className="mono">tus notas</span>
      </div>
      {NODES.map((n, i) => (
        <button
          key={n.id}
          className="lx-node"
          data-tone={n.tone}
          aria-pressed={i === active}
          style={{ "--y": `${SLOTS[i]}%` } as React.CSSProperties}
          onClick={() => setActive(i)}
          onMouseEnter={() => setActive(i)}
        >
          {n.label}
        </button>
      ))}
      <article className="lx-win lx-map-detail" aria-live="polite">
        <div className="lx-win-bar"><i /><i /><i /><span className="mono">{String(active + 1).padStart(2, "0")} / {String(NODES.length).padStart(2, "0")}</span></div>
        <div className="lx-win-body">
          <h3>{node.title}</h3>
          <p>{node.body}</p>
          <ul className="lx-chips">
            {node.chips.map((c) => (
              <li key={c} className="lx-chip">{c}</li>
            ))}
          </ul>
        </div>
      </article>
    </div>
  );
}
