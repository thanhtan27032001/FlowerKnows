import type {
  ExportCustomerGroup,
  ExportItemDisplay,
  ExportLineInput,
} from "@/src/lib/export/types";

function displayKey(display: ExportItemDisplay): string {
  if (display.kind === "plain") {
    return `plain:${display.name}`;
  }
  return `exchanged:${display.oldName}|${display.newNames.join("\0")}`;
}

/**
 * Group lines by customer, then by item display identity, summing quantity.
 * Same aggregation rule as US-36 / US-37.
 */
export function aggregateExportLines(
  lines: ExportLineInput[]
): ExportCustomerGroup[] {
  const customerOrder: string[] = [];
  const byCustomer = new Map<
    string,
    {
      name: string;
      items: Map<string, { display: ExportItemDisplay; quantity: number }>;
    }
  >();

  for (const line of lines) {
    let entry = byCustomer.get(line.customerId);
    if (!entry) {
      entry = { name: line.customerName, items: new Map() };
      byCustomer.set(line.customerId, entry);
      customerOrder.push(line.customerId);
    }
    const key = displayKey(line.display);
    const existing = entry.items.get(key);
    if (existing) {
      existing.quantity += 1;
    } else {
      entry.items.set(key, { display: line.display, quantity: 1 });
    }
  }

  return customerOrder
    .map((customerId) => {
      const entry = byCustomer.get(customerId)!;
      return {
        customerId,
        customerName: entry.name,
        items: [...entry.items.entries()].map(([key, item]) => ({
          key,
          quantity: item.quantity,
          display: item.display,
        })),
      };
    })
    .filter((group) => group.items.length > 0);
}

export function plainItem(name: string): ExportItemDisplay {
  return { kind: "plain", name };
}

export function exchangedItem(
  newNames: string[],
  oldName: string
): ExportItemDisplay {
  return { kind: "exchanged", newNames, oldName };
}
