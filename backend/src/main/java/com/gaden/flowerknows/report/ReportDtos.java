package com.gaden.flowerknows.report;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ReportDtos {

    private ReportDtos() {
    }

    public record InventoryItemResponse(
            UUID productId,
            String productName,
            int stockQuantity,
            long lockedInOpenCampaigns,
            boolean lowStock
    ) {
    }

    public record RevenueReportResponse(
            Instant from,
            Instant to,
            BigDecimal revenueFromOrders,
            BigDecimal revenueFromCancelledTokens,
            BigDecimal totalRevenue,
            BigDecimal totalRefundedCashOut,
            ReconciliationResponse reconciliation,
            CampaignBreakdownResponse campaignBreakdown
    ) {
    }

    public record ReconciliationResponse(
            BigDecimal totalPrepaid,
            BigDecimal holdingTokensValue,
            BigDecimal recognizedRevenue,
            BigDecimal totalRefunded,
            BigDecimal computedRightHandSide,
            boolean balanced,
            String formula
    ) {
    }

    public record CampaignBreakdownResponse(
            UUID campaignId,
            String campaignName,
            BigDecimal prepaidAmount,
            long bagsSold,
            int totalBags,
            Map<String, Long> tokensByStatus
    ) {
    }
}
