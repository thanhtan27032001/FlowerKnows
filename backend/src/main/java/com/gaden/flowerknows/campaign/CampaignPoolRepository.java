package com.gaden.flowerknows.campaign;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface CampaignPoolRepository extends JpaRepository<CampaignPool, UUID> {

    List<CampaignPool> findByCampaignId(UUID campaignId);

    @Query("""
            SELECT COALESCE(SUM(p.remainingQuantity), 0) FROM CampaignPool p
            WHERE p.product.id = :productId AND p.campaign.status = com.gaden.flowerknows.campaign.CampaignStatus.OPEN
            """)
    long sumRemainingQuantityInOpenCampaigns(UUID productId);
}
