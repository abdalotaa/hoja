import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const hasCredentials = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Título corto (máx. 6 palabras) del contenido." },
    summary: { type: "string", description: "Resumen en 2 a 4 frases." },
    keyPoints: { type: "array", items: { type: "string" }, description: "Ideas o decisiones clave." },
    actionItems: { type: "array", items: { type: "string" }, description: "Pendientes concretos. Vacío si no hay." },
  },
  required: ["title", "summary", "keyPoints", "actionItems"],
  additionalProperties: false,
} as const;

export interface SummaryResult {
  title: string;
  summary: string;
  keyPoints: string[];
  actionItems: string[];
}

export async function POST(request: Request) {
  if (!hasCredentials()) {
    return Response.json({ error: "Falta configurar ANTHROPIC_API_KEY en el servidor." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (text.length < 20) {
    return Response.json({ error: "Muy poco texto para resumir." }, { status: 400 });
  }
  if (text.length > 60_000) {
    return Response.json({ error: "El texto es demasiado largo." }, { status: 413 });
  }

  try {
    const response = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system:
        "Eres el asistente de una app de notas. Recibes una transcripción de voz o apuntes en bruto, " +
        "en el idioma del usuario (normalmente español de México). Resume sin inventar nada que no esté " +
        "en el texto: si no se menciona un pendiente, no lo agregues. Responde en el mismo idioma del texto.",
      messages: [{ role: "user", content: `<texto>\n${text}\n</texto>` }],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "No se pudo resumir este contenido." }, { status: 422 });
    }
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return Response.json({ error: "Respuesta vacía." }, { status: 502 });
    }
    return Response.json(JSON.parse(block.text) as SummaryResult);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "Falta configurar ANTHROPIC_API_KEY." }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Demasiadas solicitudes, intenta en un momento." }, { status: 429 });
    }
    return Response.json({ error: "No se pudo generar el resumen." }, { status: 502 });
  }
}
