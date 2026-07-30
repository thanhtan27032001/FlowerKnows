package com.gaden.flowerknows.stock;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record StockLedgerItem(
        UUID id,
        UUID productId,
        String productName,
        StockTransactionType type,
        int quantityChange,
        BigDecimal costPrice,
        String note,
        Instant createdAt
) {
}
