import { apiClient } from "@/src/lib/api/client";

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
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

export type CustomerDetail = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  createdAt: string;
  prepaidBalance: number;
  overdueHoldingCount: number;
  holdingTokens: CustomerToken[];
  history: CustomerToken[];
};

export const customerKeys = {
  all: ["customers"] as const,
  search: (q: string) => [...customerKeys.all, "search", q] as const,
  detail: (id: string) => [...customerKeys.all, "detail", id] as const,
};

export const customerApi = {
  search: (q = "") =>
    apiClient.get<Customer[]>(
      q.trim()
        ? `/api/customers?q=${encodeURIComponent(q.trim())}`
        : "/api/customers"
    ),

  get: (id: string) =>
    apiClient.get<CustomerDetail>(`/api/customers/${id}`),

  create: (input: CreateCustomerInput) =>
    apiClient.post<Customer>("/api/customers", {
      name: input.name,
      phone: input.phone ?? null,
      address: input.address ?? null,
    }),
};
