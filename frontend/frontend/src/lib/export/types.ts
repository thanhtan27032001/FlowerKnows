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
