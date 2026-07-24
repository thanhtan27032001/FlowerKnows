import { apiClient } from "@/src/lib/api/client";

export type InventoryItem = {
  productId: string;
  productName: string;
  stockQuantity: number;
  lockedInOpenCampaigns: number;
  lowStock: boolean;
};

export type Reconciliation = {
  totalPrepaid: number;
  holdingTokensValue: number;
  recognizedRevenue: number;
  totalRefunded: number;
  computedRightHandSide: number;
  balanced: boolean;
  formula: string;
};

export type CampaignBreakdown = {
  campaignId: string;
  campaignName: string;
  prepaidAmount: number;
  bagsSold: number;
  totalBags: number;
  tokensByStatus: Record<string, number>;
};

export type RevenueReport = {
  from: string;
  to: string;
  revenueFromOrders: number;
  revenueFromCancelledTokens: number;
  totalRevenue: number;
  orderGrossMargin: number;
  cancelledTokenMargin: number;
  totalGrossMargin: number;
  grossMarginPercent: number;
  ordersWithMissingCostBasis: number;
  marginMayBeUnderstated: boolean;
  totalRefundedCashOut: number;
  reconciliation: Reconciliation;
  campaignBreakdown: CampaignBreakdown | null;
};

export const reportKeys = {
  all: ["reports"] as const,
  inventory: () => [...reportKeys.all, "inventory"] as const,
  revenue: (from: string, to: string, campaignId?: string) =>
    [...reportKeys.all, "revenue", from, to, campaignId ?? ""] as const,
};

export const reportApi = {
  inventory: () =>
    apiClient.get<InventoryItem[]>("/api/reports/inventory"),

  revenue: (from: string, to: string, campaignId?: string) => {
    const params = new URLSearchParams({ from, to });
    if (campaignId) params.set("campaignId", campaignId);
    return apiClient.get<RevenueReport>(
      `/api/reports/revenue?${params.toString()}`
    );
  },
};
