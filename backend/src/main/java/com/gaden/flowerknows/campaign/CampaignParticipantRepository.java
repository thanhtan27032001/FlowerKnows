package com.gaden.flowerknows.campaign;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CampaignParticipantRepository extends JpaRepository<CampaignParticipant, UUID> {

    Optional<CampaignParticipant> findByCampaignIdAndCustomerId(UUID campaignId, UUID customerId);

    List<CampaignParticipant> findByCampaignId(UUID campaignId);

    @Query("""
            SELECT DISTINCT p FROM CampaignParticipant p
            JOIN FETCH p.customer
            WHERE p.campaign.id = :campaignId
            """)
    List<CampaignParticipant> findByCampaignIdWithCustomer(UUID campaignId);

    @Query("""
            SELECT p FROM CampaignParticipant p
            JOIN FETCH p.campaign
            WHERE p.id = :id
            """)
    Optional<CampaignParticipant> findByIdWithCampaign(UUID id);

    @Query("""
            SELECT p FROM CampaignParticipant p
            JOIN FETCH p.campaign
            WHERE p.id IN :ids
            """)
    List<CampaignParticipant> findAllByIdWithCampaign(@Param("ids") Collection<UUID> ids);

    long countByCampaignId(UUID campaignId);

    @Query("""
            SELECT COALESCE(SUM(p.totalBagsPurchased), 0) FROM CampaignParticipant p
            WHERE p.campaign.id = :campaignId AND p.status = com.gaden.flowerknows.campaign.ParticipantStatus.CONFIRMED
            """)
    long sumBagsPurchasedByCampaign(UUID campaignId);

    @Query("""
            SELECT COALESCE(SUM(p.prepaidAmount), 0) FROM CampaignParticipant p
            WHERE p.status = com.gaden.flowerknows.campaign.ParticipantStatus.CONFIRMED
            """)
    java.math.BigDecimal sumAllPrepaidAmount();

    @Query("""
            SELECT COALESCE(SUM(p.prepaidAmount), 0) FROM CampaignParticipant p
            WHERE p.campaign.id = :campaignId
              AND p.status = com.gaden.flowerknows.campaign.ParticipantStatus.CONFIRMED
            """)
    java.math.BigDecimal sumPrepaidAmountByCampaign(UUID campaignId);
}
