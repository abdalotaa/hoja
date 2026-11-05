import { ai, type Meeting } from "./ai";
import { splitBlocks } from "./polish";

/** The AI takes about 40,000 characters at a time; a longer meeting is summarized in parts and the parts are joined. */
export const PART_CHARS = 30_000;

const digest = (parts: Meeting[]) =>
  parts
    .map((p, i) => {
      const actions = p.actions.map((a) => `- ${a.task} | responsable: ${a.owner ?? "ninguno"} | fecha: ${a.due ?? "ninguna"}`);
      return [
        `Parte ${i + 1} de ${parts.length}`,
        `Resumen: ${p.summary}`,
        `Decisiones:\n${p.decisions.map((d) => `- ${d}`).join("\n") || "- ninguna"}`,
        `Pendientes:\n${actions.join("\n") || "- ninguno"}`,
      ].join("\n");
    })
    .join("\n\n");

export async function summarizeMeeting(text: string, today: string, onPart?: (part: number, parts: number) => void): Promise<Meeting> {
  if (text.length <= PART_CHARS) return ai("meeting", { text, today });
  const blocks = splitBlocks(text, PART_CHARS);
  const parts: Meeting[] = [];
  for (let i = 0; i < blocks.length; i++) {
    onPart?.(i + 1, blocks.length);
    parts.push(await ai("meeting", { text: blocks[i].text, today }));
  }
  onPart?.(blocks.length, blocks.length);
  return ai("meetingmerge", { text: digest(parts), today });
}
