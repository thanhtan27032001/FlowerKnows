package com.gaden.flowerknows.exchange;

import com.gaden.flowerknows.customer.Customer;
import com.gaden.flowerknows.token.ItemToken;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "exchange_transaction")
public class ExchangeTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ExchangeType type;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "additional_payment", precision = 12, scale = 0)
    private BigDecimal additionalPayment;

    @Column(name = "suggested_refund_amount", precision = 12, scale = 0)
    private BigDecimal suggestedRefundAmount;

    @Column(name = "actual_refund_amount", precision = 12, scale = 0)
    private BigDecimal actualRefundAmount;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "exchange_token_in",
            joinColumns = @JoinColumn(name = "exchange_transaction_id"),
            inverseJoinColumns = @JoinColumn(name = "item_token_id")
    )
    private List<ItemToken> tokensIn = new ArrayList<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "exchange_token_out",
            joinColumns = @JoinColumn(name = "exchange_transaction_id"),
            inverseJoinColumns = @JoinColumn(name = "item_token_id")
    )
    private List<ItemToken> tokensOut = new ArrayList<>();

    protected ExchangeTransaction() {
    }

    public static ExchangeTransaction itemExchange(Customer customer, BigDecimal additionalPayment) {
        ExchangeTransaction tx = new ExchangeTransaction();
        tx.customer = customer;
        tx.type = ExchangeType.ITEM_EXCHANGE;
        tx.additionalPayment = additionalPayment != null ? additionalPayment : BigDecimal.ZERO;
        tx.createdAt = Instant.now();
        return tx;
    }

    public static ExchangeTransaction cashOut(
            Customer customer,
            BigDecimal suggestedRefundAmount,
            BigDecimal actualRefundAmount
    ) {
        ExchangeTransaction tx = new ExchangeTransaction();
        tx.customer = customer;
        tx.type = ExchangeType.CASH_OUT;
        tx.suggestedRefundAmount = suggestedRefundAmount;
        tx.actualRefundAmount = actualRefundAmount;
        tx.createdAt = Instant.now();
        return tx;
    }

    public UUID getId() {
        return id;
    }

    public Customer getCustomer() {
        return customer;
    }

    public ExchangeType getType() {
        return type;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public BigDecimal getAdditionalPayment() {
        return additionalPayment;
    }

    public BigDecimal getSuggestedRefundAmount() {
        return suggestedRefundAmount;
    }

    public BigDecimal getActualRefundAmount() {
        return actualRefundAmount;
    }

    public List<ItemToken> getTokensIn() {
        return tokensIn;
    }

    public List<ItemToken> getTokensOut() {
        return tokensOut;
    }
}
