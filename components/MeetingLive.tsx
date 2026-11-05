"use client";

import { useEffect, useRef } from "react";
import { defaultName, formatClock, type MeetingLine, type Source } from "@/lib/meeting";
import type { Status } from "@/lib/useMeeting";

interface Props {
  title: string;
  elapsed: number;
  lines: MeetingLine[];
  partial: Record<Source, string>;
  levels: Record<Source, number>;
  status: Record<Source, Status>;
  remote: boolean;
  error: string | null;
}

const LABEL: Record<Source, string> = { mic: "Tú", remote: "Participantes" };

function Meter({ src, level, status }: { src: Source; level: number; status: Status }) {
  const trouble = status.state === "reconnecting" || status.state === "failed" || status.detail;
  return (
    <div className="meter" data-state={status.state}>
      <span className="meter-name">{LABEL[src]}</span>
      <span className="meter-bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${Math.max(0.02, level)})` }} />
      </span>
      <span className="meter-state">
        {status.state === "connecting" && "conectando…"}
        {status.state === "reconnecting" && "reconectando…"}
        {status.state === "failed" && "sin conexión (se guarda el audio)"}
        {status.state === "closed" && status.detail}
        {status.state === "live" && trouble && status.detail}
      </span>
    </div>
  );
}

/** What is being heard right now: text as it arrives, who said it, and whether each source is alive. */
export default function MeetingLive({ title, elapsed, lines, partial, levels, status, remote, error }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const live = [partial.mic, partial.remote].filter(Boolean).join(" ");

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [lines.length, live]);

  return (
    <aside className="live meet-live ds-win" role="status" aria-live="polite">
      <div className="note-bar" style={{ cursor: "default" }}>
        <i className="dot close" aria-hidden="true" />
        <i className="dot" aria-hidden="true" />
        <i className="dot" aria-hidden="true" />
        <span className="note-label mono">
          {title} · {formatClock(elapsed)}
        </span>
      </div>
      <div className="meters">
        <Meter src="mic" level={levels.mic} status={status.mic} />
        {remote && <Meter src="remote" level={levels.remote} status={status.remote} />}
      </div>
      <div className="live-lines" ref={box}>
        {lines.length === 0 && !live && <p className="live-interim">Habla, te escucho… el texto aparece unos segundos después de cada frase.</p>}
        {lines.map((l) => (
          <p key={l.id} className={`live-line ${l.src}`}>
            {remote && <b>{defaultName(l.speaker)}</b>} {l.text}
          </p>
        ))}
        {live && <p className="live-line live-interim">{live}</p>}
        {error && <p className="live-interim">{error}</p>}
      </div>
    </aside>
  );
}
