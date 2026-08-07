import type { CustomerActionStatus, TokenStatus } from "@/src/lib/api/customer";
import type { ShippingStatus } from "@/src/lib/api/order";

type Translate = (key: string) => string;

const TOKEN_STATUS_KEY: Record<TokenStatus, string> = {
  HOLDING: "holding",
  EXCHANGED: "exchanged",
  CASHED_OUT: "cashedOut",
  ORDERED: "ordered",
  CANCELLED: "cancelled",
};

const ACTION_STATUS_KEY: Record<CustomerActionStatus, string> = {
  UNDETERMINED: "undetermined",
  NEEDS_NEGOTIATE: "needsNegotiate",
  NEGOTIATING: "negotiating",
  CONSOLIDATING: "consolidating",
  NEEDS_IMMEDIATE_ORDER: "needsImmediateOrder",
};

const SHIPPING_STATUS_KEY: Record<ShippingStatus, string> = {
  ORDER_CREATED: "orderCreated",
  SHIPPED: "shipped",
  COMPLETED: "completed",
};

const STOCK_TX_KEY: Record<string, string> = {
  STOCK_IN: "stockIn",
  STOCK_ADJUSTMENT: "stockAdjustment",
  CAMPAIGN_LOCK: "campaignLock",
  CAMPAIGN_RETURN: "campaignReturn",
  EXCHANGE_IN: "exchangeIn",
  EXCHANGE_OUT: "exchangeOut",
  CASH_OUT_RETURN: "cashOutReturn",
  TOKEN_CANCEL_RETURN: "tokenCancelReturn",
  ORDER_FULFILLMENT: "orderFulfillment",
  EXCHANGE_UNDO_RETURN: "exchangeUndoReturn",
  EXCHANGE_UNDO_REMOVE: "exchangeUndoRemove",
};

const CAMPAIGN_STATUS_KEY: Record<"OPEN" | "CLOSED", string> = {
  OPEN: "open",
  CLOSED: "closed",
};

/** Display labels only — backend enums stay English. */
export function tokenStatusLabel(t: Translate, status: string) {
  const key = TOKEN_STATUS_KEY[status as TokenStatus];
  return key ? t(`token.${key}`) : status;
}

export function actionStatusLabel(t: Translate, status: CustomerActionStatus) {
  return t(`action.${ACTION_STATUS_KEY[status]}`);
}

export function shippingStatusLabel(t: Translate, status: ShippingStatus) {
  return t(`shipping.${SHIPPING_STATUS_KEY[status]}`);
}

export function stockTxLabel(t: Translate, type: string) {
  const key = STOCK_TX_KEY[type];
  return key ? t(`stockTx.${key}`) : type;
}

export function campaignStatusLabel(
  t: Translate,
  status: "OPEN" | "CLOSED" | string
) {
  const key = CAMPAIGN_STATUS_KEY[status as "OPEN" | "CLOSED"];
  return key ? t(`campaign.${key}`) : status;
}

export function exchangeTypeLabel(
  t: Translate,
  type: "item_exchange" | "cash_out" | string
) {
  if (type === "item_exchange" || type === "ITEM_EXCHANGE") {
    return t("exchange.itemExchange");
  }
  if (type === "cash_out" || type === "CASH_OUT") {
    return t("exchange.cashOut");
  }
  return type;
}
