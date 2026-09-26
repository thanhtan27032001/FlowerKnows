"use client";

import type { CSSProperties, RefObject } from "react";
import type { ExportItemQuantityRow } from "@/src/lib/export/types";

const COL_QTY = "96px";

const pad: CSSProperties = {
  padding: "10px 14px",
  boxSizing: "border-box",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "14px",
  color: "#111111",
};

/**
 * Flat two-column Item | Quantity table for image export (US-31).
 * Same flexbox + inline-style approach as `PackingListTable` so html2canvas
 * paints it reliably.
 */
export function ItemQuantityTable({
  rows,
  labels,
  rootRef,
}: {
  rows: ExportItemQuantityRow[];
  labels: { item: string; quantity: string };
  rootRef: RefObject<HTMLDivElement | null>;
}) {
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
          border: "1px solid #222222",
        }}
      >
        <div style={{ ...pad, flex: 1, minWidth: 0 }}>{labels.item}</div>
        <div
          style={{
            ...pad,
            width: COL_QTY,
            textAlign: "right",
            flexShrink: 0,
            borderLeft: "1px solid #222222",
          }}
        >
          {labels.quantity}
        </div>
      </div>

      {rows.map((row) => (
        <div
          key={row.key}
          style={{
            display: "flex",
            border: "1px solid #222222",
            borderTop: "none",
            backgroundColor: "#ffffff",
          }}
        >
          <div style={{ ...pad, flex: 1, minWidth: 0 }}>{row.name}</div>
          <div
            style={{
              ...pad,
              width: COL_QTY,
              textAlign: "right",
              flexShrink: 0,
              borderLeft: "1px solid #222222",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {row.quantity}
          </div>
        </div>
      ))}
    </div>
  );
}
