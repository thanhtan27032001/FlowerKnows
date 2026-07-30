import { apiClient } from "@/src/lib/api/client";

export type StockTransactionType =
  | "STOCK_IN"
  | "STOCK_ADJUSTMENT"
  | "CAMPAIGN_LOCK"
  | "CAMPAIGN_RETURN"
  | "EXCHANGE_IN"
  | "EXCHANGE_OUT"
  | "CASH_OUT_RETURN"
  | "TOKEN_CANCEL_RETURN"
  | "ORDER_FULFILLMENT"
  | "EXCHANGE_UNDO_RETURN"
  | "EXCHANGE_UNDO_REMOVE";

export type StockLedgerItem = {
  id: string;
  productId: string;
  productName: string;
  type: StockTransactionType;
  quantityChange: number;
  costPrice: number | null;
  note: string | null;
  createdAt: string;
};

export type StockLedgerPage = {
  content: StockLedgerItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
};

export type StockLedgerQuery = {
  page?: number;
  size?: number;
  productId?: string;
  type?: StockTransactionType;
  dateFrom?: string;
  dateTo?: string;
};

export const stockLedgerKeys = {
  all: ["stock-ledger"] as const,
  list: (query: StockLedgerQuery) =>
    [
      ...stockLedgerKeys.all,
      "list",
      query.page ?? 0,
      query.size ?? 50,
      query.productId ?? "",
      query.type ?? "",
      query.dateFrom ?? "",
      query.dateTo ?? "",
    ] as const,
};

export const stockLedgerApi = {
  list: (query: StockLedgerQuery) => {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 0));
    params.set("size", String(query.size ?? 50));
    if (query.productId) params.set("productId", query.productId);
    if (query.type) params.set("type", query.type);
    if (query.dateFrom) params.set("dateFrom", query.dateFrom);
    if (query.dateTo) params.set("dateTo", query.dateTo);
    return apiClient.get<StockLedgerPage>(
      `/api/stock-transactions?${params.toString()}`
    );
  },
};
