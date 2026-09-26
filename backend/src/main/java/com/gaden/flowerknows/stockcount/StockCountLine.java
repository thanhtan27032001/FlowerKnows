package com.gaden.flowerknows.stockcount;

import com.gaden.flowerknows.product.Product;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "stock_count_line")
public class StockCountLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stock_count_id", nullable = false)
    private StockCount stockCount;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "system_quantity_at_add", nullable = false)
    private int systemQuantityAtAdd;

    @Column(name = "counted_quantity")
    private Integer countedQuantity;

    @Column(name = "cost_price", precision = 12, scale = 0)
    private BigDecimal costPrice;

    @Column(length = 500)
    private String note;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected StockCountLine() {
    }

    public StockCountLine(Product product, int systemQuantityAtAdd) {
        this.product = product;
        this.systemQuantityAtAdd = systemQuantityAtAdd;
    }

    public UUID getId() {
        return id;
    }

    public StockCount getStockCount() {
        return stockCount;
    }

    void setStockCount(StockCount stockCount) {
        this.stockCount = stockCount;
    }

    public Product getProduct() {
        return product;
    }

    public int getSystemQuantityAtAdd() {
        return systemQuantityAtAdd;
    }

    public Integer getCountedQuantity() {
        return countedQuantity;
    }

    public void setCountedQuantity(Integer countedQuantity) {
        this.countedQuantity = countedQuantity;
    }

    public BigDecimal getCostPrice() {
        return costPrice;
    }

    public void setCostPrice(BigDecimal costPrice) {
        this.costPrice = costPrice;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
