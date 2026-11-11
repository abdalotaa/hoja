import { guardAudioRequest, MAX_AUDIO_BYTES } from "@/lib/guards";
import { authEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

// Without this the host cuts the request at its default limit, which is short for long audio.
export const maxDuration = 300;

const MODEL = process.env.OPENAI_DIARIZE_MODEL ?? "gpt-4o-transcribe-diarize";
// The audio itself stays under MAX_AUDIO_BYTES; the rest of the body is room for up to four short voice samples.
const MAX_BODY_BYTES = 4_400_000;
const MAX_REFS = 4;
const MAX_REF_CHARS = 140_000;

interface RawSegment {
  text?: unknown;
  speaker?: unknown;
  start?: unknown;
  end?: unknown;
}

/** One audio window in, who-said-what out: segments with a speaker label (A, B, …) and start/end seconds. */
export async function POST(request: Request) {
  let userId: string | undefined;
  if (authEnabled) {
    const user = await getUser();
    if (!user) return Response.json({ error: "Inicia sesión para identificar hablantes." }, { status: 401 });
    userId = user.id;
  }

  const guard = guardAudioRequest(request, userId, MAX_BODY_BYTES);
  if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "Falta configurar OPENAI_API_KEY en el servidor." }, { status: 500 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const file = form.get("audio");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "Audio inválido." }, { status: 400 });
  }

  // Voice samples of people already heard, so the same person keeps the same label from one window to the next.
  const names = form.getAll("known_speaker_names[]").filter((v): v is string => typeof v === "string");
  const refs = form.getAll("known_speaker_references[]").filter((v): v is string => typeof v === "string");
  const known = names.length === refs.length && names.length <= MAX_REFS;
  if (!known || refs.some((r) => !r.startsWith("data:audio/") || r.length > MAX_REF_CHARS) || names.some((n) => !n || n.length > 40)) {
    return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const upstream = new FormData();
  names.forEach((n, i) => {
    upstream.append("known_speaker_names[]", n);
    upstream.append("known_speaker_references[]", refs[i]);
  });
  upstream.append("file", file, file.name || "audio.webm");
  upstream.append("model", MODEL);
  upstream.append("language", "es");
  upstream.append("response_format", "diarized_json");
  upstream.append("chunking_strategy", "auto");

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });
  } catch {
    return Response.json({ error: "No se pudo contactar a OpenAI." }, { status: 502 });
  }

  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    if (res.status === 401) return Response.json({ error: "La OPENAI_API_KEY no es válida." }, { status: 500 });
    if (res.status === 429) {
      const noCredit = detail?.error?.code === "insufficient_quota";
      return Response.json({ error: noCredit ? "Se acabó el saldo de la cuenta de OpenAI." : "Demasiadas solicitudes, intenta en un momento." }, { status: 429 });
    }
    return Response.json({ error: "No se pudo identificar a los hablantes de este audio." }, { status: 502 });
  }

  const data = (await res.json().catch(() => null)) as { segments?: RawSegment[] } | null;
  if (!data || !Array.isArray(data.segments)) return Response.json({ error: "Respuesta inválida del servicio." }, { status: 502 });

  const segments = data.segments
    .map((s) => ({
      text: typeof s.text === "string" ? s.text.trim() : "",
      speaker: typeof s.speaker === "string" && s.speaker ? s.speaker : "A",
      start: typeof s.start === "number" ? s.start : 0,
      end: typeof s.end === "number" ? s.end : 0,
    }))
    .filter((s) => s.text);
  return Response.json({ segments });
}
