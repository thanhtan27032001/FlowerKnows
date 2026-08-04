"use client";

import { useMemo } from "react";
import { ExportTablePreview } from "@/components/export/export-table-preview";
import {
  aggregateOrdersForExport,
  exportImageFilename,
} from "@/src/lib/orders/aggregate-export";
import type { Order } from "@/src/lib/api/order";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
};

export function OrderExportPreview({ open, onOpenChange, orders }: Props) {
  const groups = useMemo(() => aggregateOrdersForExport(orders), [orders]);
  const filename = exportImageFilename();

  return (
    <ExportTablePreview
      open={open}
      onOpenChange={onOpenChange}
      groups={groups}
      filename={filename}
    />
  );
}
