package com.gaden.flowerknows.directsale;

import com.gaden.flowerknows.customer.Customer;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "direct_sale")
public class DirectSale {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "recognized_revenue", nullable = false, precision = 12, scale = 0)
    private BigDecimal recognizedRevenue;

    @Column(name = "total_cost", nullable = false, precision = 12, scale = 0)
    private BigDecimal totalCost;

    @Column(name = "gross_margin", nullable = false, precision = 12, scale = 0)
    private BigDecimal grossMargin;

    @OneToMany(mappedBy = "directSale", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DirectSaleLine> lines = new ArrayList<>();

    protected DirectSale() {
    }

    public DirectSale(
            Customer customer,
            BigDecimal recognizedRevenue,
            BigDecimal totalCost,
            BigDecimal grossMargin
    ) {
        this.customer = customer;
        this.recognizedRevenue = recognizedRevenue;
        this.totalCost = totalCost;
        this.grossMargin = grossMargin;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public Customer getCustomer() {
        return customer;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public BigDecimal getRecognizedRevenue() {
        return recognizedRevenue;
    }

    public BigDecimal getTotalCost() {
        return totalCost;
    }

    public BigDecimal getGrossMargin() {
        return grossMargin;
    }

    public List<DirectSaleLine> getLines() {
        return lines;
    }

    public void addLine(DirectSaleLine line) {
        lines.add(line);
        line.setDirectSale(this);
    }
}
