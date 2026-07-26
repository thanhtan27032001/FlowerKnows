package com.gaden.flowerknows.campaign;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CampaignParticipantRepository extends JpaRepository<CampaignParticipant, UUID> {

    Optional<CampaignParticipant> findByCampaignIdAndCustomerId(UUID campaignId, UUID customerId);

    List<CampaignParticipant> findByCampaignId(UUID campaignId);

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
