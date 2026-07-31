package com.gaden.flowerknows.product;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, UUID id);

    List<Product> findByNameIgnoreCase(String name);

    List<Product> findAllByOrderByCreatedAtDesc();

    List<Product> findByStockQuantityGreaterThanAndAverageCostPriceIsNotNull(int stockQuantity);

    @Query("""
            SELECT p FROM Product p
            WHERE (:q = '' OR p.searchKey LIKE CONCAT('%', :q, '%'))
            """)
    List<Product> search(@Param("q") String foldedQuery, Sort sort);
}
