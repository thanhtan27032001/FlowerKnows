package com.gaden.flowerknows.campaign;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "campaign")
public class Campaign {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "event_date", nullable = false)
    private LocalDate eventDate;

    @Column(name = "bag_price", nullable = false, precision = 12, scale = 0)
    private BigDecimal bagPrice;

    @Column(name = "total_bags", nullable = false)
    private int totalBags;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CampaignStatus status = CampaignStatus.OPEN;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "campaign", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CampaignPool> poolItems = new ArrayList<>();

    @OneToMany(mappedBy = "campaign", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CampaignParticipant> participants = new ArrayList<>();

    protected Campaign() {
    }

    public Campaign(String name, LocalDate eventDate, BigDecimal bagPrice, int totalBags) {
        this.name = name;
        this.eventDate = eventDate;
        this.bagPrice = bagPrice;
        this.totalBags = totalBags;
        this.status = CampaignStatus.OPEN;
        this.createdAt = Instant.now();
    }

    public void addPoolItem(CampaignPool poolItem) {
        poolItems.add(poolItem);
        poolItem.setCampaign(this);
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public LocalDate getEventDate() {
        return eventDate;
    }

    public void setEventDate(LocalDate eventDate) {
        this.eventDate = eventDate;
    }

    public BigDecimal getBagPrice() {
        return bagPrice;
    }

    public int getTotalBags() {
        return totalBags;
    }

    public void setTotalBags(int totalBags) {
        this.totalBags = totalBags;
    }

    public CampaignStatus getStatus() {
        return status;
    }

    public void setStatus(CampaignStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<CampaignPool> getPoolItems() {
        return poolItems;
    }

    public List<CampaignParticipant> getParticipants() {
        return participants;
    }
}
