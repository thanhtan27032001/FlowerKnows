package com.gaden.flowerknows.campaign;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

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
            /** May be empty — pool can be filled in later (US-01 v4.4). */
            @NotNull(message = "pool is required")
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

    public record UpdateParticipantTurnNoteRequest(
            @Size(max = 500, message = "note must be at most 500 characters") String note
    ) {
    }

    public record CreateParticipantTurnRequest(
            @NotNull(message = "campaignParticipantId is required") UUID campaignParticipantId,
            @Min(value = 1, message = "bagCount must be at least 1") int bagCount,
            @Size(max = 500, message = "note must be at most 500 characters") String note
    ) {
    }

    public record UpdateParticipantTurnBagCountRequest(
            @Min(value = 1, message = "bagCount must be at least 1") int bagCount
    ) {
    }

    public record ParticipantTurnResponse(
            UUID id,
            UUID campaignParticipantId,
            UUID customerId,
            String customerName,
            int turnNumber,
            int bagCount,
            String note,
            /** Added in v5.4 — Σ bag_count across this participant's turns equals
             * total_bags_purchased. Informational only; never blocks a save. */
            boolean isBalanced,
            /** Added in v5.4 — Σ bag_count minus total_bags_purchased (can be negative). */
            int difference
    ) {
    }

    /** Added in v5.4 — returned by DELETE /api/participant-turns/{id} since the row itself
     * is gone; reports the affected participant's post-delete balance. */
    public record ParticipantTurnBalanceResponse(
            UUID campaignParticipantId,
            boolean isBalanced,
            int difference
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
            /** Sum of campaign_pool.loaded_quantity — for pool-completeness UI (US-01 AC#5). */
            int poolQuantityTotal,
            CampaignStatus status,
            long bagsSold,
            Instant createdAt,
            List<PoolItemResponse> pool,
            List<ParticipantSummaryResponse> participants,
            /** Sum of loaded_quantity * product.average_cost_price, skipping null-cost products (US-01 AC#5a). */
            BigDecimal totalPoolCostValue,
            /** Count of pool rows skipped from totalPoolCostValue due to a null average_cost_price. */
            int excludedFromCostCount,
            /** Sum of total_bags_purchased * bag_price for CONFIRMED participants — same figure as US-11's prepaid_amount total (AC#5a). */
            BigDecimal totalBagsSoldValue,
            /** Added in v5.6 — per-row messages for pool edit rows rejected because the row already
             * had items recorded from it (US-24 AC#4). Non-blocking: other rows in the same
             * submission are still applied. Empty outside a pool-edit mutation. */
            List<String> poolWarnings
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
