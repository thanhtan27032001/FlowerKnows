package com.gaden.flowerknows.campaign;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class CampaignDtos {

    private CampaignDtos() {
    }

    public record PoolItemRequest(
            @NotNull(message = "productId is required") UUID productId,
            @Min(value = 1, message = "loadedQuantity must be at least 1") int loadedQuantity
    ) {
    }

    public record CreateCampaignRequest(
            @NotBlank(message = "name is required") String name,
            @NotNull(message = "eventDate is required") LocalDate eventDate,
            @NotNull(message = "bagPrice is required")
            @DecimalMin(value = "0", inclusive = false, message = "bagPrice must be positive")
            BigDecimal bagPrice,
            @Min(value = 1, message = "totalBags must be at least 1") int totalBags,
            @NotEmpty(message = "pool must not be empty")
            @Valid List<PoolItemRequest> pool
    ) {
    }

    public record UpdateCampaignRequest(
            @NotBlank(message = "name is required") String name,
            @NotNull(message = "eventDate is required") LocalDate eventDate,
            @Min(value = 1, message = "totalBags must be at least 1") int totalBags,
            /** When non-null, pool is replaced in the same request. */
            @Valid List<PoolItemRequest> pool
    ) {
    }

    public record UpdatePoolRequest(
            @NotEmpty(message = "pool must not be empty")
            @Valid List<PoolItemRequest> pool
    ) {
    }

    public record UpdateParticipantRequest(
            @Min(value = 1, message = "totalBagsPurchased must be at least 1") int totalBagsPurchased
    ) {
    }

    public record PoolItemResponse(
            UUID id,
            UUID productId,
            String productName,
            int loadedQuantity,
            int remainingQuantity
    ) {
    }

    public record ParticipantSummaryResponse(
            UUID id,
            UUID customerId,
            String customerName,
            String customerPhone,
            int totalBagsPurchased,
            BigDecimal prepaidAmount,
            ParticipantStatus status,
            int itemsRecorded,
            List<String> recordedItemNames,
            Instant createdAt
    ) {
    }

    public record ParticipantTokenResponse(
            UUID id,
            UUID productId,
            String productName,
            BigDecimal tokenValue,
            BigDecimal costBasis,
            String status,
            String statusLabel,
            Instant createdAt,
            Instant outcomeAt,
            UUID orderId,
            boolean actionable,
            List<String> exchangedIntoProductNames
    ) {
    }

    public record ClosePreviewResponse(
            UUID campaignId,
            String message,
            List<ReturnItemResponse> productsToReturn
    ) {
    }

    public record ReturnItemResponse(
            UUID productId,
            String productName,
            int quantity
    ) {
    }

    public record CampaignSummaryResponse(
            UUID id,
            String name,
            LocalDate eventDate,
            BigDecimal bagPrice,
            int totalBags,
            CampaignStatus status,
            long bagsSold,
            Instant createdAt
    ) {
    }

    public record CampaignDetailResponse(
            UUID id,
            String name,
            LocalDate eventDate,
            BigDecimal bagPrice,
            int totalBags,
            CampaignStatus status,
            long bagsSold,
            Instant createdAt,
            List<PoolItemResponse> pool,
            List<ParticipantSummaryResponse> participants
    ) {
    }

    public record SuggestPoolRequest(
            @Min(value = 1, message = "totalBags must be at least 1") int totalBags,
            @NotNull(message = "bagPrice is required")
            @DecimalMin(value = "0", inclusive = false, message = "bagPrice must be positive")
            BigDecimal bagPrice,
            @NotNull(message = "expectedTotalCost is required")
            @DecimalMin(value = "0", inclusive = true, message = "expectedTotalCost must be non-negative")
            BigDecimal expectedTotalCost,
            @NotNull(message = "costTolerance is required")
            @DecimalMin(value = "0", inclusive = true, message = "costTolerance must be non-negative")
            BigDecimal costTolerance,
            /** Product IDs that must appear; each is suggested at quantity=1. */
            List<UUID> wishlist
    ) {
    }

    public record SuggestedPoolItemResponse(
            UUID productId,
            String productName,
            int quantity,
            BigDecimal unitCost,
            BigDecimal lineCost
    ) {
    }

    public record SuggestPoolResponse(
            List<SuggestedPoolItemResponse> suggestedPool,
            BigDecimal totalSuggestedCost,
            BigDecimal deviation,
            boolean withinTolerance,
            List<String> warnings
    ) {
    }
}
