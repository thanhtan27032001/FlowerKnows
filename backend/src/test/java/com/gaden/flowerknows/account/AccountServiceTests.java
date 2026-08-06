package com.gaden.flowerknows.account;

import com.gaden.flowerknows.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountServiceTests {

    @Mock
    private StaffAccountRepository staffAccountRepository;
    @Mock
    private PasswordEncoder passwordEncoder;

    private AccountService accountService;

    @BeforeEach
    void setUp() {
        accountService = new AccountService(staffAccountRepository, passwordEncoder);
    }

    @Test
    void createAccountRejectsDuplicateUsernameRegardlessOfCase() {
        when(staffAccountRepository.existsByUsernameIgnoreCase("Staff1")).thenReturn(true);

        BusinessException ex = assertThrows(
                BusinessException.class,
                () -> accountService.createAccount(
                        new AccountDtos.CreateAccountRequest(
                                "Staff1",
                                "password1",
                                "New Staff",
                                AccountRole.STAFF
                        )
                )
        );

        assertTrue(ex.getMessage().contains("already exists"));
        verify(staffAccountRepository, never()).save(any());
    }

    @Test
    void createAccountPersistsWhenUsernameIsUniqueIgnoringCase() {
        when(staffAccountRepository.existsByUsernameIgnoreCase("newstaff")).thenReturn(false);
        when(passwordEncoder.encode("password1")).thenReturn("hashed");
        when(staffAccountRepository.save(any(StaffAccount.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        AccountDtos.AccountResponse response = accountService.createAccount(
                new AccountDtos.CreateAccountRequest(
                        "newstaff",
                        "password1",
                        "New Staff",
                        AccountRole.STAFF
                )
        );

        assertEquals("newstaff", response.username());
        assertEquals(AccountRole.STAFF, response.role());

        ArgumentCaptor<StaffAccount> captor = ArgumentCaptor.forClass(StaffAccount.class);
        verify(staffAccountRepository).save(captor.capture());
        assertEquals("hashed", captor.getValue().getPasswordHash());
    }
}
