import { apiClient } from "@/src/lib/api/client";

export type Product = {
  id: string;
  name: string;
  listPrice: number;
  stockQuantity: number;
  averageCostPrice: number | null;
  lowStock: boolean;
};

export type ProductSortBy = "name" | "averageCostPrice" | "stockQuantity";
export type SortDir = "asc" | "desc";

export type ProductListParams = {
  q?: string;
  sortBy?: ProductSortBy;
  sortDir?: SortDir;
};

export type CreateProductItemInput = {
  name: string;
  listPrice: number;
  stockQuantity?: number;
  costPrice?: number;
};

export type CreateProductsInput = {
  products: CreateProductItemInput[];
  confirmDuplicate?: boolean;
};

export type UpdateProductInput = {
  name: string;
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
  averageCostPriceBefore: number | null;
  note: string | null;
  createdAt: string;
  balanceAfter: number;
  ledgerMismatch: boolean;
  isUndoable: boolean;
};

export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  list: (params: ProductListParams) =>
    [...productKeys.lists(), params] as const,
  detail: (id: string) => [...productKeys.all, "detail", id] as const,
  transactions: (id: string) =>
    [...productKeys.all, "transactions", id] as const,
};

export const productApi = {
  list: (params: ProductListParams = {}) => {
    const search = new URLSearchParams();
    if (params.q?.trim()) search.set("q", params.q.trim());
    if (params.sortBy) search.set("sortBy", params.sortBy);
    if (params.sortDir) search.set("sortDir", params.sortDir);
    const qs = search.toString();
    return apiClient.get<Product[]>(
      qs ? `/api/products?${qs}` : "/api/products"
    );
  },

  get: (id: string) => apiClient.get<Product>(`/api/products/${id}`),

  nameExists: (name: string, excludeId?: string) => {
    const params = new URLSearchParams({ name });
    if (excludeId) params.set("excludeId", excludeId);
    return apiClient.get<{ exists: boolean }>(
      `/api/products/name-exists?${params.toString()}`
    );
  },

  create: (input: CreateProductsInput) =>
    apiClient.post<{ products: Product[] }>("/api/products", {
      products: input.products.map((p) => ({
        name: p.name,
        listPrice: p.listPrice,
        stockQuantity: p.stockQuantity ?? 0,
        costPrice: p.costPrice,
      })),
      confirmDuplicate: input.confirmDuplicate ?? false,
    }),

  update: (id: string, input: UpdateProductInput) =>
    apiClient.patch<Product>(`/api/products/${id}`, {
      name: input.name,
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
