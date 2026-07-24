package com.gaden.flowerknows.stock;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface StockTransactionRepository extends JpaRepository<StockTransaction, UUID> {

    List<StockTransaction> findByTypeAndCreatedAtBetween(
            StockTransactionType type,
            Instant from,
            Instant to
    );

    List<StockTransaction> findByProductIdOrderByCreatedAtDesc(UUID productId);

    List<StockTransaction> findByProductIdOrderByCreatedAtAsc(UUID productId);

    @Query("""
            SELECT COALESCE(SUM(s.quantityChange), 0) FROM StockTransaction s
            WHERE s.product.id = :productId
            """)
    long sumQuantityChangeByProductId(UUID productId);

    @Query("""
            SELECT COALESCE(SUM(s.costPrice * s.quantityChange), 0)
            FROM StockTransaction s
            WHERE s.type = com.gaden.flowerknows.stock.StockTransactionType.STOCK_IN
              AND s.costPrice IS NOT NULL
            """)
    BigDecimal sumCapitalInvestedFromStockIn();
}
