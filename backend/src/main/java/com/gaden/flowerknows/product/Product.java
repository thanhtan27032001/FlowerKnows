package com.gaden.flowerknows.product;

import com.gaden.flowerknows.common.TextSearch;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "product")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    /** Folded name for accent/case-insensitive search (US-32). */
    @Column(name = "search_key", nullable = false)
    private String searchKey;

    @Column(name = "list_price", nullable = false, precision = 12, scale = 0)
    private BigDecimal listPrice;

    @Column(name = "stock_quantity", nullable = false)
    private int stockQuantity;

    @Column(name = "average_cost_price", precision = 12, scale = 2)
    private BigDecimal averageCostPrice;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Product() {
    }

    public Product(String name, BigDecimal listPrice, int stockQuantity) {
        setName(name);
        this.listPrice = listPrice;
        this.stockQuantity = stockQuantity;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
        this.searchKey = TextSearch.fold(name);
    }

    public String getSearchKey() {
        return searchKey;
    }

    public BigDecimal getListPrice() {
        return listPrice;
    }

    public void setListPrice(BigDecimal listPrice) {
        this.listPrice = listPrice;
    }

    public int getStockQuantity() {
        return stockQuantity;
    }

    public void setStockQuantity(int stockQuantity) {
        this.stockQuantity = stockQuantity;
    }

    public BigDecimal getAverageCostPrice() {
        return averageCostPrice;
    }

    public void setAverageCostPrice(BigDecimal averageCostPrice) {
        this.averageCostPrice = averageCostPrice;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
