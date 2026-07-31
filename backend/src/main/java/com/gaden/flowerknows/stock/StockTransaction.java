package com.gaden.flowerknows.stock;

import com.gaden.flowerknows.product.Product;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "stock_transaction")
public class StockTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private StockTransactionType type;

    @Column(name = "quantity_change", nullable = false)
    private int quantityChange;

    @Column(name = "cost_price", precision = 12, scale = 2)
    private BigDecimal costPrice;

    /**
     * Snapshot of {@code product.average_cost_price} immediately before this
     * stock-in recalculation (US-13 / US-33). Null for non-stock-in rows and
     * for a product's first-ever stock-in.
     */
    @Column(name = "average_cost_price_before", precision = 12, scale = 2)
    private BigDecimal averageCostPriceBefore;

    @Column(length = 500)
    private String note;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected StockTransaction() {
    }

    public StockTransaction(Product product, StockTransactionType type, int quantityChange, String note) {
        this(product, type, quantityChange, null, null, note);
    }

    public StockTransaction(
            Product product,
            StockTransactionType type,
            int quantityChange,
            BigDecimal costPrice,
            String note
    ) {
        this(product, type, quantityChange, costPrice, null, note);
    }

    public StockTransaction(
            Product product,
            StockTransactionType type,
            int quantityChange,
            BigDecimal costPrice,
            BigDecimal averageCostPriceBefore,
            String note
    ) {
        this.product = product;
        this.type = type;
        this.quantityChange = quantityChange;
        this.costPrice = costPrice;
        this.averageCostPriceBefore = averageCostPriceBefore;
        this.note = note;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public Product getProduct() {
        return product;
    }

    public StockTransactionType getType() {
        return type;
    }

    public int getQuantityChange() {
        return quantityChange;
    }

    public String getNote() {
        return note;
    }

    public BigDecimal getCostPrice() {
        return costPrice;
    }

    public BigDecimal getAverageCostPriceBefore() {
        return averageCostPriceBefore;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
