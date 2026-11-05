import { describe, expect, it } from "vitest";
import { defaultName, dropEchoes, fileSpeaker, mergeSegments, renderTranscript, speakersOf, type MeetingLine } from "../lib/meeting";
import { pcmToBase64, Resampler, toPcm16 } from "../lib/pcm";
import { plausible, splitBlocks } from "../lib/polish";
import { cleanGlossary, buildPrompt } from "../lib/vocabulary";

const line = (t: number, src: "mic" | "remote", speaker: string, text: string): MeetingLine => ({ id: `${t}${speaker}`, t, src, speaker, text });

describe("echo removal", () => {
  it("drops a microphone line that repeats what the call just said", () => {
    const lines = [
      line(10, "remote", "remote", "Necesito que revises el contrato antes del lunes"),
      line(11, "mic", "mic", "necesito que revises el contrato antes del lunes"),
      line(20, "mic", "mic", "Sí, lo reviso el domingo por la noche"),
    ];
    expect(dropEchoes(lines).map((l) => l.text)).toEqual(["Necesito que revises el contrato antes del lunes", "Sí, lo reviso el domingo por la noche"]);
  });
  it("keeps the same words said much later or too short to compare", () => {
    const lines = [line(10, "remote", "remote", "revisa el contrato antes del lunes"), line(100, "mic", "mic", "revisa el contrato antes del lunes"), line(11, "mic", "mic", "sí")];
    expect(dropEchoes(lines)).toHaveLength(3);
  });
});

describe("transcript", () => {
  it("stays plain when only the microphone spoke", () => {
    expect(renderTranscript([line(0, "mic", "mic", "Hola."), line(2, "mic", "mic", "Adiós.")])).toBe("Hola. Adiós.");
  });
  it("names each turn and joins consecutive turns of the same person", () => {
    const lines = [line(0, "mic", "mic", "Hola."), line(3, "remote", "sp-A", "Qué tal."), line(5, "remote", "sp-A", "Todo bien."), line(8, "remote", "sp-B", "Yo igual.")];
    expect(renderTranscript(lines, { "sp-A": "Marta" })).toBe("Tú: Hola.\n\nMarta: Qué tal. Todo bien.\n\nHablante B: Yo igual.");
  });
  it("lists speakers with their first words", () => {
    const info = speakersOf([line(0, "remote", "sp-A", "uno"), line(2, "remote", "sp-A", "dos tres cuatro"), line(4, "remote", "sp-B", "otro")]);
    expect(info.map((s) => [s.key, s.count])).toEqual([["sp-A", 2], ["sp-B", 1]]);
    expect(info[0].sample).toBe("dos tres cuatro");
  });
  it("names speakers by key", () => {
    expect(defaultName("sp-A")).toBe("Hablante A");
    expect(defaultName("mic")).toBe("Tú");
    expect(defaultName("f:Marta López")).toBe("Marta López");
  });
  it("reads a person's name from a Zoom per-participant file", () => {
    expect(fileSpeaker("audioMarta López3046718.m4a", 0)).toBe("f:Marta López");
    expect(fileSpeaker("audio_1234.m4a", 1)).toBe("f:Participante 2");
  });
});

describe("segments", () => {
  it("merges close consecutive pieces from the same speaker only", () => {
    const merged = mergeSegments([
      { start: 0, end: 0.3, speaker: "A", text: "Bueno," },
      { start: 0.6, end: 1.4, speaker: "A", text: "empezamos." },
      { start: 8, end: 10, speaker: "B", text: "Listo." },
      { start: 11, end: 12, speaker: "A", text: "Gracias." },
    ]);
    expect(merged.map((s) => [s.speaker, s.text])).toEqual([["A", "Bueno, empezamos."], ["B", "Listo."], ["A", "Gracias."]]);
  });
});

describe("pcm", () => {
  it("resamples 48 kHz to 24 kHz keeping the shape across blocks", () => {
    const r = new Resampler(48_000);
    const ramp = Float32Array.from({ length: 480 }, (_, i) => i / 480);
    const out = [...r.process(ramp.subarray(0, 200)), ...r.process(ramp.subarray(200))];
    expect(out.length).toBeGreaterThanOrEqual(239);
    expect(out.length).toBeLessThanOrEqual(240);
    for (let i = 1; i < out.length; i++) expect(out[i]).toBeGreaterThan(out[i - 1]);
  });
  it("converts to 16-bit and base64", () => {
    const pcm = toPcm16(Float32Array.from([0, 1, -1, 2]));
    expect([...pcm]).toEqual([0, 32767, -32768, 32767]);
    expect(pcmToBase64(Int16Array.from([1, 2]))).toBe(btoa(String.fromCharCode(1, 0, 2, 0)));
  });
});

describe("polish helpers", () => {
  it("splits long text at paragraph boundaries into blocks under the limit", () => {
    const text = Array.from({ length: 6 }, (_, i) => `Marta: ${"palabra ".repeat(40)}${i}`).join("\n\n");
    const blocks = splitBlocks(text, 700);
    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks.every((b) => b.text.length <= 700)).toBe(true);
    expect(blocks.map((b) => b.text + b.sep).join("")).toBe(text);
  });
  it("splits a single huge paragraph at sentence ends", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Frase número ${i} de la nota.`).join(" ");
    const blocks = splitBlocks(text, 200);
    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks.map((b) => b.text + b.sep).join("")).toBe(text);
  });
  it("only trusts a correction that keeps the lines and about the same length", () => {
    expect(plausible("Marta: hola\n\nPedro: adios", "Marta: Hola.\n\nPedro: Adiós.")).toBe(true);
    expect(plausible("Marta: hola\n\nPedro: adios", "Marta: Hola.")).toBe(false);
    expect(plausible("a".repeat(100), "a")).toBe(false);
    expect(plausible("hola", "")).toBe(false);
  });
});

describe("vocabulary", () => {
  it("bounds and cleans the glossary", () => {
    expect(cleanGlossary("Marta\nRuiz\u0000  Alfa")).toBe("Marta Ruiz Alfa");
    expect(cleanGlossary("x".repeat(500))).toHaveLength(300);
    expect(cleanGlossary(42)).toBe("");
  });
  it("builds the prompt from vocabulary, glossary and the text so far", () => {
    const prompt = buildPrompt("Marta Ruiz", "…y entonces hola");
    expect(prompt).toContain("Vocabulario: Hoja");
    expect(prompt).toContain("Nombres y términos: Marta Ruiz.");
    expect(prompt).toMatch(/hola$/);
  });
});
