package com.gaden.flowerknows.campaign;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
    public List<CampaignDtos.CampaignSummaryResponse> list() {
        return campaignService.listCampaigns();
    }

    @GetMapping("/{id}")
    public CampaignDtos.CampaignDetailResponse get(@PathVariable UUID id) {
        return campaignService.getCampaign(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CampaignDtos.CampaignDetailResponse create(@Valid @RequestBody CampaignDtos.CreateCampaignRequest request) {
        return campaignService.createCampaign(request);
    }

    @GetMapping("/{id}/close-preview")
    public CampaignDtos.ClosePreviewResponse closePreview(@PathVariable UUID id) {
        return campaignService.previewClose(id);
    }

    @PostMapping("/{id}/close")
    public CampaignDtos.CampaignDetailResponse close(@PathVariable UUID id) {
        return campaignService.closeCampaign(id);
    }

    @PostMapping("/{id}/participants")
    @ResponseStatus(HttpStatus.CREATED)
    public CampaignDtos.ParticipantSummaryResponse addParticipant(
            @PathVariable UUID id,
            @Valid @RequestBody ParticipantService.RecordParticipantRequest request
    ) {
        return participantService.recordParticipant(id, request);
    }

    @PostMapping("/{id}/tokens")
    @ResponseStatus(HttpStatus.CREATED)
    public List<ParticipantService.TokenRecordResponse> recordTokens(
            @PathVariable UUID id,
            @Valid @RequestBody ParticipantService.RecordItemsRequest request
    ) {
        return participantService.recordItems(id, request);
    }
}
