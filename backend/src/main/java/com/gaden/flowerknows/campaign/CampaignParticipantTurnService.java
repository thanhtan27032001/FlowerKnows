package com.gaden.flowerknows.campaign;

import com.gaden.flowerknows.common.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

    /**
     * US-38 AC #10: Owner-only manual turn creation. Unlike applyTurnIncrease, this never
     * merges into an existing last turn — it always appends a distinct row. As of v5.4 the
     * save always succeeds regardless of the resulting sum; the response just reports
     * whether it's balanced (see toResponse) so the frontend can show a non-blocking warning.
     */
    @Transactional
    public CampaignDtos.ParticipantTurnResponse createManualTurn(
            UUID campaignId,
            CampaignDtos.CreateParticipantTurnRequest request
    ) {
        CampaignParticipant participant = participantRepository.findByIdWithCampaign(request.campaignParticipantId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Participant not found: " + request.campaignParticipantId()
                ));
        if (!participant.getCampaign().getId().equals(campaignId)) {
            throw new ResourceNotFoundException("Participant not found in this campaign");
        }
        if (participant.getStatus() != ParticipantStatus.CONFIRMED) {
            throw new IllegalStateException(
                    "Cannot add a turn for a participant that is not confirmed"
            );
        }

        int nextNumber = turnRepository.findFirstByCampaignIdOrderByTurnNumberDesc(campaignId)
                .map(t -> t.getTurnNumber() + 1)
                .orElse(1);

        CampaignParticipantTurn turn = new CampaignParticipantTurn(
                participant.getCampaign(),
                participant,
                nextNumber,
                request.bagCount()
        );
        turn.setNote(request.note());
        turnRepository.saveAndFlush(turn);

        int sum = turnRepository.sumBagCountByCampaignParticipantId(participant.getId());
        return toResponse(turnRepository.findByIdWithCustomer(turn.getId()).orElseThrow(), sum);
    }

    /**
     * US-38 AC #11: Owner-only direct bag_count edit. As of v5.4 the save always succeeds;
     * the response reports the resulting balance as a non-blocking warning signal only.
     */
    @Transactional
    public CampaignDtos.ParticipantTurnResponse updateBagCount(UUID turnId, int bagCount) {
        CampaignParticipantTurn turn = turnRepository.findByIdWithCustomer(turnId)
                .orElseThrow(() -> new ResourceNotFoundException("Participant turn not found: " + turnId));
        turn.setBagCount(bagCount);
        turnRepository.flush();

        int sum = turnRepository.sumBagCountByCampaignParticipantId(turn.getCampaignParticipant().getId());
        return toResponse(turn, sum);
    }

    /**
     * US-38 AC #12: Owner-only direct row deletion. As of v5.4 the delete always succeeds;
     * since the row itself is gone, the affected participant's post-delete balance is
     * reported directly rather than via a ParticipantTurnResponse.
     */
    @Transactional
    public CampaignDtos.ParticipantTurnBalanceResponse deleteTurn(UUID turnId) {
        CampaignParticipantTurn turn = turnRepository.findByIdWithCustomer(turnId)
                .orElseThrow(() -> new ResourceNotFoundException("Participant turn not found: " + turnId));
        CampaignParticipant participant = turn.getCampaignParticipant();

        turnRepository.delete(turn);
        turnRepository.flush();

        int sum = turnRepository.sumBagCountByCampaignParticipantId(participant.getId());
        int expected = participant.getTotalBagsPurchased();
        return new CampaignDtos.ParticipantTurnBalanceResponse(
                participant.getId(), sum == expected, sum - expected
        );
    }

    @Transactional(readOnly = true)
    public List<CampaignDtos.ParticipantTurnResponse> listTurns(UUID campaignId) {
        if (!campaignRepository.existsById(campaignId)) {
            throw new ResourceNotFoundException("Campaign not found: " + campaignId);
        }
        List<CampaignParticipantTurn> turns =
                turnRepository.findByCampaignIdWithCustomerOrderByTurnNumberAsc(campaignId);

        Map<UUID, Integer> sumsByParticipantId = new HashMap<>();
        for (CampaignParticipantTurn turn : turns) {
            sumsByParticipantId.merge(turn.getCampaignParticipant().getId(), turn.getBagCount(), Integer::sum);
        }

        return turns.stream()
                .map(turn -> toResponse(turn, sumsByParticipantId.get(turn.getCampaignParticipant().getId())))
                .toList();
    }

    @Transactional
    public CampaignDtos.ParticipantTurnResponse updateNote(UUID turnId, String note) {
        CampaignParticipantTurn turn = turnRepository.findByIdWithCustomer(turnId)
                .orElseThrow(() -> new ResourceNotFoundException("Participant turn not found: " + turnId));
        turn.setNote(note);

        int sum = turnRepository.sumBagCountByCampaignParticipantId(turn.getCampaignParticipant().getId());
        return toResponse(turn, sum);
    }

    /**
     * US-38 AC #13 (v5.4): isBalanced/difference are informational only — Σ bag_count vs
     * total_bags_purchased for this turn's participant. Never blocks a save; the caller
     * (frontend) decides whether/how to surface a mismatch as a warning.
     */
    private static CampaignDtos.ParticipantTurnResponse toResponse(
            CampaignParticipantTurn turn, int sumForParticipant
    ) {
        var participant = turn.getCampaignParticipant();
        var customer = participant.getCustomer();
        int expected = participant.getTotalBagsPurchased();
        return new CampaignDtos.ParticipantTurnResponse(
                turn.getId(),
                participant.getId(),
                customer.getId(),
                customer.getName(),
                turn.getTurnNumber(),
                turn.getBagCount(),
                turn.getNote(),
                sumForParticipant == expected,
                sumForParticipant - expected
        );
    }
}
