/** Guards for /api/ai: only Hoja's own pages may call it, with a bounded body and per-person rate limits. */

export const CLIENT_HEADER = "x-hoja-client";
const MAX_BODY_BYTES = 60_000;

const PER_MINUTE = 10;
const PER_DAY = 120;
const GLOBAL_PER_DAY = 1500;
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

function overLimit(request: Request, userId?: string): boolean {
  const now = Date.now();
  const key = userId ? `user:${userId}` : clientIp(request);

  globalHits = globalHits.filter((t) => now - t < DAY);
  if (globalHits.length >= GLOBAL_PER_DAY) return true;

  const recent = (hits.get(key) ?? []).filter((t) => now - t < DAY);
  const lastMinute = recent.filter((t) => now - t < 60_000).length;
  if (recent.length >= PER_DAY || lastMinute >= PER_MINUTE) {
    hits.set(key, recent);
    return true;
  }

  recent.push(now);
  hits.set(key, recent);
  globalHits.push(now);

  if (hits.size > 5000) {
    for (const [k, times] of hits) if (!times.some((t) => now - t < DAY)) hits.delete(k);
  }
  return false;
}

export type GuardResult = { ok: true; body: Record<string, unknown> } | { ok: false; status: number; error: string };

/** Runs every generic check before any paid call is made. Task-specific validation happens in the route. */
export async function guardAiRequest(request: Request, userId?: string): Promise<GuardResult> {
  if (!isFromApp(request)) return { ok: false, status: 403, error: "Solicitud no permitida." };
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: "El contenido es demasiado largo." };
  }
  if (overLimit(request, userId)) {
    return { ok: false, status: 429, error: "Has usado muchas funciones de IA. Intenta en un momento." };
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return { ok: false, status: 413, error: "El contenido es demasiado largo." };

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, error: "Solicitud inválida." };
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Solicitud inválida." };
  }
  return { ok: true, body: body as Record<string, unknown> };
}
