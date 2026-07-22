package com.gaden.flowerknows.stock;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface StockTransactionRepository extends JpaRepository<StockTransaction, UUID> {

    List<StockTransaction> findByTypeAndCreatedAtBetween(
            StockTransactionType type,
            Instant from,
            Instant to
    );
}
