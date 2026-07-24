import { apiClient } from "@/src/lib/api/client";

export type Product = {
  id: string;
  name: string;
  listPrice: number;
  stockQuantity: number;
  averageCostPrice: number | null;
  lowStock: boolean;
};

export type CreateProductInput = {
  name: string;
  listPrice: number;
  stockQuantity?: number;
  confirmDuplicate?: boolean;
};

export type StockInItemInput = {
  productId: string;
  quantity: number;
  costPrice: number;
  note?: string;
};

export type StockAdjustmentInput = {
  direction: "INCREASE" | "DECREASE";
  quantity: number;
  note: string;
};

export type StockTransaction = {
  id: string;
  productId: string;
  productName: string;
  type: string;
  typeLabel: string;
  quantityChange: number;
  costPrice: number | null;
  note: string | null;
  createdAt: string;
  balanceAfter: number;
  ledgerMismatch: boolean;
};

export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  detail: (id: string) => [...productKeys.all, "detail", id] as const,
  transactions: (id: string) =>
    [...productKeys.all, "transactions", id] as const,
};

export const productApi = {
  list: () => apiClient.get<Product[]>("/api/products"),

  get: (id: string) => apiClient.get<Product>(`/api/products/${id}`),

  nameExists: (name: string) =>
    apiClient.get<{ exists: boolean }>(
      `/api/products/name-exists?name=${encodeURIComponent(name)}`
    ),

  create: (input: CreateProductInput) =>
    apiClient.post<Product>("/api/products", {
      name: input.name,
      listPrice: input.listPrice,
      stockQuantity: input.stockQuantity ?? 0,
      confirmDuplicate: input.confirmDuplicate ?? false,
    }),

  stockIn: (items: StockInItemInput[]) =>
    apiClient.post<{ products: Product[] }>("/api/products/stock-in", {
      items,
    }),

  adjustStock: (id: string, input: StockAdjustmentInput) =>
    apiClient.post<Product>(`/api/products/${id}/stock-adjustment`, input),

  listStockTransactions: (id: string) =>
    apiClient.get<StockTransaction[]>(
      `/api/products/${id}/stock-transactions`
    ),
};
