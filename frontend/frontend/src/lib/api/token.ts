import { apiClient } from "@/src/lib/api/client";

export type OverdueToken = {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  productId: string;
  productName: string;
  createdAt: string;
  daysHeld: number;
  tokenValue: number;
  overdue: boolean;
};

export type CancelTokenResponse = {
  id: string;
  status: string;
  recognizedRevenue: number;
  cancelledAt: string;
  message: string;
};

export const tokenKeys = {
  all: ["tokens"] as const,
  overdue: () => [...tokenKeys.all, "overdue"] as const,
};

export const tokenApi = {
  listOverdue: () =>
    apiClient.get<OverdueToken[]>("/api/tokens/overdue"),

  cancel: (id: string) =>
    apiClient.post<CancelTokenResponse>(`/api/tokens/${id}/cancel`),

  /** US-28: hard-delete a mistaken campaign recording (Owner only). */
  deleteRecorded: (id: string) =>
    apiClient.delete<void>(`/api/tokens/${id}`),
};
