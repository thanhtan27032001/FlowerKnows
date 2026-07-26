package com.gaden.flowerknows.account;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public final class AccountDtos {

    private AccountDtos() {
    }

    public record CreateAccountRequest(
            @NotBlank(message = "username is required") String username,
            @NotBlank(message = "password is required")
            @Size(min = 8, message = "password must be at least 8 characters")
            String password,
            @NotBlank(message = "fullName is required") String fullName,
            @NotNull(message = "role is required") AccountRole role
    ) {
    }

    public record SetActiveRequest(
            @NotNull(message = "active is required") Boolean active
    ) {
    }

    public record AccountResponse(
            UUID id,
            String username,
            String fullName,
            AccountRole role,
            boolean active,
            Instant createdAt
    ) {
    }
}
