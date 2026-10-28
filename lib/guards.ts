/** Guards for /api/summarize: only Hoja's own pages may call it, and only with note-sized input. */

export const CLIENT_HEADER = "x-hoja-client";
export const MAX_NOTE_CHARS = 12_000;
const MAX_BODY_BYTES = 40_000;

const PER_MINUTE = 8;
const PER_DAY = 60;
const GLOBAL_PER_DAY = 600;
const DAY = 24 * 60 * 60 * 1000;

const hits = new Map<string, number[]>();
let globalHits: number[] = [];

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

/** Browser requests from our own origin only. Cross-site pages and bare curl calls are rejected. */
function isFromApp(request: Request): boolean {
  if (request.headers.get(CLIENT_HEADER) !== "1") return false;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return false;

  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";

  // Browsers that omit Fetch Metadata still send Origin on POST.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function overLimit(request: Request): boolean {
  const now = Date.now();
  const ip = clientIp(request);

  globalHits = globalHits.filter((t) => now - t < DAY);
  if (globalHits.length >= GLOBAL_PER_DAY) return true;

  const recent = (hits.get(ip) ?? []).filter((t) => now - t < DAY);
  const lastMinute = recent.filter((t) => now - t < 60_000).length;
  if (recent.length >= PER_DAY || lastMinute >= PER_MINUTE) {
    hits.set(ip, recent);
    return true;
  }

  recent.push(now);
  hits.set(ip, recent);
  globalHits.push(now);

  if (hits.size > 5000) {
    for (const [key, times] of hits) if (!times.some((t) => now - t < DAY)) hits.delete(key);
  }
  return false;
}

export type GuardResult = { ok: true; text: string } | { ok: false; status: number; error: string };

/** Runs every check before any paid call is made. */
export async function guardSummarizeRequest(request: Request): Promise<GuardResult> {
  if (!isFromApp(request)) {
    return { ok: false, status: 403, error: "Solicitud no permitida." };
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: "La nota es demasiado larga." };
  }
  if (overLimit(request)) {
    return { ok: false, status: 429, error: "Has usado muchos resúmenes. Intenta más tarde." };
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: "La nota es demasiado larga." };
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, error: "Solicitud inválida." };
  }

  // The body must be exactly { text: string }: no extra fields, nothing to steer the model with.
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Solicitud inválida." };
  }
  const keys = Object.keys(body);
  const text = (body as { text?: unknown }).text;
  if (keys.length !== 1 || keys[0] !== "text" || typeof text !== "string") {
    return { ok: false, status: 400, error: "Solicitud inválida." };
  }

  const trimmed = text.trim();
  if (trimmed.length < 20) return { ok: false, status: 400, error: "Muy poco texto para resumir." };
  if (trimmed.length > MAX_NOTE_CHARS) {
    return { ok: false, status: 413, error: `Las notas largas se dividen: máximo ${MAX_NOTE_CHARS.toLocaleString("es-MX")} caracteres.` };
  }
  return { ok: true, text: trimmed };
}
