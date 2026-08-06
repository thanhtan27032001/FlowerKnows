package com.gaden.flowerknows.account;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface StaffAccountRepository extends JpaRepository<StaffAccount, UUID> {

    Optional<StaffAccount> findByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCase(String username);
}
