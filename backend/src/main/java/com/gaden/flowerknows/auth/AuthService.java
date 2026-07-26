package com.gaden.flowerknows.auth;

import com.gaden.flowerknows.account.StaffAccount;
import com.gaden.flowerknows.account.StaffAccountRepository;
import com.gaden.flowerknows.common.UnauthorizedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    static final String INVALID_CREDENTIALS_MESSAGE = "Sai tên đăng nhập hoặc mật khẩu";

    private final StaffAccountRepository staffAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
            StaffAccountRepository staffAccountRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService
    ) {
        this.staffAccountRepository = staffAccountRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public AuthDtos.LoginResponse login(AuthDtos.LoginRequest request) {
        StaffAccount account = staffAccountRepository.findByUsername(request.username().trim())
                .filter(StaffAccount::isActive)
                .filter(a -> passwordEncoder.matches(request.password(), a.getPasswordHash()))
                .orElseThrow(() -> new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE));

        String role = account.getRole().name();
        String token = jwtService.generateToken(account.getUsername(), role);
        return new AuthDtos.LoginResponse(token, account.getUsername(), role, account.getFullName());
    }
}
