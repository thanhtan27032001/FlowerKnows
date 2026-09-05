import { apiClient } from "@/src/lib/api/client";

export type StockCountLine = {
  id: string;
  productId: string;
  productName: string;
  systemQuantityAtAdd: number;
  countedQuantity: number | null;
  costPrice: number | null;
  note: string | null;
};

export type StockCountSummary = {
  id: string;
  createdAt: string;
  completedAt: string | null;
  note: string | null;
  lineCount: number;
};

export type StockCountDetail = {
  id: string;
  createdAt: string;
  completedAt: string | null;
  note: string | null;
  lines: StockCountLine[];
};

export type AddStockCountLineInput = {
  productId: string;
  costPrice?: number;
  note?: string;
};

export type UpdateStockCountLineInput = {
  countedQuantity?: number;
  costPrice?: number;
  note?: string;
};

export const stockCountKeys = {
  all: ["stock-counts"] as const,
  lists: () => [...stockCountKeys.all, "list"] as const,
  list: (completed?: boolean) =>
    [...stockCountKeys.lists(), completed ?? "all"] as const,
  detail: (id: string) => [...stockCountKeys.all, "detail", id] as const,
};

export const stockCountApi = {
  list: (completed?: boolean) => {
    const qs = completed === undefined ? "" : `?completed=${completed}`;
    return apiClient.get<StockCountSummary[]>(`/api/stock-counts${qs}`);
  },

  get: (id: string) =>
    apiClient.get<StockCountDetail>(`/api/stock-counts/${id}`),

  create: (note?: string) =>
    apiClient.post<StockCountDetail>("/api/stock-counts", {
      note: note?.trim() || undefined,
    }),

  addLine: (stockCountId: string, input: AddStockCountLineInput) =>
    apiClient.post<StockCountLine>(
      `/api/stock-counts/${stockCountId}/lines`,
      input
    ),

  updateLine: (
    stockCountId: string,
    lineId: string,
    input: UpdateStockCountLineInput
  ) =>
    apiClient.patch<StockCountLine>(
      `/api/stock-counts/${stockCountId}/lines/${lineId}`,
      input
    ),

  removeLine: (stockCountId: string, lineId: string) =>
    apiClient.delete<void>(
      `/api/stock-counts/${stockCountId}/lines/${lineId}`
    ),

  cancel: (stockCountId: string) =>
    apiClient.delete<void>(`/api/stock-counts/${stockCountId}`),

  complete: (stockCountId: string) =>
    apiClient.post<StockCountDetail>(
      `/api/stock-counts/${stockCountId}/complete`
    ),
};
