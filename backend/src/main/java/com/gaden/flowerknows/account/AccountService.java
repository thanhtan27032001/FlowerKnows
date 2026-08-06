package com.gaden.flowerknows.account;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class AccountService {

    public static final int MIN_PASSWORD_LENGTH = 8;

    private final StaffAccountRepository staffAccountRepository;
    private final PasswordEncoder passwordEncoder;

    public AccountService(StaffAccountRepository staffAccountRepository, PasswordEncoder passwordEncoder) {
        this.staffAccountRepository = staffAccountRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<AccountDtos.AccountResponse> listAccounts() {
        return staffAccountRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AccountDtos.AccountResponse createAccount(AccountDtos.CreateAccountRequest request) {
        String username = request.username().trim();
        if (staffAccountRepository.existsByUsernameIgnoreCase(username)) {
            throw new BusinessException("Username already exists: " + username);
        }
        if (request.password().length() < MIN_PASSWORD_LENGTH) {
            throw new BusinessException("Password must be at least " + MIN_PASSWORD_LENGTH + " characters");
        }

        StaffAccount account = staffAccountRepository.save(new StaffAccount(
                username,
                passwordEncoder.encode(request.password()),
                request.fullName().trim(),
                request.role()
        ));
        return toResponse(account);
    }

    @Transactional
    public AccountDtos.AccountResponse setActive(UUID id, AccountDtos.SetActiveRequest request) {
        StaffAccount account = staffAccountRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found: " + id));
        account.setActive(request.active());
        return toResponse(account);
    }

    private AccountDtos.AccountResponse toResponse(StaffAccount account) {
        return new AccountDtos.AccountResponse(
                account.getId(),
                account.getUsername(),
                account.getFullName(),
                account.getRole(),
                account.isActive(),
                account.getCreatedAt()
        );
    }
}
