import type { Note, Tone } from "./notes";
import { newNote } from "./notes";
import { makeTable, serializeTable, type TableData } from "./table";

interface Block {
  title: string;
  hint: string;
  tone?: Tone;
  /** When present the block is a table note instead of a text note. */
  table?: TableData;
}

export interface Template {
  id: string;
  label: string;
  description: string;
  cols: number;
  /** Size of each block (default 300 x 220). */
  cell?: { w: number; h: number };
  blocks: Block[];
}

export const TEMPLATES: Template[] = [
  {
    id: "tabla",
    label: "Tabla en blanco",
    description: "Filas y columnas con totales",
    cols: 1,
    cell: { w: 520, h: 400 },
    blocks: [{ title: "Tabla", hint: "", table: makeTable([["Concepto", "text"], ["Monto", "money"]], [], 4) }],
  },
  {
    id: "gastos",
    label: "Control de gastos",
    description: "Fecha, concepto, categoría y monto; total y por categoría",
    cols: 1,
    cell: { w: 640, h: 470 },
    blocks: [
      {
        title: "Gastos del mes",
        hint: "",
        tone: "mint",
        table: makeTable([["Fecha", "date"], ["Concepto", "text"], ["Categoría", "text"], ["Monto", "money"]], [], 6),
      },
    ],
  },
  {
    id: "presupuesto",
    label: "Presupuesto mensual",
    description: "Cuánto planeas gastar y cuánto llevas",
    cols: 1,
    cell: { w: 560, h: 480 },
    blocks: [
      {
        title: "Presupuesto",
        hint: "",
        tone: "butter",
        table: makeTable(
          [["Categoría", "text"], ["Presupuesto", "money"], ["Gastado", "money"]],
          [["Renta"], ["Comida"], ["Transporte"], ["Servicios"], ["Ocio"], ["Ahorro"]],
          0,
        ),
      },
    ],
  },
  {
    id: "clientes",
    label: "Seguimiento de clientes",
    description: "Quién sigue, cuándo contactarlo y cuánto vale",
    cols: 1,
    cell: { w: 700, h: 430 },
    blocks: [
      {
        title: "Clientes",
        hint: "",
        tone: "rust",
        table: makeTable([["Cliente", "text"], ["Estado", "text"], ["Próximo contacto", "date"], ["Valor", "money"]], [], 5),
      },
    ],
  },
  {
    id: "horario",
    label: "Horario de clases",
    description: "Tu semana de lunes a viernes",
    cols: 1,
    cell: { w: 760, h: 430 },
    blocks: [
      {
        title: "Horario",
        hint: "",
        table: makeTable(
          [["Hora", "text"], ["Lunes", "text"], ["Martes", "text"], ["Miércoles", "text"], ["Jueves", "text"], ["Viernes", "text"]],
          [["8:00"], ["10:00"], ["12:00"], ["14:00"], ["16:00"]],
          0,
        ),
      },
    ],
  },
  {
    id: "calificaciones",
    label: "Calificaciones",
    description: "Materias, parciales, suma y promedio",
    cols: 1,
    cell: { w: 560, h: 420 },
    blocks: [
      {
        title: "Calificaciones",
        hint: "",
        tone: "mint",
        table: makeTable([["Materia", "text"], ["Parcial 1", "number"], ["Parcial 2", "number"], ["Final", "number"]], [], 5),
      },
    ],
  },
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

export function templateSize(t: Template) {
  const w = t.cell?.w ?? W;
  const h = t.cell?.h ?? H;
  const rows = Math.ceil(t.blocks.length / t.cols);
  return { w: t.cols * w + (t.cols - 1) * GAP, h: rows * h + (rows - 1) * GAP };
}

/** Builds the notes of a template as a grid at (0, 0); the caller moves it to a free spot. */
export function buildTemplate(t: Template, startZ: number): Note[] {
  const w = t.cell?.w ?? W;
  const h = t.cell?.h ?? H;
  return t.blocks.map((b, i) => ({
    ...newNote(i, startZ + i, {
      x: (i % t.cols) * (w + GAP),
      y: Math.floor(i / t.cols) * (h + GAP),
    }),
    title: b.title,
    text: b.table ? serializeTable(b.table) : b.hint,
    kind: b.table ? ("table" as const) : undefined,
    tone: b.tone ?? "none",
    w,
    h,
  }));
}
