package com.gaden.flowerknows.directsale;

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
import java.util.UUID;

@Entity
@Table(name = "direct_sale_line")
public class DirectSaleLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "direct_sale_id", nullable = false)
    private DirectSale directSale;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 0)
    private BigDecimal unitPrice;

    @Column(name = "cost_price_snapshot", precision = 12, scale = 0)
    private BigDecimal costPriceSnapshot;

    protected DirectSaleLine() {
    }

    public DirectSaleLine(
            Product product,
            int quantity,
            BigDecimal unitPrice,
            BigDecimal costPriceSnapshot
    ) {
        this.product = product;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
        this.costPriceSnapshot = costPriceSnapshot;
    }

    public UUID getId() {
        return id;
    }

    public DirectSale getDirectSale() {
        return directSale;
    }

    void setDirectSale(DirectSale directSale) {
        this.directSale = directSale;
    }

    public Product getProduct() {
        return product;
    }

    public int getQuantity() {
        return quantity;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public BigDecimal getCostPriceSnapshot() {
        return costPriceSnapshot;
    }
}
