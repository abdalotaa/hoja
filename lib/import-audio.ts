import { Diarizer } from "./diarize";
import { fileSpeaker, type MeetingLine } from "./meeting";
import { decodeMono16k, encodeWav, quietCut, RATE } from "./wav";

/** Imports recordings (a mixed one, or one file per participant) as a transcript with speakers. */

export const MAX_FILE_BYTES = 400_000_000;
const WINDOW_SECONDS = 100; // ~3.2 MB as WAV, leaving room for voice samples under the 4.5 MB request limit
const SEARCH_SECONDS = 8;

export interface ImportProgress {
  file: number;
  files: number;
  done: number;
  total: number;
}

export interface ImportResult {
  lines: MeetingLine[];
  failed: number;
  error?: string;
}

/** Window boundaries in samples, each cut at a quiet moment near the target length. */
export function windowBounds(samples: Float32Array): [number, number][] {
  const size = WINDOW_SECONDS * RATE;
  const bounds: [number, number][] = [];
  let from = 0;
  while (from < samples.length) {
    let to = Math.min(samples.length, from + size);
    if (to < samples.length) to = quietCut(samples, to - SEARCH_SECONDS * RATE, to);
    bounds.push([from, to]);
    from = to;
  }
  return bounds;
}

export async function importRecordings(files: File[], onProgress?: (p: ImportProgress) => void): Promise<ImportResult> {
  const lines: MeetingLine[] = [];
  let failed = 0;
  let error: string | undefined;
  // One file per person: the name comes from the file and no speaker detection is needed.
  const perPerson = files.length > 1;
  const diarizer = new Diarizer();

  for (let f = 0; f < files.length; f++) {
    const file = files[f];
    let samples: Float32Array;
    try {
      samples = await decodeMono16k(file);
    } catch {
      failed++;
      error = `No pude abrir «${file.name}». Prueba con un archivo de audio (m4a, mp3, wav).`;
      continue;
    }
    const bounds = windowBounds(samples);
    const fixed = perPerson ? fileSpeaker(file.name, f) : undefined;
    for (let w = 0; w < bounds.length; w++) {
      onProgress?.({ file: f, files: files.length, done: w, total: bounds.length });
      const [from, to] = bounds[w];
      const wav = encodeWav(samples, from, to);
      const done = await diarizer.window(wav, `${f}-${w}.wav`, from / RATE, samples.subarray(from, to), fixed);
      if (done.error) {
        failed++;
        error = done.error;
        if (done.fatal) return { lines, failed, error };
        continue;
      }
      lines.push(...done.lines);
    }
  }
  return { lines, failed, error };
}
