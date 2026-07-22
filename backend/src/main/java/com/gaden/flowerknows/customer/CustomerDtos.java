package com.gaden.flowerknows.customer;

import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
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

    public record CustomerResponse(
            UUID id,
            String name,
            String phone,
            String address,
            Instant createdAt
    ) {
        public static CustomerResponse from(Customer customer) {
            return new CustomerResponse(
                    customer.getId(),
                    customer.getName(),
                    customer.getPhone(),
                    customer.getAddress(),
                    customer.getCreatedAt()
            );
        }
    }
}
