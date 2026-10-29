"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export interface MenuItem {
  label: string;
  hint?: string;
  onSelect: () => void;
  disabled?: boolean;
}

const subscribeNarrow = (cb: () => void) => {
  const m = window.matchMedia("(max-width: 700px)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const isNarrow = () => window.matchMedia("(max-width: 700px)").matches;

/**
 * A small dropdown that closes on outside click or Escape. On a phone it is a bottom sheet drawn at the top level
 * of the page: inside the scrolling tool dock it would be clipped (iOS Safari) and the buttons would seem dead.
 */
export default function Menu({ label, items, className = "btn line" }: { label: string; items: MenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const sheet = useSyncExternalStore(subscribeNarrow, isNarrow, () => false);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const popup = (
        <div className="menu-pop" role="menu" ref={popRef}>
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
            >
              <b>{it.label}</b>
              {it.hint && <small>{it.hint}</small>}
            </button>
          ))}
        </div>
  );

  return (
    <div className="menu" ref={ref}>
      <button className={className} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open && (sheet ? createPortal(popup, document.body) : popup)}
    </div>
  );
}
