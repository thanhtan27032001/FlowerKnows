import { apiClient } from "@/src/lib/api/client";

export type ReceiveProductInput = {
  productId: string;
  quantity: number;
  tokenValue?: number;
};

export type ItemExchangeInput = {
  customerId: string;
  tokenIds: string[];
  receiveProducts: ReceiveProductInput[];
  additionalPayment?: number;
};

export type CashOutInput = {
  customerId: string;
  tokenIds: string[];
  actualRefundAmount: number;
};

export type TokenBrief = {
  id: string;
  productId: string;
  productName: string;
  tokenValue: number;
  status: string;
};

export type ExchangeResponse = {
  id: string;
  customerId: string;
  type: string;
  createdAt: string;
  additionalPayment: number | null;
  suggestedRefundAmount: number | null;
  actualRefundAmount: number | null;
  tokensIn: TokenBrief[];
  tokensOut: TokenBrief[];
};

export const exchangeKeys = {
  all: ["exchanges"] as const,
};

export const exchangeApi = {
  itemExchange: (input: ItemExchangeInput) =>
    apiClient.post<ExchangeResponse>("/api/exchanges/item-exchange", input),

  cashOut: (input: CashOutInput) =>
    apiClient.post<ExchangeResponse>("/api/exchanges/cash-out", input),
};

export function exchangeErrorMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "status" in err &&
    (err as { status: number }).status === 409
  ) {
    const message =
      err instanceof Error ? err.message : "Token is not in HOLDING status";
    return `Conflict: ${message}. Refresh the customer page and try again with HOLDING tokens only.`;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
