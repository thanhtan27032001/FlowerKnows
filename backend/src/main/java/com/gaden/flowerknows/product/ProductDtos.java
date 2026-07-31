package com.gaden.flowerknows.product;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ProductDtos {

    private ProductDtos() {
    }

    public record CreateProductItemRequest(
            @NotBlank(message = "name is required") String name,
            @NotNull(message = "listPrice is required")
            @DecimalMin(value = "0", inclusive = false, message = "listPrice must be positive")
            BigDecimal listPrice,
            @Min(value = 0, message = "stockQuantity cannot be negative") Integer stockQuantity,
            BigDecimal costPrice
    ) {
        public int resolvedStockQuantity() {
            return stockQuantity == null ? 0 : stockQuantity;
        }
    }

    public record CreateProductsRequest(
            @NotEmpty(message = "products must not be empty")
            @Valid List<CreateProductItemRequest> products,
            Boolean confirmDuplicate
    ) {
        public boolean isConfirmDuplicate() {
            return Boolean.TRUE.equals(confirmDuplicate);
        }
    }

    public record UpdateProductRequest(
            @NotBlank(message = "name is required") String name,
            Boolean confirmDuplicate
    ) {
        public boolean isConfirmDuplicate() {
            return Boolean.TRUE.equals(confirmDuplicate);
        }
    }

    public record StockInItemRequest(
            @NotNull(message = "productId is required") UUID productId,
            @Min(value = 1, message = "quantity must be at least 1") int quantity,
            @NotNull(message = "costPrice is required")
            @DecimalMin(value = "0", inclusive = false, message = "costPrice must be greater than 0")
            BigDecimal costPrice,
            String note
    ) {
    }

    public record StockInRequest(
            @NotEmpty(message = "items must not be empty")
            @Valid List<StockInItemRequest> items
    ) {
    }

    public enum AdjustmentDirection {
        INCREASE,
        DECREASE
    }

    public record StockAdjustmentRequest(
            @NotNull(message = "direction is required") AdjustmentDirection direction,
            @Min(value = 1, message = "quantity must be at least 1") int quantity,
            @NotBlank(message = "Please enter a reason for the adjustment") String note
    ) {
    }

    public record ProductResponse(
            UUID id,
            String name,
            BigDecimal listPrice,
            int stockQuantity,
            BigDecimal averageCostPrice,
            boolean lowStock
    ) {
        public static ProductResponse from(Product product, int lowStockThreshold) {
            return new ProductResponse(
                    product.getId(),
                    product.getName(),
                    product.getListPrice(),
                    product.getStockQuantity(),
                    product.getAverageCostPrice(),
                    product.getStockQuantity() <= lowStockThreshold
            );
        }
    }

    public record CreateProductsResponse(
            List<ProductResponse> products
    ) {
    }

    public record StockTransactionResponse(
            UUID id,
            UUID productId,
            String productName,
            String type,
            String typeLabel,
            int quantityChange,
            BigDecimal costPrice,
            BigDecimal averageCostPriceBefore,
            String note,
            Instant createdAt,
            int balanceAfter,
            boolean ledgerMismatch,
            @JsonProperty("isUndoable") boolean isUndoable
    ) {
    }

    public record StockInResponse(
            List<ProductResponse> products
    ) {
    }
}
