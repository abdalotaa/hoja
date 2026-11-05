import { guardTokenRequest } from "@/lib/guards";
import { authEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";
import { buildPrompt } from "@/lib/vocabulary";

const MODEL = process.env.OPENAI_REALTIME_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe";

/**
 * Mints a short-lived key so the browser can stream audio straight to OpenAI for live text.
 * The real OPENAI_API_KEY never leaves the server; the key returned here expires on its own.
 */
export async function POST(request: Request) {
  let userId: string | undefined;
  if (authEnabled) {
    const user = await getUser();
    if (!user) return Response.json({ error: "Inicia sesión para transcribir." }, { status: 401 });
    userId = user.id;
  }

  const guard = await guardTokenRequest(request, userId);
  if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "Falta configurar OPENAI_API_KEY en el servidor." }, { status: 500 });

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        session: {
          type: "transcription",
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24000 },
              transcription: { model: MODEL, language: "es", prompt: buildPrompt(guard.body.glossary) },
              // A short pause closes a turn quickly; the client forces a close if someone talks for a long stretch.
              turn_detection: { type: "server_vad", threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 300 },
            },
          },
        },
      }),
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
    return Response.json({ error: "No se pudo iniciar la transcripción en vivo." }, { status: 502 });
  }

  const data = (await res.json().catch(() => null)) as { value?: unknown } | null;
  if (!data || typeof data.value !== "string") return Response.json({ error: "Respuesta inválida del servicio." }, { status: 502 });
  return Response.json({ secret: data.value });
}
