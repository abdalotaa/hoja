"use client";

import { useEffect } from "react";

/** Lets visitors drag the stickers and example notes around, like the m4pl3 site. Arrow keys nudge a focused one. */
export default function LandingDrag() {
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    document.querySelectorAll<HTMLElement>(".landing [data-drag]").forEach((el) => {
      let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
      // On small screens the example windows flow in the page instead of floating; leave those alone.
      const floating = () => getComputedStyle(el).position === "absolute";
      const pin = () => {
        const parent = (el.offsetParent as HTMLElement).getBoundingClientRect();
        const r = el.getBoundingClientRect();
        el.style.left = `${r.left - parent.left}px`;
        el.style.top = `${r.top - parent.top}px`;
        el.style.right = "auto";
        el.style.bottom = "auto";
      };
      const down = (e: PointerEvent) => {
        if (!floating()) return;
        el.setPointerCapture(e.pointerId);
        pin();
        dragging = true;
        el.classList.add("dragging");
        sx = e.clientX; sy = e.clientY;
        ox = parseFloat(el.style.left); oy = parseFloat(el.style.top);
      };
      const move = (e: PointerEvent) => {
        if (!dragging) return;
        el.style.left = `${ox + e.clientX - sx}px`;
        el.style.top = `${oy + e.clientY - sy}px`;
      };
      const up = () => {
        dragging = false;
        el.classList.remove("dragging");
      };
      const key = (e: KeyboardEvent) => {
        const d = ({ ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] } as Record<string, number[]>)[e.key];
        if (!d || !floating()) return;
        e.preventDefault();
        pin();
        el.style.left = `${parseFloat(el.style.left) + d[0]}px`;
        el.style.top = `${parseFloat(el.style.top) + d[1]}px`;
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("keydown", key);
      cleanups.push(() => {
        el.removeEventListener("pointerdown", down);
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        el.removeEventListener("keydown", key);
      });
    });
    return () => cleanups.forEach((c) => c());
  }, []);
  return null;
}
