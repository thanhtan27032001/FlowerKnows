package com.gaden.flowerknows.exchange;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExchangeTransactionRepository extends JpaRepository<ExchangeTransaction, UUID> {

    @Query("""
            SELECT e FROM ExchangeTransaction e
            JOIN e.tokensIn t
            WHERE t.id = :tokenId
            """)
    Optional<ExchangeTransaction> findByTokenInId(UUID tokenId);

    @Query("""
            SELECT e FROM ExchangeTransaction e
            JOIN e.tokensIn t
            WHERE t.id IN :tokenIds
            """)
    List<ExchangeTransaction> findAllByTokenInIds(Collection<UUID> tokenIds);

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
