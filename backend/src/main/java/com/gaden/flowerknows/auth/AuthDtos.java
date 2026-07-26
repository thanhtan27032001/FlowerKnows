package com.gaden.flowerknows.auth;

import jakarta.validation.constraints.NotBlank;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginRequest(
            @NotBlank(message = "username is required") String username,
            @NotBlank(message = "password is required") String password
    ) {
    }

    public record LoginResponse(
            String token,
            String username,
            String role,
            String fullName
    ) {
    }
}
