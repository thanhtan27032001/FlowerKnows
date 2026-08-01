import { apiClient } from "@/src/lib/api/client";

export type DirectSaleLine = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPriceSnapshot: number | null;
};

export type DirectSale = {
  id: string;
  customerId: string | null;
  customerName: string | null;
  createdAt: string;
  recognizedRevenue: number;
  totalCost: number;
  grossMargin: number;
  missingCostWarning: boolean;
  lines: DirectSaleLine[];
};

export type CreateDirectSaleLineInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export type CreateDirectSaleInput = {
  customerId?: string | null;
  lines: CreateDirectSaleLineInput[];
};

export const directSaleKeys = {
  all: ["direct-sales"] as const,
  lists: () => [...directSaleKeys.all, "list"] as const,
};

export const directSaleApi = {
  list: () => apiClient.get<DirectSale[]>("/api/direct-sales"),

  create: (input: CreateDirectSaleInput) =>
    apiClient.post<DirectSale>("/api/direct-sales", {
      customerId: input.customerId ?? null,
      lines: input.lines,
    }),

  cancel: (id: string) =>
    apiClient.post<void>(`/api/direct-sales/${id}/cancel`),
};
