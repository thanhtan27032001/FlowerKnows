package com.gaden.flowerknows.account;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/accounts")
@PreAuthorize("hasRole('OWNER')")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @GetMapping
    public List<AccountDtos.AccountResponse> list() {
        return accountService.listAccounts();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AccountDtos.AccountResponse create(@Valid @RequestBody AccountDtos.CreateAccountRequest request) {
        return accountService.createAccount(request);
    }

    @PatchMapping("/{id}/active")
    public AccountDtos.AccountResponse setActive(
            @PathVariable UUID id,
            @Valid @RequestBody AccountDtos.SetActiveRequest request
    ) {
        return accountService.setActive(id, request);
    }
}
