package com.gaden.flowerknows.exchange;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ExchangeDtos {

    private ExchangeDtos() {
    }

    public record ReceiveProductRequest(
            @NotNull(message = "productId is required") UUID productId,
            @Min(value = 1, message = "quantity must be at least 1") int quantity,
            BigDecimal tokenValue
    ) {
    }

    public record ItemExchangeRequest(
            @NotNull(message = "customerId is required") UUID customerId,
            @NotEmpty(message = "tokenIds must not be empty") List<UUID> tokenIds,
            @NotEmpty(message = "receiveProducts must not be empty")
            @Valid List<ReceiveProductRequest> receiveProducts,
            BigDecimal additionalPayment
    ) {
    }

    public record CashOutRequest(
            @NotNull(message = "customerId is required") UUID customerId,
            @NotEmpty(message = "tokenIds must not be empty") List<UUID> tokenIds,
            @NotNull(message = "actualRefundAmount is required") BigDecimal actualRefundAmount
    ) {
    }

    public record TokenBriefResponse(
            UUID id,
            UUID productId,
            String productName,
            BigDecimal tokenValue,
            String status
    ) {
    }

    public record ExchangeResponse(
            UUID id,
            UUID customerId,
            String type,
            Instant createdAt,
            BigDecimal additionalPayment,
            BigDecimal suggestedRefundAmount,
            BigDecimal actualRefundAmount,
            List<TokenBriefResponse> tokensIn,
            List<TokenBriefResponse> tokensOut
    ) {
    }

    /** Customer exchange history row — includes US-29 undo eligibility. */
    public record ExchangeHistoryResponse(
            UUID id,
            UUID customerId,
            String type,
            Instant createdAt,
            BigDecimal additionalPayment,
            List<TokenBriefResponse> tokensIn,
            List<TokenBriefResponse> tokensOut,
            boolean undoEligible
    ) {
    }
}
