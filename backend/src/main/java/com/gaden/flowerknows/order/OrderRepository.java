package com.gaden.flowerknows.order;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {

    List<Order> findByCustomerIdOrderByCreatedAtDesc(UUID customerId);

    @Query("""
            SELECT COALESCE(SUM(o.recognizedRevenue), 0) FROM Order o
            WHERE o.createdAt >= :from AND o.createdAt < :to
            """)
    BigDecimal sumRecognizedRevenueBetween(Instant from, Instant to);

    @Query("""
            SELECT COALESCE(SUM(o.recognizedRevenue), 0) FROM Order o
            """)
    BigDecimal sumAllRecognizedRevenue();
}
