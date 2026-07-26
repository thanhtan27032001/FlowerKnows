package com.gaden.flowerknows.campaign;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/campaigns")
public class CampaignController {

    private final CampaignService campaignService;
    private final ParticipantService participantService;

    public CampaignController(CampaignService campaignService, ParticipantService participantService) {
        this.campaignService = campaignService;
        this.participantService = participantService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<CampaignDtos.CampaignSummaryResponse> list() {
        return campaignService.listCampaigns();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public CampaignDtos.CampaignDetailResponse get(@PathVariable UUID id) {
        return campaignService.getCampaign(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('OWNER')")
    public CampaignDtos.CampaignDetailResponse create(@Valid @RequestBody CampaignDtos.CreateCampaignRequest request) {
        return campaignService.createCampaign(request);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public CampaignDtos.CampaignDetailResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody CampaignDtos.UpdateCampaignRequest request
    ) {
        return campaignService.updateCampaign(id, request);
    }

    @PutMapping("/{id}/pool")
    @PreAuthorize("hasRole('OWNER')")
    public CampaignDtos.CampaignDetailResponse updatePool(
            @PathVariable UUID id,
            @Valid @RequestBody CampaignDtos.UpdatePoolRequest request
    ) {
        return campaignService.updatePool(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('OWNER')")
    public void delete(@PathVariable UUID id) {
        campaignService.deleteCampaign(id);
    }

    @GetMapping("/{id}/close-preview")
    @PreAuthorize("hasRole('OWNER')")
    public CampaignDtos.ClosePreviewResponse closePreview(@PathVariable UUID id) {
        return campaignService.previewClose(id);
    }

    @PostMapping("/{id}/close")
    @PreAuthorize("hasRole('OWNER')")
    public CampaignDtos.CampaignDetailResponse close(@PathVariable UUID id) {
        return campaignService.closeCampaign(id);
    }

    @PostMapping("/{id}/participants")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public CampaignDtos.ParticipantSummaryResponse addParticipant(
            @PathVariable UUID id,
            @Valid @RequestBody ParticipantService.RecordParticipantRequest request
    ) {
        return participantService.recordParticipant(id, request);
    }

    @PostMapping("/{id}/participants/draft")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public CampaignDtos.ParticipantSummaryResponse addDraftParticipant(
            @PathVariable UUID id,
            @Valid @RequestBody ParticipantService.RecordParticipantRequest request
    ) {
        return participantService.createDraft(id, request);
    }

    @PatchMapping("/{id}/participants/{participantId}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public CampaignDtos.ParticipantSummaryResponse updateParticipant(
            @PathVariable UUID id,
            @PathVariable UUID participantId,
            @Valid @RequestBody CampaignDtos.UpdateParticipantRequest request
    ) {
        return participantService.updateParticipant(id, participantId, request);
    }

    @PostMapping("/{id}/participants/{participantId}/confirm")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public CampaignDtos.ParticipantSummaryResponse confirmDraft(
            @PathVariable UUID id,
            @PathVariable UUID participantId
    ) {
        return participantService.confirmDraft(id, participantId);
    }

    @DeleteMapping("/{id}/participants/{participantId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public void deleteParticipant(
            @PathVariable UUID id,
            @PathVariable UUID participantId
    ) {
        participantService.deleteParticipant(id, participantId);
    }

    @DeleteMapping("/{id}/participants/{participantId}/draft")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public void deleteDraft(
            @PathVariable UUID id,
            @PathVariable UUID participantId
    ) {
        participantService.deleteParticipant(id, participantId);
    }

    @PostMapping("/{id}/tokens")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<ParticipantService.TokenRecordResponse> recordTokens(
            @PathVariable UUID id,
            @Valid @RequestBody ParticipantService.RecordItemsRequest request
    ) {
        return participantService.recordItems(id, request);
    }

    @GetMapping("/{id}/participants/{participantId}/tokens")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<CampaignDtos.ParticipantTokenResponse> listParticipantTokens(
            @PathVariable UUID id,
            @PathVariable UUID participantId
    ) {
        return participantService.listParticipantTokens(id, participantId);
    }
}
