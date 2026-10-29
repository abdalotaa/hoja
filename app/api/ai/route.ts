import { guardAiRequest } from "@/lib/guards";
import { TASKS } from "@/lib/ai-tasks";
import { authEnabled } from "@/lib/supabase/env";
import { getServerClient, getUser } from "@/lib/supabase/server";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const MONTHLY_LIMIT = Number(process.env.AI_MONTHLY_LIMIT ?? 150);

export async function POST(request: Request) {
  // With accounts on, only signed-in people can spend the AI budget, and limits are per person.
  let userId: string | undefined;
  if (authEnabled) {
    const user = await getUser();
    if (!user) return Response.json({ error: "Inicia sesión para usar la IA." }, { status: 401 });
    userId = user.id;
  }

  const guard = await guardAiRequest(request, userId);
  if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });

  const task = typeof guard.body.task === "string" ? TASKS[guard.body.task] : undefined;
  if (!task) return Response.json({ error: "Solicitud inválida." }, { status: 400 });

  const built = task.build(guard.body);
  if (!built.ok) return Response.json({ error: built.error }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "Falta configurar OPENAI_API_KEY en el servidor." }, { status: 500 });

  // Fail closed: a database failure must not bypass the paid usage quota.
  let remaining: number | undefined;
  if (authEnabled) {
    const { data, error } = await (await getServerClient()).rpc("bump_ai_usage", { max_per_month: MONTHLY_LIMIT });
    if (error || typeof data !== "number") {
      return Response.json({ error: "No se pudo verificar tu cuota de IA. Intenta en un momento." }, { status: 503 });
    }
    if (typeof data === "number") {
      if (data < 0) {
        return Response.json({ error: `Llegaste al límite de ${MONTHLY_LIMIT} usos de IA este mes.` }, { status: 429 });
      }
      remaining = data;
    }
  }

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        max_completion_tokens: task.maxTokens,
        messages: [
          { role: "system", content: task.system },
          { role: "user", content: built.user },
        ],
        response_format: { type: "json_schema", json_schema: { name: task.schemaName, strict: true, schema: task.schema } },
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
      return Response.json(
        { error: noCredit ? "Se acabó el saldo de la cuenta de OpenAI." : "Demasiadas solicitudes, intenta en un momento." },
        { status: 429 },
      );
    }
    if (res.status === 404 || res.status === 400) {
      return Response.json({ error: `El modelo "${MODEL}" no está disponible. Cambia OPENAI_MODEL.` }, { status: 502 });
    }
    return Response.json({ error: "No se pudo completar la solicitud." }, { status: 502 });
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return Response.json({ error: "No se pudo procesar este contenido." }, { status: 422 });
  try {
    return Response.json({ result: JSON.parse(content), remaining });
  } catch {
    return Response.json({ error: "Respuesta inválida del modelo." }, { status: 502 });
  }
}
