import { apiClient } from "@/src/lib/api/client";

export type ShippingStatus = "PENDING" | "SHIPPING" | "COMPLETED";

export type OrderToken = {
  id: string;
  productId: string;
  productName: string;
  tokenValue: number;
  costBasis: number | null;
  status: string;
};

export type Order = {
  id: string;
  customerId: string;
  customerName: string;
  createdAt: string;
  recognizedRevenue: number;
  totalCost: number;
  grossMargin: number;
  shippingStatus: ShippingStatus;
  tokens: OrderToken[];
};

export type CreateOrderInput = {
  customerId: string;
  tokenIds: string[];
};

export const orderKeys = {
  all: ["orders"] as const,
  lists: () => [...orderKeys.all, "list"] as const,
  byCustomer: (customerId: string) =>
    [...orderKeys.all, "customer", customerId] as const,
  detail: (id: string) => [...orderKeys.all, "detail", id] as const,
};

export const orderApi = {
  list: (customerId?: string) =>
    apiClient.get<Order[]>(
      customerId
        ? `/api/orders?customerId=${encodeURIComponent(customerId)}`
        : "/api/orders"
    ),

  get: (id: string) => apiClient.get<Order>(`/api/orders/${id}`),

  create: (input: CreateOrderInput) =>
    apiClient.post<Order>("/api/orders", input),

  updateShippingStatus: (id: string, shippingStatus: ShippingStatus) =>
    apiClient.patch<Order>(`/api/orders/${id}/shipping-status`, {
      shippingStatus,
    }),
};

export const SHIPPING_LABEL: Record<ShippingStatus, string> = {
  PENDING: "Pending",
  SHIPPING: "Shipping",
  COMPLETED: "Completed",
};

export const SHIPPING_NEXT: Record<ShippingStatus, ShippingStatus[]> = {
  PENDING: ["PENDING", "SHIPPING"],
  SHIPPING: ["SHIPPING", "COMPLETED"],
  COMPLETED: ["COMPLETED"],
};
