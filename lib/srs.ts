import type { Card } from "./model";

export type Rating = "again" | "hard" | "good" | "easy";

const DAY = 24 * 60 * 60 * 1000;

export const RATINGS: { id: Rating; label: string }[] = [
  { id: "again", label: "Otra vez" },
  { id: "hard", label: "Difícil" },
  { id: "good", label: "Bien" },
  { id: "easy", label: "Fácil" },
];

/** Simplified SM-2: the next review gets farther away each time you remember a card. */
export function schedule(card: Card, rating: Rating, now = Date.now()): Card {
  let { interval, ease, reps } = card;

  if (rating === "again") {
    reps = 0;
    interval = 0;
    ease = Math.max(1.3, ease - 0.2);
    return { ...card, reps, interval, ease, due: now, updatedAt: now };
  }

  reps += 1;
  if (rating === "hard") {
    interval = reps === 1 ? 1 : Math.max(1, Math.round(interval * 1.2));
    ease = Math.max(1.3, ease - 0.15);
  } else if (rating === "good") {
    interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(interval * ease);
  } else {
    interval = reps === 1 ? 3 : Math.round(Math.max(interval, 1) * ease * 1.3);
    ease += 0.15;
  }
  return { ...card, reps, interval, ease, due: now + interval * DAY, updatedAt: now };
}

export function intervalLabel(card: Card, rating: Rating): string {
  if (rating === "again") return "ahora";
  const d = schedule(card, rating).interval;
  return d < 30 ? `${d} d` : d < 365 ? `${Math.round(d / 30)} mes` : `${(d / 365).toFixed(1)} año`;
}
