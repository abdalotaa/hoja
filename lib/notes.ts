export type Tone = "butter" | "mint" | "rust" | "none";

export interface Note {
  id: string;
  title: string;
  text: string;
  tone: Tone;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  updatedAt: number;
}

export const STORAGE_KEY = "hoja:notes:v1";
export const TONES: Tone[] = ["none", "butter", "mint", "rust"];
export const TONE_LABEL: Record<Tone, string> = {
  none: "Nota",
  butter: "Idea",
  mint: "Pendiente",
  rust: "Importante",
};

export function newNote(index: number, z: number, at?: { x: number; y: number }): Note {
  return {
    id: crypto.randomUUID(),
    title: "",
    text: "",
    tone: "none",
    x: at?.x ?? 80 + (index % 6) * 36,
    y: at?.y ?? 70 + (index % 6) * 36,
    w: 320,
    h: 260,
    z,
    updatedAt: Date.now(),
  };
}

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Note[]) : [];
  } catch {
    return [];
  }
}

export function saveNotes(notes: Note[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}
