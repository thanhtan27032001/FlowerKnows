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
  revenueFromDirectSales: number;
  totalRevenue: number;
  orderGrossMargin: number;
  cancelledTokenMargin: number;
  directSaleGrossMargin: number;
  totalGrossMargin: number;
  grossMarginPercent: number;
  ordersWithMissingCostBasis: number;
  marginMayBeUnderstated: boolean;
  totalRefundedCashOut: number;
  reconciliation: Reconciliation;
  campaignBreakdown: CampaignBreakdown | null;
};

export type ProfitOverview = {
  totalCapitalInvested: number;
  totalRevenue: number;
  totalProfit: number;
  revenueFromOrders: number;
  revenueFromCancelledTokens: number;
  revenueFromDirectSales: number;
  note: string;
};

export const reportKeys = {
  all: ["reports"] as const,
  inventory: () => [...reportKeys.all, "inventory"] as const,
  profitOverview: () => [...reportKeys.all, "profit-overview"] as const,
  revenue: (from: string, to: string, campaignId?: string) =>
    [...reportKeys.all, "revenue", from, to, campaignId ?? ""] as const,
};

export const reportApi = {
  inventory: () =>
    apiClient.get<InventoryItem[]>("/api/reports/inventory"),

  profitOverview: () =>
    apiClient.get<ProfitOverview>("/api/reports/profit-overview"),

  revenue: (from: string, to: string, campaignId?: string) => {
    const params = new URLSearchParams({ from, to });
    if (campaignId) params.set("campaignId", campaignId);
    return apiClient.get<RevenueReport>(
      `/api/reports/revenue?${params.toString()}`
    );
  },
};
