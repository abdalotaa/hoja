import type { Note, Tone } from "./notes";
import { newNote } from "./notes";

interface Block {
  title: string;
  hint: string;
  tone?: Tone;
}

export interface Template {
  id: string;
  label: string;
  description: string;
  cols: number;
  blocks: Block[];
}

export const TEMPLATES: Template[] = [
  {
    id: "lean",
    label: "Lean Canvas",
    description: "Tu modelo de negocio en una hoja",
    cols: 3,
    blocks: [
      { title: "Problema", hint: "Los 3 problemas más importantes de tu cliente.", tone: "rust" },
      { title: "Segmentos de clientes", hint: "¿Quién exactamente lo necesita primero?" },
      { title: "Propuesta de valor", hint: "Una frase: qué haces, para quién y por qué eres distinto.", tone: "butter" },
      { title: "Solución", hint: "Las 3 funciones que resuelven esos problemas." },
      { title: "Canales", hint: "¿Cómo llegas a tus primeros clientes?" },
      { title: "Ingresos", hint: "¿Quién paga, cuánto y cómo?", tone: "mint" },
      { title: "Costos", hint: "Lo que cuesta operar cada mes." },
      { title: "Métricas clave", hint: "Los 2 o 3 números que dicen si vas bien." },
      { title: "Ventaja injusta", hint: "Lo que no te pueden copiar fácilmente." },
    ],
  },
  {
    id: "validar",
    label: "Validar una idea",
    description: "Antes de construir, comprueba que importa",
    cols: 3,
    blocks: [
      { title: "Hipótesis", hint: "Creo que [quién] necesita [qué] porque [por qué].", tone: "butter" },
      { title: "A quién le duele", hint: "Personas concretas con nombre, no 'todo el mundo'." },
      { title: "Cómo lo resuelven hoy", hint: "Tu competencia real, incluida 'no hacer nada'." },
      { title: "Experimento barato", hint: "Lo más pequeño que puedes hacer esta semana para probarlo." },
      { title: "Qué cuenta como éxito", hint: "Un número antes de empezar. Ej.: 5 de 20 piden la demo.", tone: "mint" },
      { title: "Siguiente paso", hint: "Una sola acción con fecha.", tone: "rust" },
    ],
  },
  {
    id: "pitch",
    label: "Pitch de 3 minutos",
    description: "El guion de una presentación corta",
    cols: 4,
    blocks: [
      { title: "Gancho", hint: "Una frase o dato que haga levantar la cabeza.", tone: "butter" },
      { title: "Problema", hint: "Cuéntalo con una persona, no con estadísticas." },
      { title: "Solución", hint: "Qué haces, en una frase y una imagen." },
      { title: "Mercado", hint: "Cuánta gente tiene este problema." },
      { title: "Modelo de negocio", hint: "Cómo ganas dinero." },
      { title: "Tracción", hint: "Lo que ya funciona, con números." },
      { title: "Equipo", hint: "Por qué ustedes." },
      { title: "Petición", hint: "Qué necesitas de quien te escucha.", tone: "rust" },
    ],
  },
  {
    id: "semana",
    label: "Semana de trabajo",
    description: "Prioridades y días de la semana",
    cols: 3,
    blocks: [
      { title: "Prioridades", hint: "☐ \n☐ \n☐ ", tone: "rust" },
      { title: "Lunes", hint: "☐ " },
      { title: "Martes", hint: "☐ " },
      { title: "Miércoles", hint: "☐ " },
      { title: "Jueves", hint: "☐ " },
      { title: "Viernes", hint: "☐ " },
      { title: "Pendientes sueltos", hint: "☐ ", tone: "mint" },
      { title: "Para recordar", hint: "Decisiones, personas, ideas.", tone: "butter" },
    ],
  },
  {
    id: "examen",
    label: "Repaso de examen",
    description: "Ordena el temario y planea el repaso",
    cols: 3,
    blocks: [
      { title: "Temario", hint: "Los temas que entran, en orden." },
      { title: "Conceptos clave", hint: "Definiciones que tienes que saber de memoria.", tone: "butter" },
      { title: "Fórmulas y fechas", hint: "Lo que no se deduce, se memoriza." },
      { title: "Dudas para preguntar", hint: "Lo que no entiendes todavía.", tone: "rust" },
      { title: "Plan de repaso", hint: "☐ Día 1: \n☐ Día 2: \n☐ Día 3: ", tone: "mint" },
      { title: "Errores comunes", hint: "Donde se equivocan casi todos." },
    ],
  },
  {
    id: "reunion",
    label: "Agenda de reunión",
    description: "Objetivo, temas, decisiones y pendientes",
    cols: 2,
    blocks: [
      { title: "Objetivo", hint: "Al terminar, ¿qué tiene que estar decidido?", tone: "butter" },
      { title: "Temas", hint: "1. \n2. \n3. " },
      { title: "Decisiones", hint: "• " },
      { title: "Pendientes", hint: "☐ tarea — responsable — AAAA-MM-DD", tone: "mint" },
    ],
  },
];

const W = 300;
const H = 220;
const GAP = 36;

/** Builds the notes of a template as a grid starting at the given spot. */
export function buildTemplate(t: Template, origin: { x: number; y: number }, startZ: number): Note[] {
  return t.blocks.map((b, i) => ({
    ...newNote(i, startZ + i, {
      x: origin.x + (i % t.cols) * (W + GAP),
      y: origin.y + Math.floor(i / t.cols) * (H + GAP),
    }),
    title: b.title,
    text: b.hint,
    tone: b.tone ?? "none",
    w: W,
    h: H,
  }));
}
