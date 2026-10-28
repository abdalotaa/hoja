"use client";

import { useMemo } from "react";
import {
  TYPE_LABEL,
  byCategory,
  columnStats,
  formatValue,
  newCol,
  parseTable,
  serializeTable,
  type ColType,
  type TableData,
} from "@/lib/table";

interface Props {
  value: string;
  onChange: (text: string) => void;
}

export default function TableEditor({ value, onChange }: Props) {
  const table = useMemo(() => parseTable(value), [value]);
  const update = (next: TableData) => onChange(serializeTable(next));

  const setCell = (ri: number, ci: number, v: string) =>
    update({ ...table, rows: table.rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? v : c)) : r)) });
  const addRow = () => update({ ...table, rows: [...table.rows, table.cols.map(() => "")] });
  const removeRow = (ri: number) => update({ ...table, rows: table.rows.filter((_, i) => i !== ri) });
  const addCol = () =>
    update({ cols: [...table.cols, newCol(`Columna ${table.cols.length + 1}`)], rows: table.rows.map((r) => [...r, ""]) });
  const removeCol = (ci: number) =>
    table.cols.length > 1 && update({ cols: table.cols.filter((_, i) => i !== ci), rows: table.rows.map((r) => r.filter((_, j) => j !== ci)) });
  const patchCol = (ci: number, patch: { name?: string; type?: ColType }) =>
    update({ ...table, cols: table.cols.map((c, i) => (i === ci ? { ...c, ...patch } : c)) });

  // Enter moves down the column, and adds a row at the end: quick data entry like a spreadsheet.
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>, ri: number, ci: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const root = e.currentTarget.closest(".tbl-wrap");
    const next = root?.querySelector<HTMLInputElement>(`[data-cell="${ri + 1}-${ci}"]`);
    if (next) {
      next.focus();
      return;
    }
    addRow();
    setTimeout(() => root?.querySelector<HTMLInputElement>(`[data-cell="${ri + 1}-${ci}"]`)?.focus(), 30);
  };

  const numeric = table.cols.map((c) => c.type === "number" || c.type === "money");
  const groups = useMemo(() => byCategory(table), [table]);

  return (
    <div className="tbl-wrap">
      <div className="tbl-scroll">
      <table className="tbl">
        <thead>
          <tr>
            {table.cols.map((c, ci) => (
              <th key={c.id}>
                <input className="tbl-h" value={c.name} aria-label="Nombre de la columna" onChange={(e) => patchCol(ci, { name: e.target.value })} />
                <div className="tbl-ctl">
                  <select
                    value={c.type}
                    aria-label="Tipo de columna"
                    onChange={(e) => patchCol(ci, { type: e.target.value as ColType })}
                  >
                    {(Object.keys(TYPE_LABEL) as ColType[]).map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                  {table.cols.length > 1 && (
                    <button aria-label="Quitar columna" title="Quitar columna" onClick={() => removeCol(ci)}>
                      ×
                    </button>
                  )}
                </div>
              </th>
            ))}
            <th className="tbl-end" />
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, ri) => (
            <tr key={ri}>
              {table.cols.map((c, ci) => (
                <td key={c.id}>
                  <input
                    data-cell={`${ri}-${ci}`}
                    type={c.type === "date" ? "date" : "text"}
                    inputMode={numeric[ci] ? "decimal" : undefined}
                    value={r[ci] ?? ""}
                    aria-label={`${c.name}, fila ${ri + 1}`}
                    className={numeric[ci] ? "tbl-num" : undefined}
                    onChange={(e) => setCell(ri, ci, e.target.value)}
                    onKeyDown={(e) => onEnter(e, ri, ci)}
                  />
                </td>
              ))}
              <td className="tbl-end">
                <button className="tbl-rm" aria-label="Quitar fila" title="Quitar fila" onClick={() => removeRow(ri)}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        {numeric.some(Boolean) && (
          <tfoot>
            <tr>
              {table.cols.map((c, ci) => {
                if (!numeric[ci]) return <td key={c.id}>{ci === 0 ? <b className="mono">Total</b> : null}</td>;
                const s = columnStats(table, ci);
                return (
                  <td key={c.id} className="tbl-total">
                    <b>{formatValue(s.sum, c.type)}</b>
                    {s.count > 1 && <small className="mono">prom. {formatValue(s.avg, c.type)}</small>}
                  </td>
                );
              })}
              <td className="tbl-end" />
            </tr>
          </tfoot>
        )}
      </table>
      </div>
      <div className="tbl-actions">
        <button className="tag" onClick={addRow}>
          + Fila
        </button>
        <button className="tag" onClick={addCol} disabled={table.cols.length >= 12}>
          + Columna
        </button>
      </div>
      {groups && (
        <details className="tbl-groups">
          <summary className="mono">Por categoría</summary>
          <ul>
            {groups.map((g) => (
              <li key={g.label}>
                <span>{g.label}</span>
                <b>{formatValue(g.total, table.cols.some((c) => c.type === "money") ? "money" : "number")}</b>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
