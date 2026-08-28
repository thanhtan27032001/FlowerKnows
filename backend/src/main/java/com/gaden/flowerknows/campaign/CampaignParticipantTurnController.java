package com.gaden.flowerknows.campaign;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
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
}
