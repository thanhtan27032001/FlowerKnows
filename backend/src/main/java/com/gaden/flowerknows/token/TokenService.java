package com.gaden.flowerknows.token;

import com.gaden.flowerknows.campaign.Campaign;
import com.gaden.flowerknows.campaign.CampaignParticipant;
import com.gaden.flowerknows.campaign.CampaignParticipantRepository;
import com.gaden.flowerknows.campaign.CampaignPool;
import com.gaden.flowerknows.campaign.CampaignRepository;
import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransactionType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
public class TokenService {

    public static final int OVERDUE_DAYS = 30;

    private final ItemTokenRepository itemTokenRepository;
    private final CampaignParticipantRepository participantRepository;
    private final CampaignRepository campaignRepository;
    private final StockService stockService;

    public TokenService(
            ItemTokenRepository itemTokenRepository,
            CampaignParticipantRepository participantRepository,
            CampaignRepository campaignRepository,
            StockService stockService
    ) {
        this.itemTokenRepository = itemTokenRepository;
        this.participantRepository = participantRepository;
        this.campaignRepository = campaignRepository;
        this.stockService = stockService;
    }

    @Transactional(readOnly = true)
    public List<TokenDtos.OverdueTokenResponse> listOverdueTokens() {
        Instant cutoff = Instant.now().minus(OVERDUE_DAYS, ChronoUnit.DAYS);
        return itemTokenRepository
                .findByStatusAndCreatedAtBeforeOrderByCreatedAtAsc(TokenStatus.HOLDING, cutoff)
                .stream()
                .map(this::toOverdueResponse)
                .sorted((a, b) -> Long.compare(b.daysHeld(), a.daysHeld()))
                .toList();
    }

    @Transactional
    public TokenDtos.CancelTokenResponse cancelToken(UUID tokenId) {
        ItemToken token = itemTokenRepository.findById(tokenId)
                .orElseThrow(() -> new ResourceNotFoundException("Token not found: " + tokenId));

        token.cancel();

        stockService.applyStockChange(
                token.getProduct(),
                1,
                StockTransactionType.TOKEN_CANCEL_RETURN,
                "Returned from token cancellation; revenue recognized: " + token.getTokenValue()
        );

        return new TokenDtos.CancelTokenResponse(
                token.getId(),
                token.getStatus().name(),
                token.getTokenValue(),
                token.getCancelledAt(),
                "Cancelling this token returned the product to stock and recognized %s as revenue"
                        .formatted(token.getTokenValue())
        );
    }

    /**
     * US-28: permanently delete a mistaken US-04 recording and return 1 unit to campaign_pool.
     * Does not touch product.stock_quantity / stock_transaction.
     */
    @Transactional
    public void deleteRecordedCampaignToken(UUID tokenId) {
        ItemToken token = itemTokenRepository.findById(tokenId)
                .orElseThrow(() -> new ResourceNotFoundException("Token not found: " + tokenId));

        if (token.getStatus() != TokenStatus.HOLDING) {
            throw new IllegalStateException(
                    "Only HOLDING tokens can be deleted (token %s has status %s)"
                            .formatted(tokenId, token.getStatus())
            );
        }
        if (token.getSourceType() != SourceType.CAMPAIGN) {
            throw new BusinessException(
                    "Only tokens recorded from a campaign bag can be deleted; use Item Exchange for exchange tokens"
            );
        }

        CampaignParticipant participant = participantRepository.findById(token.getSourceId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Campaign participant not found for token source: " + token.getSourceId()
                ));

        Campaign campaign = campaignRepository.findByIdWithPool(participant.getCampaign().getId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Campaign not found: " + participant.getCampaign().getId()
                ));

        CampaignPool poolItem = campaign.getPoolItems().stream()
                .filter(p -> p.getProduct().getId().equals(token.getProduct().getId()))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        "Product is not in this campaign pool"
                ));

        poolItem.setRemainingQuantity(poolItem.getRemainingQuantity() + 1);
        itemTokenRepository.delete(token);
    }

    private TokenDtos.OverdueTokenResponse toOverdueResponse(ItemToken token) {
        long daysHeld = ChronoUnit.DAYS.between(token.getCreatedAt(), Instant.now());
        return new TokenDtos.OverdueTokenResponse(
                token.getId(),
                token.getCustomer().getId(),
                token.getCustomer().getName(),
                token.getCustomer().getPhone(),
                token.getProduct().getId(),
                token.getProduct().getName(),
                token.getCreatedAt(),
                daysHeld,
                token.getTokenValue(),
                daysHeld >= OVERDUE_DAYS
        );
    }
}
