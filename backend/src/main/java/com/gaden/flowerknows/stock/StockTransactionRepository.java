package com.gaden.flowerknows.stock;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
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
            SELECT s FROM StockTransaction s
            JOIN FETCH s.product
            WHERE s.id = :id
            """)
    Optional<StockTransaction> findByIdWithProduct(@Param("id") UUID id);

    @Query("""
            SELECT COUNT(s) > 0 FROM StockTransaction s
            WHERE s.product.id = :productId
              AND s.type = com.gaden.flowerknows.stock.StockTransactionType.STOCK_IN
              AND (s.createdAt > :createdAt
                   OR (s.createdAt = :createdAt AND s.id > :id))
            """)
    boolean existsNewerStockIn(
            @Param("productId") UUID productId,
            @Param("createdAt") Instant createdAt,
            @Param("id") UUID id
    );

    @Query("""
            SELECT new com.gaden.flowerknows.stock.StockLedgerItem(
                s.id,
                p.id,
                p.name,
                s.type,
                s.quantityChange,
                s.costPrice,
                s.note,
                s.createdAt
            )
            FROM StockTransaction s
            JOIN s.product p
            WHERE (:productId IS NULL OR p.id = :productId)
              AND (:type IS NULL OR s.type = :type)
              AND s.createdAt >= :createdFrom
              AND s.createdAt < :createdToExclusive
            ORDER BY s.createdAt DESC, s.id DESC
            """)
    Page<StockLedgerItem> findLedgerPage(
            @Param("productId") UUID productId,
            @Param("type") StockTransactionType type,
            @Param("createdFrom") Instant createdFrom,
            @Param("createdToExclusive") Instant createdToExclusive,
            Pageable pageable
    );

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
