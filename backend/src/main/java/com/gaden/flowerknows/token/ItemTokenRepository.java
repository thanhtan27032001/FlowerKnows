package com.gaden.flowerknows.token;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ItemTokenRepository extends JpaRepository<ItemToken, UUID> {

    long countBySourceTypeAndSourceId(SourceType sourceType, UUID sourceId);

    List<ItemToken> findByIdInAndCustomerId(Collection<UUID> ids, UUID customerId);

    List<ItemToken> findByCustomerIdAndStatusOrderByCreatedAtDesc(UUID customerId, TokenStatus status);

    List<ItemToken> findByCustomerIdAndStatusNotOrderByCreatedAtDesc(UUID customerId, TokenStatus status);

    List<ItemToken> findByStatusAndCreatedAtBeforeOrderByCreatedAtAsc(TokenStatus status, Instant cutoff);

    @Query("""
            SELECT COALESCE(SUM(t.tokenValue), 0) FROM ItemToken t
            WHERE t.status = com.gaden.flowerknows.token.TokenStatus.HOLDING
            """)
    BigDecimal sumHoldingTokenValue();

    @Query("""
            SELECT COALESCE(SUM(t.tokenValue), 0) FROM ItemToken t
            WHERE t.status = com.gaden.flowerknows.token.TokenStatus.CANCELLED
              AND t.cancelledAt >= :from AND t.cancelledAt < :to
            """)
    BigDecimal sumCancelledTokenValueBetween(Instant from, Instant to);

    @Query("""
            SELECT COALESCE(SUM(t.tokenValue), 0) FROM ItemToken t
            WHERE t.status = com.gaden.flowerknows.token.TokenStatus.CANCELLED
            """)
    BigDecimal sumAllCancelledTokenValue();

    @Query("""
            SELECT t.status, COUNT(t) FROM ItemToken t
            WHERE t.sourceType = com.gaden.flowerknows.token.SourceType.CAMPAIGN
              AND t.sourceId IN :participantIds
            GROUP BY t.status
            """)
    List<Object[]> countByStatusForParticipants(Collection<UUID> participantIds);

    @Query("""
            SELECT COALESCE(SUM(t.tokenValue), 0) FROM ItemToken t
            WHERE t.status = :status
              AND t.createdAt >= :from AND t.createdAt < :to
            """)
    BigDecimal sumTokenValueByStatusBetween(TokenStatus status, Instant from, Instant to);
}
