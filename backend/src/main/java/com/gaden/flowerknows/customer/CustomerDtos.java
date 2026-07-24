package com.gaden.flowerknows.customer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class CustomerDtos {

    private CustomerDtos() {
    }

    public record CreateCustomerRequest(
            @NotBlank(message = "name is required") String name,
            String phone,
            String address
    ) {
    }

    public record UpdateActionStatusRequest(
            @NotNull(message = "actionStatus is required") CustomerActionStatus actionStatus
    ) {
    }

    public record CustomerResponse(
            UUID id,
            String name,
            String phone,
            String address,
            CustomerActionStatus actionStatus,
            Instant createdAt
    ) {
        public static CustomerResponse from(Customer customer) {
            return new CustomerResponse(
                    customer.getId(),
                    customer.getName(),
                    customer.getPhone(),
                    customer.getAddress(),
                    customer.getActionStatus(),
                    customer.getCreatedAt()
            );
        }
    }

    public record TokenCardResponse(
            UUID id,
            UUID productId,
            String productName,
            BigDecimal tokenValue,
            BigDecimal costBasis,
            String status,
            String sourceType,
            UUID sourceId,
            String sourceLabel,
            Instant createdAt,
            long daysHeld,
            boolean overdue
    ) {
    }

    public record CustomerOrderSummaryResponse(
            UUID id,
            Instant createdAt,
            BigDecimal recognizedRevenue,
            BigDecimal totalCost,
            BigDecimal grossMargin,
            String shippingStatus,
            String carrierOrderId,
            int tokenCount
    ) {
    }

    public record CustomerDetailResponse(
            UUID id,
            String name,
            String phone,
            String address,
            CustomerActionStatus actionStatus,
            Instant createdAt,
            BigDecimal prepaidBalance,
            int overdueHoldingCount,
            CustomerOrderSummaryResponse latestOrder,
            List<CustomerOrderSummaryResponse> orders,
            List<TokenCardResponse> holdingTokens,
            List<TokenCardResponse> history
    ) {
    }
}
