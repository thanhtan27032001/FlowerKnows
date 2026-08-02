package com.gaden.flowerknows.campaign;

import com.gaden.flowerknows.customer.Customer;
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
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "campaign_participant",
        uniqueConstraints = @UniqueConstraint(columnNames = {"campaign_id", "customer_id"})
)
public class CampaignParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "campaign_id", nullable = false)
    private Campaign campaign;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(name = "total_bags_purchased", nullable = false)
    private int totalBagsPurchased;

    @Column(name = "prepaid_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal prepaidAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ParticipantStatus status = ParticipantStatus.CONFIRMED;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected CampaignParticipant() {
    }

    public CampaignParticipant(Campaign campaign, Customer customer, int totalBagsPurchased, BigDecimal prepaidAmount) {
        this(campaign, customer, totalBagsPurchased, prepaidAmount, ParticipantStatus.CONFIRMED);
    }

    public CampaignParticipant(
            Campaign campaign,
            Customer customer,
            int totalBagsPurchased,
            BigDecimal prepaidAmount,
            ParticipantStatus status
    ) {
        this.campaign = campaign;
        this.customer = customer;
        this.totalBagsPurchased = totalBagsPurchased;
        this.prepaidAmount = prepaidAmount;
        this.status = status;
        this.createdAt = Instant.now();
    }

    public void addBags(int bags, BigDecimal amount) {
        this.totalBagsPurchased += bags;
        this.prepaidAmount = this.prepaidAmount.add(amount);
    }

    public UUID getId() {
        return id;
    }

    public Campaign getCampaign() {
        return campaign;
    }

    public Customer getCustomer() {
        return customer;
    }

    public int getTotalBagsPurchased() {
        return totalBagsPurchased;
    }

    public void setTotalBagsPurchased(int totalBagsPurchased) {
        this.totalBagsPurchased = totalBagsPurchased;
    }

    public BigDecimal getPrepaidAmount() {
        return prepaidAmount;
    }

    public void setPrepaidAmount(BigDecimal prepaidAmount) {
        this.prepaidAmount = prepaidAmount;
    }

    public ParticipantStatus getStatus() {
        return status;
    }

    public void setStatus(ParticipantStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
