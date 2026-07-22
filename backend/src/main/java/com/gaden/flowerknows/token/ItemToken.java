package com.gaden.flowerknows.token;

import com.gaden.flowerknows.customer.Customer;
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
@Table(name = "item_token")
public class ItemToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(name = "token_value", nullable = false, precision = 12, scale = 0)
    private BigDecimal tokenValue;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TokenStatus status = TokenStatus.HOLDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 20)
    private SourceType sourceType;

    @Column(name = "source_id", nullable = false)
    private UUID sourceId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    protected ItemToken() {
    }

    public ItemToken(
            Product product,
            Customer customer,
            BigDecimal tokenValue,
            SourceType sourceType,
            UUID sourceId
    ) {
        this.product = product;
        this.customer = customer;
        this.tokenValue = tokenValue;
        this.status = TokenStatus.HOLDING;
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public Product getProduct() {
        return product;
    }

    public Customer getCustomer() {
        return customer;
    }

    public BigDecimal getTokenValue() {
        return tokenValue;
    }

    public TokenStatus getStatus() {
        return status;
    }

    public void setStatus(TokenStatus status) {
        this.status = status;
    }

    public SourceType getSourceType() {
        return sourceType;
    }

    public UUID getSourceId() {
        return sourceId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    public void cancel() {
        requireHolding();
        this.status = TokenStatus.CANCELLED;
        this.cancelledAt = Instant.now();
    }

    public void requireHolding() {
        if (status != TokenStatus.HOLDING) {
            throw new IllegalStateException(
                    "Only HOLDING tokens can be acted on (token %s has status %s)".formatted(id, status)
            );
        }
    }
}
