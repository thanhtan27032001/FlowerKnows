export type ExportItemDisplay =
  | { kind: "plain"; name: string }
  | { kind: "exchanged"; newNames: string[]; oldName: string };

export type ExportItem = {
  /** Stable key used for aggregation + React lists. */
  key: string;
  quantity: number;
  display: ExportItemDisplay;
};

export type ExportCustomerGroup = {
  customerId: string;
  customerName: string;
  items: ExportItem[];
};

/** One token/product contribution before customer+product aggregation. */
export type ExportLineInput = {
  customerId: string;
  customerName: string;
  display: ExportItemDisplay;
};

/** One flat Item | Unit Cost | Quantity row (US-31 suggested-pool export). */
export type ExportCostRow = {
  key: string;
  name: string;
  /** `null` when the product has no known average cost price. */
  unitCost: number | null;
  quantity: number;
};
