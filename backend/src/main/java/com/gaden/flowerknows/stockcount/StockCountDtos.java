package com.gaden.flowerknows.stockcount;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class StockCountDtos {

    private StockCountDtos() {
    }

    public record CreateStockCountRequest(String note) {
    }

    public record AddLineRequest(
            @NotNull(message = "productId is required") UUID productId,
            BigDecimal costPrice,
            String note
    ) {
    }

    public record UpdateLineRequest(
            Integer countedQuantity,
            BigDecimal costPrice,
            String note
    ) {
    }

    public record BulkAddLineItem(
            @NotNull(message = "productId is required") UUID productId,
            Integer countedQuantity,
            BigDecimal costPrice,
            String note
    ) {
    }

    public record BulkAddLinesRequest(
            @NotEmpty(message = "items must not be empty")
            @Valid List<BulkAddLineItem> items
    ) {
    }

    public record BulkAddLinesResponse(
            List<StockCountLineResponse> added,
            List<UUID> skippedProductIds
    ) {
    }

    public record BulkUpdateLineItem(
            @NotNull(message = "lineId is required") UUID lineId,
            Integer countedQuantity,
            BigDecimal costPrice,
            String note
    ) {
    }

    public record BulkUpdateLinesRequest(
            @NotEmpty(message = "items must not be empty")
            @Valid List<BulkUpdateLineItem> items
    ) {
    }

    public record StockCountLineResponse(
            UUID id,
            UUID productId,
            String productName,
            int systemQuantityAtAdd,
            Integer countedQuantity,
            BigDecimal costPrice,
            String note
    ) {
    }

    public record StockCountSummaryResponse(
            UUID id,
            Instant createdAt,
            Instant completedAt,
            String note,
            int lineCount
    ) {
    }

    public record StockCountDetailResponse(
            UUID id,
            Instant createdAt,
            Instant completedAt,
            String note,
            List<StockCountLineResponse> lines
    ) {
    }
}
