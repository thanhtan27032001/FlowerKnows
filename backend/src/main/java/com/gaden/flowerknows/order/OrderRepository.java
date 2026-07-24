package com.gaden.flowerknows.order;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {

    List<Order> findByCustomerIdOrderByCreatedAtDesc(UUID customerId);

    List<Order> findAllByOrderByCreatedAtDesc();

    @Query("""
            SELECT o FROM Order o
            JOIN o.tokens t
            WHERE t.id = :tokenId
            """)
    Optional<Order> findByTokenId(UUID tokenId);

    @Query("""
            SELECT o FROM Order o
            JOIN o.tokens t
            WHERE t.id IN :tokenIds
            """)
    List<Order> findAllByTokenIds(Collection<UUID> tokenIds);

    @Query("""
            SELECT COALESCE(SUM(o.recognizedRevenue), 0) FROM Order o
            WHERE o.createdAt >= :from AND o.createdAt < :to
            """)
    BigDecimal sumRecognizedRevenueBetween(Instant from, Instant to);

    @Query("""
            SELECT COALESCE(SUM(o.grossMargin), 0) FROM Order o
            WHERE o.createdAt >= :from AND o.createdAt < :to
            """)
    BigDecimal sumGrossMarginBetween(Instant from, Instant to);

    @Query("""
            SELECT COUNT(DISTINCT o.id) FROM Order o
            JOIN o.tokens t
            WHERE o.createdAt >= :from AND o.createdAt < :to
              AND t.costBasis IS NULL
            """)
    long countOrdersWithNullCostBasisBetween(Instant from, Instant to);

    @Query("""
            SELECT COALESCE(SUM(o.recognizedRevenue), 0) FROM Order o
            """)
    BigDecimal sumAllRecognizedRevenue();
}
