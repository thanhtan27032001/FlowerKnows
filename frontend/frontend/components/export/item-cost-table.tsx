"use client";

import type { CSSProperties, RefObject } from "react";
import { formatCostPrice } from "@/src/lib/format";
import type { ExportCostRow } from "@/src/lib/export/types";

const COL_UNIT = "130px";
const COL_QTY = "80px";
const COL_TOTAL = "140px";
const BORDER = "1px solid #222222";

const pad: CSSProperties = {
  padding: "10px 14px",
  boxSizing: "border-box",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "14px",
  color: "#111111",
};

const numCell = (width: string): CSSProperties => ({
  ...pad,
  width,
  textAlign: "right",
  flexShrink: 0,
  borderLeft: BORDER,
  fontVariantNumeric: "tabular-nums",
});

export function lineTotal(row: ExportCostRow): number | null {
  return row.unitCost == null ? null : row.unitCost * row.quantity;
}

/**
 * Flat Item | Unit Cost | Quantity | Line Total table with a Total row, for
 * image export (US-31). Same flexbox + inline-style approach as
 * `PackingListTable` so html2canvas paints it reliably.
 * Rows with unknown cost show "—" and contribute 0 to the total.
 */
export function ItemCostTable({
  rows,
  labels,
  rootRef,
}: {
  rows: ExportCostRow[];
  labels: {
    item: string;
    unitCost: string;
    quantity: string;
    lineTotal: string;
    total: string;
  };
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  const grandTotal = rows.reduce((sum, row) => sum + (lineTotal(row) ?? 0), 0);

  return (
    <div
      ref={rootRef}
      style={{
        width: "100%",
        backgroundColor: "#ffffff",
        color: "#111111",
      }}
    >
      <div
        style={{
          display: "flex",
          backgroundColor: "#f3f3f3",
          fontWeight: 700,
          border: BORDER,
        }}
      >
        <div style={{ ...pad, flex: 1, minWidth: 0 }}>{labels.item}</div>
        <div style={numCell(COL_UNIT)}>{labels.unitCost}</div>
        <div style={numCell(COL_QTY)}>{labels.quantity}</div>
        <div style={numCell(COL_TOTAL)}>{labels.lineTotal}</div>
      </div>

      {rows.map((row) => (
        <div
          key={row.key}
          style={{
            display: "flex",
            border: BORDER,
            borderTop: "none",
            backgroundColor: "#ffffff",
          }}
        >
          <div style={{ ...pad, flex: 1, minWidth: 0 }}>{row.name}</div>
          <div style={numCell(COL_UNIT)}>{formatCostPrice(row.unitCost)}</div>
          <div style={numCell(COL_QTY)}>{row.quantity}</div>
          <div style={numCell(COL_TOTAL)}>
            {formatCostPrice(lineTotal(row))}
          </div>
        </div>
      ))}

      <div
        style={{
          display: "flex",
          border: BORDER,
          borderTop: "none",
          backgroundColor: "#f3f3f3",
          fontWeight: 700,
        }}
      >
        <div style={{ ...pad, flex: 1, minWidth: 0 }}>{labels.total}</div>
        <div style={numCell(COL_TOTAL)}>{formatCostPrice(grandTotal)}</div>
      </div>
    </div>
  );
}
