import { ai } from "./ai";

/** Spelling and punctuation pass over a transcript, block by block, that never replaces text with something off. */

const BLOCK = 9_000;

interface Unit {
  text: string;
  sep: string;
}

export function splitBlocks(text: string, max = BLOCK): { text: string; sep: string }[] {
  const units: Unit[] = [];
  const paragraphs = text.split(/\n{2,}/);
  paragraphs.forEach((p, i) => {
    const sep = i < paragraphs.length - 1 ? "\n\n" : "";
    if (p.length <= max) return void units.push({ text: p, sep });
    // One enormous paragraph (a long monologue): cut it at sentence ends.
    const sentences = p.split(/(?<=[.!?¿?])\s+/);
    sentences.forEach((s, j) => units.push({ text: s, sep: j < sentences.length - 1 ? " " : sep }));
  });

  const blocks: Unit[] = [];
  for (const u of units) {
    const last = blocks[blocks.length - 1];
    if (last && last.text.length + last.sep.length + u.text.length <= max) {
      last.text = `${last.text}${last.sep}${u.text}`;
      last.sep = u.sep;
    } else {
      blocks.push({ ...u });
    }
  }
  return blocks;
}

/** A corrected block is only trusted if it keeps the same lines and about the same length. */
export function plausible(before: string, after: string): boolean {
  if (!after.trim()) return false;
  const ratio = after.length / before.length;
  const lines = (s: string) => s.split("\n").filter((l) => l.trim()).length;
  return ratio > 0.8 && ratio < 1.25 && lines(before) === lines(after);
}

export async function polishTranscript(text: string, glossary: string): Promise<{ text: string; ok: boolean }> {
  if (text.trim().length < 20) return { text, ok: true };
  const out: string[] = [];
  let ok = true;
  for (const block of splitBlocks(text)) {
    let fixed = block.text;
    if (block.text.trim().length >= 20) {
      try {
        const res = await ai("polish", { text: block.text, glossary });
        if (plausible(block.text, res.text)) fixed = res.text.trim();
        else ok = false;
      } catch {
        ok = false;
      }
    }
    out.push(fixed + block.sep);
  }
  return { text: out.join(""), ok };
}
