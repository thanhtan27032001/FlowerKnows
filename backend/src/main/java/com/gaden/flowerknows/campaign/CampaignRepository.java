package com.gaden.flowerknows.campaign;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CampaignRepository extends JpaRepository<Campaign, UUID> {

    @Query("""
            SELECT DISTINCT c FROM Campaign c
            LEFT JOIN FETCH c.poolItems pi
            LEFT JOIN FETCH pi.product
            WHERE c.id = :id
            """)
    Optional<Campaign> findByIdWithPool(UUID id);

    List<Campaign> findAllByOrderByCreatedAtDesc();
}
