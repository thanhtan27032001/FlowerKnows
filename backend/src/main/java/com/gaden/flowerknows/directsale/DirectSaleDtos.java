package com.gaden.flowerknows.directsale;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class DirectSaleDtos {

    private DirectSaleDtos() {
    }

    public record CreateDirectSaleLineRequest(
            @NotNull(message = "productId is required") UUID productId,
            @Min(value = 1, message = "quantity must be at least 1") int quantity,
            @NotNull(message = "unitPrice is required")
            @DecimalMin(value = "0", message = "unitPrice must be >= 0") BigDecimal unitPrice
    ) {
    }

    public record CreateDirectSaleRequest(
            UUID customerId,
            @NotEmpty(message = "lines must not be empty")
            List<@Valid CreateDirectSaleLineRequest> lines
    ) {
    }

    public record DirectSaleLineResponse(
            UUID id,
            UUID productId,
            String productName,
            int quantity,
            BigDecimal unitPrice,
            BigDecimal costPriceSnapshot
    ) {
    }

    public record DirectSaleResponse(
            UUID id,
            UUID customerId,
            String customerName,
            Instant createdAt,
            BigDecimal recognizedRevenue,
            BigDecimal totalCost,
            BigDecimal grossMargin,
            boolean missingCostWarning,
            List<DirectSaleLineResponse> lines
    ) {
    }
}
