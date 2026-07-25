import { apiClient, ApiError } from "@/src/lib/api/client";

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

type Translate = (
  key: "notHolding" | "conflict",
  values?: Record<string, string>
) => string;

/**
 * Maps exchange API errors to display strings.
 * Pass `t` from `useTranslations('exchange.errors')`.
 */
export function exchangeErrorMessage(
  err: unknown,
  fallback: string,
  t?: Translate
): string {
  if (
    err &&
    typeof err === "object" &&
    "status" in err &&
    (err as { status: number }).status === 409
  ) {
    const message =
      err instanceof Error
        ? err.message
        : t
          ? t("notHolding")
          : "Token không ở trạng thái Đang giữ";
    if (t) return t("conflict", { message });
    return `Xung đột: ${message}. Tải lại trang khách và chỉ thử với token Đang giữ.`;
  }
  if (err instanceof ApiError && err.message) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
