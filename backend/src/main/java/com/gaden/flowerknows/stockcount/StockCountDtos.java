package com.gaden.flowerknows.stockcount;

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
