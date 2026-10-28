export type ColType = "text" | "number" | "money" | "date";

export interface Col {
  id: string;
  name: string;
  type: ColType;
}

/** A table note keeps its data as JSON in the note's text field. */
export interface TableData {
  cols: Col[];
  rows: string[][];
}

export const TYPE_LABEL: Record<ColType, string> = {
  text: "Texto",
  number: "Número",
  money: "Dinero",
  date: "Fecha",
};

const MAX_COLS = 12;
const MAX_ROWS = 500;

export const newCol = (name: string, type: ColType = "text"): Col => ({ id: crypto.randomUUID().slice(0, 8), name, type });

export function makeTable(cols: [string, ColType][], rows: string[][] = [], blankRows = 3): TableData {
  const c = cols.map(([name, type]) => newCol(name, type));
  const filled = rows.map((r) => c.map((_, i) => r[i] ?? ""));
  while (filled.length < blankRows) filled.push(c.map(() => ""));
  return { cols: c, rows: filled };
}

export const serializeTable = (t: TableData) => JSON.stringify(t);

export function parseTable(text: string): TableData {
  try {
    const raw = JSON.parse(text) as Partial<TableData>;
    if (Array.isArray(raw.cols) && Array.isArray(raw.rows)) {
      const cols = raw.cols.slice(0, MAX_COLS).map((c) => ({
        id: String(c.id ?? crypto.randomUUID().slice(0, 8)),
        name: String(c.name ?? ""),
        type: (["text", "number", "money", "date"].includes(c.type) ? c.type : "text") as ColType,
      }));
      const rows = raw.rows.slice(0, MAX_ROWS).map((r) => cols.map((_, i) => String((r as unknown[])[i] ?? "")));
      return { cols, rows };
    }
  } catch {
    /* fall through to an empty table */
  }
  return makeTable([["Concepto", "text"], ["Monto", "money"]]);
}

/** Reads "$1,250.50", "1250,5" or "12" as a number; empty or invalid cells count as nothing. */
export function toNumber(v: string): number | null {
  const cleaned = v.replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;
  let s = cleaned;
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  else if (s.includes(",")) s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function columnStats(t: TableData, ci: number) {
  const nums = t.rows.map((r) => toNumber(r[ci] ?? "")).filter((n): n is number => n !== null);
  const sum = nums.reduce((a, b) => a + b, 0);
  return { sum, count: nums.length, avg: nums.length ? sum / nums.length : 0 };
}

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const plain = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
export const formatValue = (n: number, type: ColType) => (type === "money" ? money.format(n) : plain.format(n));

/** If the table has a "category" column and an amount column, totals per category (largest first). */
export function byCategory(t: TableData): { label: string; total: number }[] | null {
  const cat = t.cols.findIndex((c) => c.type === "text" && /categor|tipo|rubro/i.test(c.name));
  const amt = t.cols.findIndex((c) => c.type === "money") >= 0 ? t.cols.findIndex((c) => c.type === "money") : t.cols.findIndex((c) => c.type === "number");
  if (cat < 0 || amt < 0) return null;
  const totals = new Map<string, number>();
  for (const r of t.rows) {
    const n = toNumber(r[amt] ?? "");
    const label = (r[cat] ?? "").trim();
    if (n === null || !label) continue;
    totals.set(label, (totals.get(label) ?? 0) + n);
  }
  if (totals.size === 0) return null;
  return [...totals.entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function tableToCsv(t: TableData): string {
  return [t.cols.map((c) => csvCell(c.name)), ...t.rows.filter((r) => r.some((c) => c.trim())).map((r) => r.map(csvCell))]
    .map((r) => r.join(","))
    .join("\n");
}

export function tableToMarkdown(t: TableData): string {
  const row = (cells: string[]) => `| ${cells.map((c) => c.replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`;
  const body = t.rows.filter((r) => r.some((c) => c.trim()));
  return [row(t.cols.map((c) => c.name)), row(t.cols.map(() => "---")), ...body.map(row)].join("\n");
}

/** Plain text for search and for the "ask" feature. */
export function tableToText(t: TableData): string {
  return [t.cols.map((c) => c.name).join(" | "), ...t.rows.filter((r) => r.some((c) => c.trim())).map((r) => r.join(" | "))].join("\n");
}

/** Readable text for any note, whatever its kind. */
export function noteText(n: { kind?: string; text: string }): string {
  return n.kind === "table" ? tableToText(parseTable(n.text)) : n.text;
}

export function downloadCsv(t: TableData, name: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + tableToCsv(t)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.trim().replace(/[^\w-]+/g, "-").toLowerCase() || "tabla"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
