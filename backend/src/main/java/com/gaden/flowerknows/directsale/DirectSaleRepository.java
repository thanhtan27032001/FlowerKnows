package com.gaden.flowerknows.directsale;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DirectSaleRepository extends JpaRepository<DirectSale, UUID> {

    @Query("""
            SELECT ds FROM DirectSale ds
            LEFT JOIN FETCH ds.lines l
            LEFT JOIN FETCH l.product
            LEFT JOIN FETCH ds.customer
            WHERE ds.id = :id
            """)
    Optional<DirectSale> findByIdWithLines(@Param("id") UUID id);

    @Query("""
            SELECT DISTINCT ds FROM DirectSale ds
            LEFT JOIN FETCH ds.lines l
            LEFT JOIN FETCH l.product
            LEFT JOIN FETCH ds.customer
            """)
    List<DirectSale> findAllWithLines();

    @Query("""
            SELECT DISTINCT ds FROM DirectSale ds
            LEFT JOIN FETCH ds.lines l
            LEFT JOIN FETCH l.product
            WHERE ds.customer.id = :customerId
            """)
    List<DirectSale> findByCustomerIdWithLines(@Param("customerId") UUID customerId);

    @Query("""
            SELECT COALESCE(SUM(ds.recognizedRevenue), 0) FROM DirectSale ds
            WHERE ds.createdAt >= :from AND ds.createdAt < :to
            """)
    BigDecimal sumRecognizedRevenueBetween(Instant from, Instant to);

    @Query("""
            SELECT COALESCE(SUM(ds.grossMargin), 0) FROM DirectSale ds
            WHERE ds.createdAt >= :from AND ds.createdAt < :to
            """)
    BigDecimal sumGrossMarginBetween(Instant from, Instant to);

    @Query("""
            SELECT COALESCE(SUM(ds.recognizedRevenue), 0) FROM DirectSale ds
            """)
    BigDecimal sumAllRecognizedRevenue();
}
