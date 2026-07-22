package com.gaden.flowerknows.exchange;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public interface ExchangeTransactionRepository extends JpaRepository<ExchangeTransaction, UUID> {

    @Query("""
            SELECT COALESCE(SUM(e.actualRefundAmount), 0) FROM ExchangeTransaction e
            WHERE e.type = com.gaden.flowerknows.exchange.ExchangeType.CASH_OUT
              AND e.createdAt >= :from AND e.createdAt < :to
            """)
    BigDecimal sumActualRefundBetween(Instant from, Instant to);

    @Query("""
            SELECT COALESCE(SUM(e.actualRefundAmount), 0) FROM ExchangeTransaction e
            WHERE e.type = com.gaden.flowerknows.exchange.ExchangeType.CASH_OUT
            """)
    BigDecimal sumAllActualRefund();
}
