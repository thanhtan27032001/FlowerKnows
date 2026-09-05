package com.gaden.flowerknows.stockcount;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StockCountRepository extends JpaRepository<StockCount, UUID> {

    @Query("""
            SELECT DISTINCT sc FROM StockCount sc
            LEFT JOIN FETCH sc.lines l
            LEFT JOIN FETCH l.product
            WHERE sc.id = :id
            """)
    Optional<StockCount> findByIdWithLines(@Param("id") UUID id);

    List<StockCount> findAllByOrderByCreatedAtDesc();

    List<StockCount> findByCompletedAtIsNullOrderByCreatedAtDesc();

    List<StockCount> findByCompletedAtIsNotNullOrderByCreatedAtDesc();
}
