package com.gaden.flowerknows.token;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class TokenDtos {

    private TokenDtos() {
    }

    public record OverdueTokenResponse(
            UUID id,
            UUID customerId,
            String customerName,
            String customerPhone,
            UUID productId,
            String productName,
            Instant createdAt,
            long daysHeld,
            BigDecimal tokenValue,
            boolean overdue
    ) {
    }

    public record CancelTokenResponse(
            UUID id,
            String status,
            BigDecimal recognizedRevenue,
            Instant cancelledAt,
            String message
    ) {
    }
}
