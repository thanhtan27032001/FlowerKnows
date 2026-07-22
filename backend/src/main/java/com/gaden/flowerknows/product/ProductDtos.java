package com.gaden.flowerknows.product;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public final class ProductDtos {

    private ProductDtos() {
    }

    public record CreateProductRequest(
            @NotBlank(message = "name is required") String name,
            @NotNull(message = "listPrice is required")
            @DecimalMin(value = "0", inclusive = false, message = "listPrice must be positive")
            BigDecimal listPrice,
            @Min(value = 0, message = "stockQuantity cannot be negative") int stockQuantity
    ) {
    }

    public record ProductResponse(
            UUID id,
            String name,
            BigDecimal listPrice,
            int stockQuantity
    ) {
        public static ProductResponse from(Product product) {
            return new ProductResponse(
                    product.getId(),
                    product.getName(),
                    product.getListPrice(),
                    product.getStockQuantity()
            );
        }
    }
}
