package com.gaden.flowerknows.order;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class OrderDtos {

    private OrderDtos() {
    }

    public record CreateOrderRequest(
            @NotNull(message = "customerId is required") UUID customerId,
            @NotEmpty(message = "tokenIds must not be empty") List<UUID> tokenIds,
            String carrierOrderId
    ) {
    }

    public record UpdateShippingStatusRequest(
            @NotNull(message = "shippingStatus is required") ShippingStatus shippingStatus,
            String carrierOrderId
    ) {
    }

    public record OrderTokenResponse(
            UUID id,
            UUID productId,
            String productName,
            BigDecimal tokenValue,
            BigDecimal costBasis,
            String status
    ) {
    }

    public record OrderResponse(
            UUID id,
            UUID customerId,
            String customerName,
            Instant createdAt,
            BigDecimal recognizedRevenue,
            BigDecimal totalCost,
            BigDecimal grossMargin,
            ShippingStatus shippingStatus,
            String carrierOrderId,
            List<OrderTokenResponse> tokens
    ) {
    }
}
