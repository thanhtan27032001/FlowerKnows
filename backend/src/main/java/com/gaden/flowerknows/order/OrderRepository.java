package com.gaden.flowerknows.order;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {

    List<Order> findByCustomerIdOrderByCreatedAtDesc(UUID customerId);

    /**
     * Load orders with eager token count in one query (avoids N+1 lazy {@code order.getTokens().size()}).
     * Each row is {@code [Order, tokenCount (Long)]}.
     */
    @Query("""
            SELECT o, COUNT(t) FROM Order o
            LEFT JOIN o.tokens t
            WHERE o.customer.id = :customerId
            GROUP BY o
            ORDER BY o.createdAt DESC
            """)
    List<Object[]> findByCustomerIdWithTokenCount(@Param("customerId") UUID customerId);

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

    /**
     * Maps token id → order in one query (avoids lazy {@code tokens} collection loads).
     * Each row is {@code [tokenId (UUID), Order]}.
     */
    @Query("""
            SELECT t.id, o FROM Order o
            JOIN o.tokens t
            WHERE t.id IN :tokenIds
            """)
    List<Object[]> findOrdersMappedByTokenIds(Collection<UUID> tokenIds);

    /**
     * Latest shipping status per customer (PostgreSQL DISTINCT ON).
     * Each row is {@code [customerId (UUID), shippingStatus (String)]}.
     */
    @Query(value = """
            SELECT DISTINCT ON (customer_id) customer_id, shipping_status
            FROM "order"
            ORDER BY customer_id, created_at DESC
            """, nativeQuery = true)
    List<Object[]> findLatestShippingStatusByCustomer();

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
