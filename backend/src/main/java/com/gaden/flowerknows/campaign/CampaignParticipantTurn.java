package com.gaden.flowerknows.campaign;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.UUID;

@Entity
@Table(
        name = "campaign_participant_turn",
        uniqueConstraints = @UniqueConstraint(columnNames = {"campaign_id", "turn_number"})
)
public class CampaignParticipantTurn {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "campaign_id", nullable = false)
    private Campaign campaign;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "campaign_participant_id", nullable = false)
    private CampaignParticipant campaignParticipant;

    @Column(name = "turn_number", nullable = false)
    private int turnNumber;

    @Column(name = "bag_count", nullable = false)
    private int bagCount;

    @Column(length = 500)
    private String note;

    protected CampaignParticipantTurn() {
    }

    public CampaignParticipantTurn(
            Campaign campaign,
            CampaignParticipant campaignParticipant,
            int turnNumber,
            int bagCount
    ) {
        this.campaign = campaign;
        this.campaignParticipant = campaignParticipant;
        this.turnNumber = turnNumber;
        this.bagCount = bagCount;
    }

    public UUID getId() {
        return id;
    }

    public Campaign getCampaign() {
        return campaign;
    }

    public CampaignParticipant getCampaignParticipant() {
        return campaignParticipant;
    }

    public int getTurnNumber() {
        return turnNumber;
    }

    public int getBagCount() {
        return bagCount;
    }

    public void setBagCount(int bagCount) {
        this.bagCount = bagCount;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
