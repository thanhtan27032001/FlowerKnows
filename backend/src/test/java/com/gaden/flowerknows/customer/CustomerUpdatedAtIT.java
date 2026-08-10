package com.gaden.flowerknows.customer;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Confirms {@code @UpdateTimestamp} bumps {@code customer.updated_at} for every
 * write path that dirties a customer row (US-20 profile edit, US-18 manual
 * action_status, and the 3 automatic action_status transitions which all call
 * {@link Customer#setActionStatus}).
 *
 * Requires a running local Postgres (same as NPlusOneQueryCountIT).
 */
@SpringBootTest
@ActiveProfiles("local")
class CustomerUpdatedAtIT {

    @Autowired
    private CustomerRepository customerRepository;
    @Autowired
    private CustomerService customerService;
    @Autowired
    private EntityManager entityManager;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private TransactionTemplate transactionTemplate;

    @BeforeEach
    void requireDatabase() {
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
        } catch (DataAccessException ex) {
            Assumptions.assumeTrue(false, "Local Postgres not available: " + ex.getMessage());
        }
    }

    @Test
    void profileEditBumpsUpdatedAt() {
        UUID id = persistCustomer("UpdatedAt Profile");
        Instant before = readUpdatedAt(id);

        sleepBriefly();

        transactionTemplate.executeWithoutResult(status ->
                customerService.update(
                        id,
                        new CustomerDtos.UpdateCustomerRequest("UpdatedAt Profile Edit", null, null)
                )
        );

        Instant after = readUpdatedAt(id);
        assertTrue(after.isAfter(before), "US-20 edit should bump updated_at");
        cleanup(id);
    }

    @Test
    void manualActionStatusChangeBumpsUpdatedAt() {
        UUID id = persistCustomer("UpdatedAt Manual Status");
        Instant before = readUpdatedAt(id);

        sleepBriefly();

        transactionTemplate.executeWithoutResult(status ->
                customerService.updateActionStatus(
                        id,
                        new CustomerDtos.UpdateActionStatusRequest(CustomerActionStatus.NEGOTIATING)
                )
        );

        Instant after = readUpdatedAt(id);
        assertTrue(after.isAfter(before), "US-18 manual action_status should bump updated_at");
        cleanup(id);
    }

    @Test
    void automaticActionStatusDirtyingBumpsUpdatedAt() {
        // All 3 automatic transitions (US-18 AC#4/4a/4b) call setActionStatus on a
        // managed Customer; verifying that dirtying path covers them collectively.
        UUID id = persistCustomer("UpdatedAt Auto Status");
        Instant before = readUpdatedAt(id);

        sleepBriefly();

        transactionTemplate.executeWithoutResult(status -> {
            Customer customer = customerRepository.findById(id).orElseThrow();
            customer.setActionStatus(CustomerActionStatus.NEEDS_NEGOTIATE);
            entityManager.flush();
        });

        Instant after = readUpdatedAt(id);
        assertTrue(
                after.isAfter(before),
                "Automatic action_status dirtying (setActionStatus + flush) should bump updated_at"
        );
        cleanup(id);
    }

    private UUID persistCustomer(String name) {
        return transactionTemplate.execute(status ->
                customerRepository.save(new Customer(name, null, null)).getId()
        );
    }

    private Instant readUpdatedAt(UUID id) {
        return transactionTemplate.execute(status -> {
            entityManager.clear();
            return customerRepository.findById(id).orElseThrow().getUpdatedAt();
        });
    }

    private void cleanup(UUID id) {
        transactionTemplate.executeWithoutResult(status -> customerRepository.deleteById(id));
    }

    private static void sleepBriefly() {
        try {
            Thread.sleep(50);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}
