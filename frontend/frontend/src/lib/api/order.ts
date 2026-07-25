import { apiClient } from "@/src/lib/api/client";

export type ShippingStatus = "ORDER_CREATED" | "SHIPPED" | "COMPLETED";

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
  carrierOrderId: string | null;
  tokens: OrderToken[];
};

export type CreateOrderInput = {
  customerId: string;
  tokenIds: string[];
  carrierOrderId?: string | null;
};

export type UpdateShippingInput = {
  shippingStatus: ShippingStatus;
  carrierOrderId?: string | null;
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

  updateShippingStatus: (id: string, input: UpdateShippingInput) =>
    apiClient.patch<Order>(`/api/orders/${id}/shipping-status`, input),
};

/** Backend enum values — display labels live in messages via `common.status.shipping`. */
export const SHIPPING_STATUS_VALUES: ShippingStatus[] = [
  "ORDER_CREATED",
  "SHIPPED",
  "COMPLETED",
];

export const SHIPPING_NEXT: Record<ShippingStatus, ShippingStatus[]> = {
  ORDER_CREATED: ["ORDER_CREATED", "SHIPPED"],
  SHIPPED: ["SHIPPED", "COMPLETED"],
  COMPLETED: ["COMPLETED"],
};
