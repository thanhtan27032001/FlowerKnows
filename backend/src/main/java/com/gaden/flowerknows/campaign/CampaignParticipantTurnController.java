package com.gaden.flowerknows.campaign;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/participant-turns")
public class CampaignParticipantTurnController {

    private final CampaignParticipantTurnService participantTurnService;

    public CampaignParticipantTurnController(CampaignParticipantTurnService participantTurnService) {
        this.participantTurnService = participantTurnService;
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public CampaignDtos.ParticipantTurnResponse updateNote(
            @PathVariable UUID id,
            @Valid @RequestBody CampaignDtos.UpdateParticipantTurnNoteRequest request
    ) {
        return participantTurnService.updateNote(id, request.note());
    }

    /** US-38 AC #11 — bag_count is an Owner-only structural edit, kept on its own endpoint
     * (rather than folded into updateNote above) so Staff's note-edit access can't be used
     * to smuggle in a bag_count change. */
    @PatchMapping("/{id}/bag-count")
    @PreAuthorize("hasRole('OWNER')")
    public CampaignDtos.ParticipantTurnResponse updateBagCount(
            @PathVariable UUID id,
            @Valid @RequestBody CampaignDtos.UpdateParticipantTurnBagCountRequest request
    ) {
        return participantTurnService.updateBagCount(id, request.bagCount());
    }

    /** Added in v5.4 — the delete always succeeds now, so it returns 200 with the affected
     * participant's post-delete balance instead of a bare 204. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public CampaignDtos.ParticipantTurnBalanceResponse delete(@PathVariable UUID id) {
        return participantTurnService.deleteTurn(id);
    }
}
