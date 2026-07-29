package com.gaden.flowerknows.token;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ItemTokenRepository extends JpaRepository<ItemToken, UUID> {

    interface ParticipantItemNameRow {
        UUID getParticipantId();
        String getProductName();
    }

    long countBySourceTypeAndSourceId(SourceType sourceType, UUID sourceId);

    List<ItemToken> findByIdInAndCustomerId(Collection<UUID> ids, UUID customerId);

    List<ItemToken> findByCustomerIdAndStatusOrderByCreatedAtDesc(UUID customerId, TokenStatus status);

    List<ItemToken> findByCustomerIdAndStatusNotOrderByCreatedAtDesc(UUID customerId, TokenStatus status);

    @Query("""
            SELECT t FROM ItemToken t
            JOIN FETCH t.product
            WHERE t.customer.id = :customerId AND t.status = :status
            ORDER BY t.createdAt DESC
            """)
    List<ItemToken> findByCustomerIdAndStatusWithProduct(
            @Param("customerId") UUID customerId,
            @Param("status") TokenStatus status
    );

    @Query("""
            SELECT t FROM ItemToken t
            JOIN FETCH t.product
            WHERE t.customer.id = :customerId AND t.status <> :status
            ORDER BY t.createdAt DESC
            """)
    List<ItemToken> findByCustomerIdAndStatusNotWithProduct(
            @Param("customerId") UUID customerId,
            @Param("status") TokenStatus status
    );

    List<ItemToken> findByStatusAndCreatedAtBeforeOrderByCreatedAtAsc(TokenStatus status, Instant cutoff);

    List<ItemToken> findBySourceTypeAndSourceIdOrderByCreatedAtDesc(
            SourceType sourceType,
            UUID sourceId
    );

    @Query("""
            SELECT t FROM ItemToken t
            JOIN FETCH t.product
            WHERE t.sourceType = :sourceType
              AND t.sourceId = :sourceId
            ORDER BY t.createdAt DESC
            """)
    List<ItemToken> findBySourceTypeAndSourceIdWithProduct(
            @Param("sourceType") SourceType sourceType,
            @Param("sourceId") UUID sourceId
    );

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
            SELECT t.sourceId, COUNT(t) FROM ItemToken t
            WHERE t.sourceType = com.gaden.flowerknows.token.SourceType.CAMPAIGN
              AND t.sourceId IN :participantIds
            GROUP BY t.sourceId
            """)
    List<Object[]> countTokensByParticipantIds(@Param("participantIds") Collection<UUID> participantIds);

    @Query("""
            SELECT t FROM ItemToken t
            JOIN FETCH t.product
            WHERE t.sourceType = com.gaden.flowerknows.token.SourceType.CAMPAIGN
              AND t.sourceId IN :participantIds
            ORDER BY t.createdAt DESC
            """)
    List<ItemToken> findByParticipantIdsWithProduct(@Param("participantIds") Collection<UUID> participantIds);

    @Query(value = """
            SELECT ranked.source_id AS participantId, p.name AS productName
            FROM (
                SELECT t.source_id, t.product_id,
                       ROW_NUMBER() OVER (PARTITION BY t.source_id ORDER BY t.created_at DESC) AS rn
                FROM item_token t
                WHERE t.source_type = 'CAMPAIGN'
                  AND t.source_id IN (:participantIds)
            ) ranked
            JOIN product p ON p.id = ranked.product_id
            WHERE ranked.rn <= 3
            ORDER BY ranked.source_id, ranked.rn
            """, nativeQuery = true)
    List<ParticipantItemNameRow> findTopProductNamesByParticipantIds(
            @Param("participantIds") Collection<UUID> participantIds
    );

    @Query("""
            SELECT COALESCE(SUM(t.tokenValue), 0) FROM ItemToken t
            WHERE t.status = :status
              AND t.createdAt >= :from AND t.createdAt < :to
            """)
    BigDecimal sumTokenValueByStatusBetween(TokenStatus status, Instant from, Instant to);
}
