import {
  aggregateExportLines,
  plainItem,
} from "@/src/lib/export/aggregate";
import type { ExportCustomerGroup, ExportLineInput } from "@/src/lib/export/types";
import type { Order } from "@/src/lib/api/order";

/** Aggregate selected orders into packing-list groups (US-36). */
export function aggregateOrdersForExport(
  orders: Order[]
): ExportCustomerGroup[] {
  const lines: ExportLineInput[] = [];
  for (const order of orders) {
    for (const token of order.tokens) {
      lines.push({
        customerId: order.customerId,
        customerName: order.customerName,
        display: plainItem(token.productName),
      });
    }
  }
  return aggregateExportLines(lines);
}

export { ordersExportFilename as exportImageFilename } from "@/src/lib/export/filename";
export type { ExportCustomerGroup } from "@/src/lib/export/types";
