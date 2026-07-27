package com.gaden.flowerknows.product;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    boolean existsByNameIgnoreCase(String name);

    List<Product> findByNameIgnoreCase(String name);

    List<Product> findAllByOrderByCreatedAtDesc();
}
