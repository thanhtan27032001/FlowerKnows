package com.gaden.flowerknows.campaign;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.product.ProductRepository;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransactionType;
import com.gaden.flowerknows.token.ItemToken;
import com.gaden.flowerknows.token.ItemTokenRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CampaignService {

    private final CampaignRepository campaignRepository;
    private final CampaignParticipantRepository participantRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;
    private final ItemTokenRepository itemTokenRepository;

    public CampaignService(
            CampaignRepository campaignRepository,
            CampaignParticipantRepository participantRepository,
            ProductRepository productRepository,
            StockService stockService,
            ItemTokenRepository itemTokenRepository
    ) {
        this.campaignRepository = campaignRepository;
        this.participantRepository = participantRepository;
        this.productRepository = productRepository;
        this.stockService = stockService;
        this.itemTokenRepository = itemTokenRepository;
    }

    @Transactional(readOnly = true)
    public List<CampaignDtos.CampaignSummaryResponse> listCampaigns() {
        return campaignRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public CampaignDtos.CampaignDetailResponse getCampaign(UUID id) {
        Campaign campaign = requireCampaignWithPool(id);
        // Touch participants for lazy load within transaction
        campaign.getParticipants().size();
        return toDetail(campaign);
    }

    @Transactional
    public CampaignDtos.CampaignDetailResponse createCampaign(CampaignDtos.CreateCampaignRequest request) {
        int poolSum = request.pool().stream().mapToInt(CampaignDtos.PoolItemRequest::loadedQuantity).sum();
        if (poolSum != request.totalBags()) {
            throw new BusinessException(
                    "total_bags (%d) must equal the sum of loaded_quantity (%d)"
                            .formatted(request.totalBags(), poolSum)
            );
        }

        Campaign campaign = new Campaign(
                request.name(),
                request.eventDate(),
                request.bagPrice(),
                request.totalBags()
        );

        for (CampaignDtos.PoolItemRequest item : request.pool()) {
            Product product = productRepository.findById(item.productId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + item.productId()));

            if (item.loadedQuantity() > product.getStockQuantity()) {
                throw new BusinessException(
                        "Product %s does not have enough stock (%d available, %d requested)"
                                .formatted(product.getName(), product.getStockQuantity(), item.loadedQuantity())
                );
            }

            CampaignPool poolItem = new CampaignPool(product, item.loadedQuantity());
            campaign.addPoolItem(poolItem);

            stockService.applyStockChange(
                    product,
                    -item.loadedQuantity(),
                    StockTransactionType.CAMPAIGN_LOCK,
                    "Locked for campaign: " + request.name()
            );
        }

        Campaign saved = campaignRepository.save(campaign);
        return toDetail(saved);
    }

    @Transactional(readOnly = true)
    public CampaignDtos.ClosePreviewResponse previewClose(UUID id) {
        Campaign campaign = requireOpenCampaign(id);
        List<CampaignDtos.ReturnItemResponse> toReturn = campaign.getPoolItems().stream()
                .filter(p -> p.getRemainingQuantity() > 0)
                .map(p -> new CampaignDtos.ReturnItemResponse(
                        p.getProduct().getId(),
                        p.getProduct().getName(),
                        p.getRemainingQuantity()
                ))
                .toList();

        int total = toReturn.stream().mapToInt(CampaignDtos.ReturnItemResponse::quantity).sum();
        String message = total > 0
                ? "%d products remain unsold and will be returned to general stock. Confirm close?".formatted(total)
                : "No unsold products remain. Confirm close?";

        return new CampaignDtos.ClosePreviewResponse(campaign.getId(), message, toReturn);
    }

    @Transactional
    public CampaignDtos.CampaignDetailResponse closeCampaign(UUID id) {
        Campaign campaign = requireOpenCampaign(id);

        for (CampaignPool poolItem : campaign.getPoolItems()) {
            int remaining = poolItem.getRemainingQuantity();
            if (remaining > 0) {
                stockService.applyStockChange(
                        poolItem.getProduct(),
                        remaining,
                        StockTransactionType.CAMPAIGN_RETURN,
                        "Returned from campaign close: " + campaign.getName()
                );
                poolItem.setRemainingQuantity(0);
            }
        }

        campaign.setStatus(CampaignStatus.CLOSED);
        return toDetail(campaign);
    }

    public Campaign requireOpenCampaign(UUID id) {
        Campaign campaign = requireCampaignWithPool(id);
        if (campaign.getStatus() != CampaignStatus.OPEN) {
            throw new IllegalStateException("This campaign is closed, no further entries allowed");
        }
        return campaign;
    }

    public Campaign requireCampaignWithPool(UUID id) {
        return campaignRepository.findByIdWithPool(id)
                .orElseThrow(() -> new ResourceNotFoundException("Campaign not found: " + id));
    }

    public void autoCloseIfPoolEmpty(Campaign campaign) {
        boolean allZero = campaign.getPoolItems().stream()
                .allMatch(p -> p.getRemainingQuantity() <= 0);
        if (allZero && campaign.getStatus() == CampaignStatus.OPEN) {
            campaign.setStatus(CampaignStatus.CLOSED);
        }
    }

    private CampaignDtos.CampaignSummaryResponse toSummary(Campaign campaign) {
        long bagsSold = participantRepository.sumBagsPurchasedByCampaign(campaign.getId());
        return new CampaignDtos.CampaignSummaryResponse(
                campaign.getId(),
                campaign.getName(),
                campaign.getEventDate(),
                campaign.getBagPrice(),
                campaign.getTotalBags(),
                campaign.getStatus(),
                bagsSold,
                campaign.getCreatedAt()
        );
    }

    private CampaignDtos.CampaignDetailResponse toDetail(Campaign campaign) {
        long bagsSold = participantRepository.sumBagsPurchasedByCampaign(campaign.getId());

        List<CampaignDtos.PoolItemResponse> pool = campaign.getPoolItems().stream()
                .map(p -> new CampaignDtos.PoolItemResponse(
                        p.getId(),
                        p.getProduct().getId(),
                        p.getProduct().getName(),
                        p.getLoadedQuantity(),
                        p.getRemainingQuantity()
                ))
                .toList();

        List<UUID> participantIds = campaign.getParticipants().stream()
                .map(CampaignParticipant::getId)
                .toList();
        Map<UUID, Integer> itemsRecordedByParticipant = new HashMap<>();
        Map<UUID, List<String>> itemNamesByParticipant = new HashMap<>();
        if (!participantIds.isEmpty()) {
            for (Object[] row : itemTokenRepository.countTokensByParticipantIds(participantIds)) {
                itemsRecordedByParticipant.put((UUID) row[0], ((Number) row[1]).intValue());
            }
            for (ItemToken token : itemTokenRepository.findByParticipantIdsWithProduct(participantIds)) {
                List<String> names = itemNamesByParticipant.computeIfAbsent(
                        token.getSourceId(),
                        ignored -> new ArrayList<>()
                );
                if (names.size() < 3) {
                    names.add(token.getProduct().getName());
                }
            }
        }

        List<CampaignDtos.ParticipantSummaryResponse> participants = new ArrayList<>();
        for (CampaignParticipant participant : campaign.getParticipants()) {
            participants.add(new CampaignDtos.ParticipantSummaryResponse(
                    participant.getId(),
                    participant.getCustomer().getId(),
                    participant.getCustomer().getName(),
                    participant.getCustomer().getPhone(),
                    participant.getTotalBagsPurchased(),
                    participant.getPrepaidAmount(),
                    itemsRecordedByParticipant.getOrDefault(participant.getId(), 0),
                    itemNamesByParticipant.getOrDefault(participant.getId(), List.of())
            ));
        }

        return new CampaignDtos.CampaignDetailResponse(
                campaign.getId(),
                campaign.getName(),
                campaign.getEventDate(),
                campaign.getBagPrice(),
                campaign.getTotalBags(),
                campaign.getStatus(),
                bagsSold,
                campaign.getCreatedAt(),
                pool,
                participants
        );
    }
}
