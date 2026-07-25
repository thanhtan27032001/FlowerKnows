import { apiClient } from "@/src/lib/api/client";
import type { ShippingStatus } from "@/src/lib/api/order";

export type CustomerActionStatus =
  | "UNDETERMINED"
  | "NEGOTIATING"
  | "CONSOLIDATING"
  | "NEEDS_IMMEDIATE_ORDER";

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  actionStatus: CustomerActionStatus;
  latestShippingStatus: ShippingStatus | null;
  createdAt: string;
};

export type CreateCustomerInput = {
  name: string;
  phone?: string;
  address?: string;
};

export type TokenStatus =
  | "HOLDING"
  | "EXCHANGED"
  | "CASHED_OUT"
  | "ORDERED"
  | "CANCELLED";

export type CustomerToken = {
  id: string;
  productId: string;
  productName: string;
  tokenValue: number;
  costBasis: number | null;
  status: TokenStatus;
  sourceType: "CAMPAIGN" | "EXCHANGE";
  sourceId: string;
  sourceLabel: string;
  createdAt: string;
  daysHeld: number;
  overdue: boolean;
};

export type CustomerOrderSummary = {
  id: string;
  createdAt: string;
  recognizedRevenue: number;
  totalCost: number;
  grossMargin: number;
  shippingStatus: string;
  carrierOrderId: string | null;
  tokenCount: number;
};

export type CustomerDetail = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  actionStatus: CustomerActionStatus;
  createdAt: string;
  prepaidBalance: number;
  overdueHoldingCount: number;
  latestOrder: CustomerOrderSummary | null;
  orders: CustomerOrderSummary[];
  holdingTokens: CustomerToken[];
  history: CustomerToken[];
};

/** Backend enum values — display labels live in messages via `common.status.action`. */
export const ACTION_STATUS_VALUES: CustomerActionStatus[] = [
  "UNDETERMINED",
  "NEGOTIATING",
  "CONSOLIDATING",
  "NEEDS_IMMEDIATE_ORDER",
];

export type CustomerSearchParams = {
  q?: string;
  actionStatus?: CustomerActionStatus | "";
  shippingStatus?: ShippingStatus | "";
};

export const customerKeys = {
  all: ["customers"] as const,
  search: (params: CustomerSearchParams) =>
    [
      ...customerKeys.all,
      "search",
      params.q ?? "",
      params.actionStatus ?? "",
      params.shippingStatus ?? "",
    ] as const,
  detail: (id: string) => [...customerKeys.all, "detail", id] as const,
};

export const customerApi = {
  search: (params: CustomerSearchParams = {}) => {
    const search = new URLSearchParams();
    if (params.q?.trim()) search.set("q", params.q.trim());
    if (params.actionStatus) search.set("actionStatus", params.actionStatus);
    if (params.shippingStatus) search.set("shippingStatus", params.shippingStatus);
    const qs = search.toString();
    return apiClient.get<Customer[]>(
      qs ? `/api/customers?${qs}` : "/api/customers"
    );
  },

  get: (id: string) =>
    apiClient.get<CustomerDetail>(`/api/customers/${id}`),

  create: (input: CreateCustomerInput) =>
    apiClient.post<Customer>("/api/customers", {
      name: input.name,
      phone: input.phone ?? null,
      address: input.address ?? null,
    }),

  updateActionStatus: (id: string, actionStatus: CustomerActionStatus) =>
    apiClient.patch<CustomerDetail>(`/api/customers/${id}/action-status`, {
      actionStatus,
    }),
};
