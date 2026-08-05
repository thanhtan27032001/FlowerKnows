"use client";

import type { CSSProperties, RefObject } from "react";
import type { ExportCustomerGroup, ExportItem } from "@/src/lib/export/types";

/** Fixed column widths so header and body stay aligned without HTML rowspan. */
const COL_CUSTOMER = "32%";
const COL_QTY = "96px";

const pad: CSSProperties = {
  padding: "10px 14px",
  boxSizing: "border-box",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "14px",
  color: "#111111",
};

function ItemCellContent({ item }: { item: ExportItem }) {
  if (item.display.kind === "exchanged") {
    return (
      <span>
        <span style={{ fontWeight: 500 }}>
          {item.display.newNames.join(", ")}
        </span>
        {" ("}
        <span style={{ color: "#c62828" }}>{item.display.oldName}</span>
        {")"}
      </span>
    );
  }
  return <span>{item.display.name}</span>;
}

/**
 * Packing-list layout that *looks* like a rowspan table (customer cell spans
 * all of that customer's item rows) but is built with flexbox.
 *
 * html2canvas 1.4.x paints HTML `rowSpan` poorly — borders cut through the
 * merged cell and the customer name sits only on the first row visually.
 */
export function PackingListTable({
  groups,
  labels,
  rootRef,
}: {
  groups: ExportCustomerGroup[];
  labels: { customer: string; item: string; quantity: string };
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
        <div
          style={{
            ...pad,
            width: COL_CUSTOMER,
            borderRight: "1px solid #222222",
            flexShrink: 0,
          }}
        >
          {labels.customer}
        </div>
        <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
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
      </div>

      {groups.map((group) => (
        <div
          key={group.customerId}
          style={{
            display: "flex",
            border: "1px solid #222222",
            borderTop: "none",
            backgroundColor: "#ffffff",
          }}
        >
          <div
            style={{
              ...pad,
              width: COL_CUSTOMER,
              fontWeight: 600,
              borderRight: "1px solid #222222",
              flexShrink: 0,
            }}
          >
            {group.customerName}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {group.items.map((item, index) => (
              <div
                key={`${group.customerId}-${item.key}`}
                style={{
                  display: "flex",
                  borderTop: index > 0 ? "1px solid #222222" : undefined,
                }}
              >
                <div style={{ ...pad, flex: 1, minWidth: 0 }}>
                  <ItemCellContent item={item} />
                </div>
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
                  {item.quantity}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
