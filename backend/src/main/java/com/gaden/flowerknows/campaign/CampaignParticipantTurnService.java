package com.gaden.flowerknows.campaign;

import com.gaden.flowerknows.common.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CampaignParticipantTurnService {

    private final CampaignRepository campaignRepository;
    private final CampaignParticipantRepository participantRepository;
    private final CampaignParticipantTurnRepository turnRepository;

    public CampaignParticipantTurnService(
            CampaignRepository campaignRepository,
            CampaignParticipantRepository participantRepository,
            CampaignParticipantTurnRepository turnRepository
    ) {
        this.campaignRepository = campaignRepository;
        this.participantRepository = participantRepository;
        this.turnRepository = turnRepository;
    }

    /**
     * US-38 AC #1/#2: merge bags into this campaign's current last turn when it belongs
     * to the same participant; otherwise append a new turn.
     */
    @Transactional
    public void applyTurnIncrease(UUID campaignId, UUID campaignParticipantId, int additionalBags) {
        if (additionalBags <= 0) {
            return;
        }

        CampaignParticipant participant = participantRepository.findByIdWithCampaign(campaignParticipantId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Participant not found: " + campaignParticipantId
                ));
        if (!participant.getCampaign().getId().equals(campaignId)) {
            throw new ResourceNotFoundException("Participant not found in this campaign");
        }

        CampaignParticipantTurn lastTurn = turnRepository
                .findFirstByCampaignIdOrderByTurnNumberDesc(campaignId)
                .orElse(null);

        if (lastTurn != null && lastTurn.getCampaignParticipant().getId().equals(campaignParticipantId)) {
            lastTurn.setBagCount(lastTurn.getBagCount() + additionalBags);
            return;
        }

        int nextNumber = lastTurn == null ? 1 : lastTurn.getTurnNumber() + 1;
        turnRepository.save(new CampaignParticipantTurn(
                participant.getCampaign(),
                participant,
                nextNumber,
                additionalBags
        ));
    }

    /**
     * US-38 AC #5: LIFO decrease across this participant's own turns, deleting a row
     * when its bag_count reaches 0.
     */
    @Transactional
    public void applyTurnDecrease(UUID campaignParticipantId, int reduceBy) {
        if (reduceBy <= 0) {
            return;
        }

        List<CampaignParticipantTurn> turns = turnRepository
                .findByCampaignParticipantIdOrderByTurnNumberDesc(campaignParticipantId);

        int remaining = reduceBy;
        for (CampaignParticipantTurn turn : turns) {
            if (remaining <= 0) {
                break;
            }
            if (turn.getBagCount() <= remaining) {
                remaining -= turn.getBagCount();
                turnRepository.delete(turn);
            } else {
                turn.setBagCount(turn.getBagCount() - remaining);
                remaining = 0;
            }
        }
    }

    @Transactional
    public void deleteTurnsForParticipant(UUID campaignParticipantId) {
        turnRepository.deleteByCampaignParticipantId(campaignParticipantId);
    }

    @Transactional(readOnly = true)
    public List<CampaignDtos.ParticipantTurnResponse> listTurns(UUID campaignId) {
        if (!campaignRepository.existsById(campaignId)) {
            throw new ResourceNotFoundException("Campaign not found: " + campaignId);
        }
        return turnRepository.findByCampaignIdWithCustomerOrderByTurnNumberAsc(campaignId).stream()
                .map(CampaignParticipantTurnService::toResponse)
                .toList();
    }

    @Transactional
    public CampaignDtos.ParticipantTurnResponse updateNote(UUID turnId, String note) {
        CampaignParticipantTurn turn = turnRepository.findByIdWithCustomer(turnId)
                .orElseThrow(() -> new ResourceNotFoundException("Participant turn not found: " + turnId));
        turn.setNote(note);
        return toResponse(turn);
    }

    private static CampaignDtos.ParticipantTurnResponse toResponse(CampaignParticipantTurn turn) {
        var participant = turn.getCampaignParticipant();
        var customer = participant.getCustomer();
        return new CampaignDtos.ParticipantTurnResponse(
                turn.getId(),
                participant.getId(),
                customer.getId(),
                customer.getName(),
                turn.getTurnNumber(),
                turn.getBagCount(),
                turn.getNote()
        );
    }
}
