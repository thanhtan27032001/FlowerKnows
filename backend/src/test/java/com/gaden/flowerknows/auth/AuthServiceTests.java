package com.gaden.flowerknows.auth;

import com.gaden.flowerknows.account.AccountRole;
import com.gaden.flowerknows.account.StaffAccount;
import com.gaden.flowerknows.account.StaffAccountRepository;
import com.gaden.flowerknows.common.UnauthorizedException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTests {

    @Mock
    private StaffAccountRepository staffAccountRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtService jwtService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(staffAccountRepository, passwordEncoder, jwtService);
    }

    @Test
    void loginSucceedsRegardlessOfUsernameCase() {
        StaffAccount account = new StaffAccount(
                "Owner",
                "hashed",
                "Shop Owner",
                AccountRole.OWNER
        );
        when(staffAccountRepository.findByUsernameIgnoreCase("OWNER")).thenReturn(Optional.of(account));
        when(passwordEncoder.matches("secret123", "hashed")).thenReturn(true);
        when(jwtService.generateToken("Owner", "OWNER")).thenReturn("jwt-token");

        AuthDtos.LoginResponse response = authService.login(
                new AuthDtos.LoginRequest("OWNER", "secret123")
        );

        assertEquals("jwt-token", response.token());
        assertEquals("Owner", response.username());
        assertEquals("OWNER", response.role());
        verify(staffAccountRepository).findByUsernameIgnoreCase("OWNER");
    }

    @Test
    void loginRejectsInvalidPasswordWithGenericMessage() {
        StaffAccount account = new StaffAccount(
                "owner",
                "hashed",
                "Shop Owner",
                AccountRole.OWNER
        );
        when(staffAccountRepository.findByUsernameIgnoreCase("owner")).thenReturn(Optional.of(account));
        when(passwordEncoder.matches(anyString(), eq("hashed"))).thenReturn(false);

        UnauthorizedException ex = assertThrows(
                UnauthorizedException.class,
                () -> authService.login(new AuthDtos.LoginRequest("owner", "wrong"))
        );

        assertEquals(AuthService.INVALID_CREDENTIALS_MESSAGE, ex.getMessage());
    }
}
