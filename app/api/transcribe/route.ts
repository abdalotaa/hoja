import { guardAudioRequest, MAX_AUDIO_BYTES } from "@/lib/guards";
import { authEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

const MODEL = process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe";
const FALLBACK_MODEL = "whisper-1";

async function transcribe(apiKey: string, model: string, file: File, prompt: string): Promise<Response> {
  const form = new FormData();
  form.append("file", file, file.name || "audio.webm");
  form.append("model", model);
  form.append("language", "es");
  form.append("response_format", "json");
  if (prompt) form.append("prompt", prompt);
  return fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
}

/** One short audio chunk in, its text out. The client keeps the audio until this succeeds, so failures lose nothing. */
export async function POST(request: Request) {
  let userId: string | undefined;
  if (authEnabled) {
    const user = await getUser();
    if (!user) return Response.json({ error: "Inicia sesión para transcribir." }, { status: 401 });
    userId = user.id;
  }

  const guard = guardAudioRequest(request, userId);
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
  const context = form.get("context");
  // The tail of the previous chunk helps the model keep names and sentences consistent across chunk boundaries.
  const prompt = typeof context === "string" ? context.slice(-400) : "";

  let res: Response;
  try {
    res = await transcribe(apiKey, MODEL, file, prompt);
    if ((res.status === 400 || res.status === 404) && MODEL !== FALLBACK_MODEL) {
      res = await transcribe(apiKey, FALLBACK_MODEL, file, prompt);
    }
  } catch {
    return Response.json({ error: "No se pudo contactar a OpenAI." }, { status: 502 });
  }

  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    if (res.status === 401) return Response.json({ error: "La OPENAI_API_KEY no es válida." }, { status: 500 });
    if (res.status === 429) {
      const noCredit = detail?.error?.code === "insufficient_quota";
      return Response.json(
        { error: noCredit ? "Se acabó el saldo de la cuenta de OpenAI." : "Demasiadas solicitudes, intenta en un momento." },
        { status: 429 },
      );
    }
    return Response.json({ error: "No se pudo transcribir este audio." }, { status: 502 });
  }

  const data = (await res.json().catch(() => null)) as { text?: unknown } | null;
  if (!data || typeof data.text !== "string") return Response.json({ error: "Respuesta inválida del servicio." }, { status: 502 });
  return Response.json({ text: data.text.trim() });
}
