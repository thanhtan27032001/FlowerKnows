package com.gaden.flowerknows.campaign;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CampaignParticipantTurnRepository extends JpaRepository<CampaignParticipantTurn, UUID> {

    Optional<CampaignParticipantTurn> findFirstByCampaignIdOrderByTurnNumberDesc(UUID campaignId);

    List<CampaignParticipantTurn> findByCampaignParticipantIdOrderByTurnNumberDesc(UUID campaignParticipantId);

    @Query("""
            SELECT t FROM CampaignParticipantTurn t
            JOIN FETCH t.campaignParticipant p
            JOIN FETCH p.customer
            WHERE t.campaign.id = :campaignId
            ORDER BY t.turnNumber ASC
            """)
    List<CampaignParticipantTurn> findByCampaignIdWithCustomerOrderByTurnNumberAsc(
            @Param("campaignId") UUID campaignId
    );

    @Query("""
            SELECT t FROM CampaignParticipantTurn t
            JOIN FETCH t.campaignParticipant p
            JOIN FETCH p.customer
            WHERE t.id = :id
            """)
    Optional<CampaignParticipantTurn> findByIdWithCustomer(@Param("id") UUID id);

    void deleteByCampaignParticipantId(UUID campaignParticipantId);
}
