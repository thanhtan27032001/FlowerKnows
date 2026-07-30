package com.gaden.flowerknows.campaign;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.product.ProductRepository;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransactionType;
import com.gaden.flowerknows.token.ItemTokenRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class CampaignService {

    private static final String POOL_LOCKED_MESSAGE =
            "Pool sản phẩm đã bị khóa vì đã có món được ghi nhận. Không thể sửa.";
    private static final String DELETE_BLOCKED_MESSAGE =
            "Không thể xóa campaign đã có khách tham gia. Hãy đóng campaign thay vì xóa.";

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
        return toMutationDetail(saved);
    }

    @Transactional
    public CampaignDtos.CampaignDetailResponse updateCampaign(UUID id, CampaignDtos.UpdateCampaignRequest request) {
        // Always load pool: response includes current pool (and optional pool rewrite).
        Campaign campaign = requireOpenCampaignWithPool(id);

        campaign.setName(request.name());
        campaign.setEventDate(request.eventDate());
        campaign.setTotalBags(request.totalBags());

        if (request.pool() != null) {
            if (request.pool().isEmpty()) {
                throw new BusinessException("pool must not be empty");
            }
            applyPoolUpdate(campaign, request.pool());
        }

        return toMutationDetail(campaign);
    }

    @Transactional
    public CampaignDtos.CampaignDetailResponse updatePool(UUID id, CampaignDtos.UpdatePoolRequest request) {
        Campaign campaign = requireOpenCampaignWithPool(id);
        applyPoolUpdate(campaign, request.pool());
        return toMutationDetail(campaign);
    }

    private void applyPoolUpdate(Campaign campaign, List<CampaignDtos.PoolItemRequest> pool) {
        ensurePoolEditable(campaign);

        Set<UUID> seenProductIds = new HashSet<>();
        for (CampaignDtos.PoolItemRequest item : pool) {
            if (!seenProductIds.add(item.productId())) {
                throw new BusinessException("Duplicate product in pool: " + item.productId());
            }
        }

        Map<UUID, CampaignPool> existingByProduct = new HashMap<>();
        for (CampaignPool poolItem : campaign.getPoolItems()) {
            existingByProduct.put(poolItem.getProduct().getId(), poolItem);
        }

        Map<UUID, Integer> desiredByProduct = new HashMap<>();
        for (CampaignDtos.PoolItemRequest item : pool) {
            desiredByProduct.put(item.productId(), item.loadedQuantity());
        }

        // Return stock for removed products
        Iterator<CampaignPool> iterator = campaign.getPoolItems().iterator();
        while (iterator.hasNext()) {
            CampaignPool poolItem = iterator.next();
            UUID productId = poolItem.getProduct().getId();
            if (!desiredByProduct.containsKey(productId)) {
                stockService.applyStockChange(
                        poolItem.getProduct(),
                        poolItem.getLoadedQuantity(),
                        StockTransactionType.CAMPAIGN_RETURN,
                        "Returned from campaign pool edit: " + campaign.getName()
                );
                iterator.remove();
            }
        }

        // Update existing / add new with stock deltas
        for (CampaignDtos.PoolItemRequest item : pool) {
            CampaignPool existing = existingByProduct.get(item.productId());
            if (existing != null && campaign.getPoolItems().contains(existing)) {
                int delta = item.loadedQuantity() - existing.getLoadedQuantity();
                if (delta > 0) {
                    if (delta > existing.getProduct().getStockQuantity()) {
                        throw new BusinessException(
                                "Product %s does not have enough stock (%d available, %d requested)"
                                        .formatted(
                                                existing.getProduct().getName(),
                                                existing.getProduct().getStockQuantity(),
                                                delta
                                        )
                        );
                    }
                    stockService.applyStockChange(
                            existing.getProduct(),
                            -delta,
                            StockTransactionType.CAMPAIGN_LOCK,
                            "Additional lock for campaign pool edit: " + campaign.getName()
                    );
                } else if (delta < 0) {
                    stockService.applyStockChange(
                            existing.getProduct(),
                            -delta,
                            StockTransactionType.CAMPAIGN_RETURN,
                            "Returned from campaign pool edit: " + campaign.getName()
                    );
                }
                existing.setLoadedQuantity(item.loadedQuantity());
                existing.setRemainingQuantity(item.loadedQuantity());
            } else {
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
                        "Locked for campaign pool edit: " + campaign.getName()
                );
            }
        }
    }

    @Transactional
    public void deleteCampaign(UUID id) {
        Campaign campaign = requireOpenCampaignWithPool(id);

        if (participantRepository.countByCampaignId(id) > 0) {
            throw new IllegalStateException(DELETE_BLOCKED_MESSAGE);
        }

        // Zero participants ⇒ no items recorded. Stock is still locked while OPEN.
        for (CampaignPool poolItem : campaign.getPoolItems()) {
            stockService.applyStockChange(
                    poolItem.getProduct(),
                    poolItem.getLoadedQuantity(),
                    StockTransactionType.CAMPAIGN_RETURN,
                    "Returned from campaign delete: " + campaign.getName()
            );
        }

        campaignRepository.delete(campaign);
    }

    @Transactional(readOnly = true)
    public CampaignDtos.ClosePreviewResponse previewClose(UUID id) {
        Campaign campaign = requireOpenCampaignWithPool(id);
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
        Campaign campaign = requireOpenCampaignWithPool(id);

        for (CampaignPool poolItem : campaign.getPoolItems()) {
            int remaining = poolItem.getRemainingQuantity();
            if (remaining > 0) {
                stockService.applyStockChange(
                        poolItem.getProduct(),
                        remaining,
                        StockTransactionType.CAMPAIGN_RETURN,
                        "Returned from campaign close: " + campaign.getName()
                );
                // remaining_quantity intentionally preserved for US-30 reopen.
            }
        }

        campaign.setStatus(CampaignStatus.CLOSED);
        return toMutationDetail(campaign);
    }

    /**
     * US-30: reopen a closed campaign by re-locking preserved pool remaining into stock.
     */
    @Transactional
    public CampaignDtos.CampaignDetailResponse reopenCampaign(UUID id) {
        Campaign campaign = requireCampaignWithPool(id);
        if (campaign.getStatus() != CampaignStatus.CLOSED) {
            throw new IllegalStateException("Only closed campaigns can be reopened");
        }

        List<String> shortages = new ArrayList<>();
        for (CampaignPool poolItem : campaign.getPoolItems()) {
            int remaining = poolItem.getRemainingQuantity();
            if (remaining <= 0) {
                continue;
            }
            Product product = poolItem.getProduct();
            int available = product.getStockQuantity();
            if (remaining > available) {
                shortages.add(
                        "Không đủ hàng để mở lại (SP %s cần %d nhưng kho chỉ còn %d)."
                                .formatted(product.getName(), remaining, available)
                );
            }
        }
        if (!shortages.isEmpty()) {
            throw new IllegalStateException(String.join(" ", shortages));
        }

        for (CampaignPool poolItem : campaign.getPoolItems()) {
            int remaining = poolItem.getRemainingQuantity();
            if (remaining <= 0) {
                continue;
            }
            stockService.applyStockChange(
                    poolItem.getProduct(),
                    -remaining,
                    StockTransactionType.CAMPAIGN_LOCK,
                    "Re-locked for campaign reopen: " + campaign.getName()
            );
        }

        campaign.setStatus(CampaignStatus.OPEN);
        return toMutationDetail(campaign);
    }

    /**
     * US-31: pure planning suggestion — no DB writes.
     */
    @Transactional(readOnly = true)
    public CampaignDtos.SuggestPoolResponse suggestPool(CampaignDtos.SuggestPoolRequest request) {
        List<CampaignDtos.WishlistItemRequest> wishlist =
                request.wishlist() == null ? List.of() : request.wishlist();

        int wishlistQty = wishlist.stream().mapToInt(CampaignDtos.WishlistItemRequest::quantity).sum();
        if (wishlistQty > request.totalBags()) {
            throw new BusinessException(
                    "Wishlist yêu cầu %d túi nhưng tổng chỉ có %d túi"
                            .formatted(wishlistQty, request.totalBags())
            );
        }

        List<String> warnings = new ArrayList<>();
        LinkedHashMap<UUID, Integer> quantities = new LinkedHashMap<>();
        Map<UUID, Product> productsById = new HashMap<>();
        BigDecimal runningCost = BigDecimal.ZERO;
        int bagsFilled = 0;

        Set<UUID> wishlistProductIds = new HashSet<>();
        for (CampaignDtos.WishlistItemRequest item : wishlist) {
            if (!wishlistProductIds.add(item.productId())) {
                throw new BusinessException("Duplicate product in wishlist: " + item.productId());
            }
            Product product = productRepository.findById(item.productId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + item.productId()));
            productsById.put(product.getId(), product);
            quantities.put(product.getId(), item.quantity());

            BigDecimal unitCost = product.getAverageCostPrice();
            if (unitCost == null) {
                unitCost = BigDecimal.ZERO;
                warnings.add(
                        "SP %s chưa có giá vốn, không tính vào tổng chi phí ước tính"
                                .formatted(product.getName())
                );
            }
            runningCost = runningCost.add(unitCost.multiply(BigDecimal.valueOf(item.quantity())));
            bagsFilled += item.quantity();
        }

        List<Product> candidates = productRepository
                .findByStockQuantityGreaterThanAndAverageCostPriceIsNotNull(0)
                .stream()
                .filter(p -> !wishlistProductIds.contains(p.getId()))
                .toList();

        int candidateStock = candidates.stream().mapToInt(Product::getStockQuantity).sum();
        if (wishlistQty + candidateStock < request.totalBags()) {
            warnings.add(
                    "Không đủ tồn kho trong toàn hệ thống để lấp đầy %d túi"
                            .formatted(request.totalBags())
            );
        }

        Map<UUID, Integer> candidateAllocated = new HashMap<>();
        while (bagsFilled < request.totalBags()) {
            int remainingBags = request.totalBags() - bagsFilled;
            BigDecimal remainingBudget = request.expectedTotalCost().subtract(runningCost);
            BigDecimal targetUnitCost = remainingBudget.divide(
                    BigDecimal.valueOf(remainingBags),
                    10,
                    RoundingMode.HALF_UP
            );

            Product best = null;
            BigDecimal bestDistance = null;
            for (Product candidate : candidates) {
                int used = candidateAllocated.getOrDefault(candidate.getId(), 0);
                if (used >= candidate.getStockQuantity()) {
                    continue;
                }
                BigDecimal distance = candidate.getAverageCostPrice().subtract(targetUnitCost).abs();
                if (best == null || distance.compareTo(bestDistance) < 0) {
                    best = candidate;
                    bestDistance = distance;
                }
            }
            if (best == null) {
                break;
            }

            candidateAllocated.merge(best.getId(), 1, Integer::sum);
            quantities.merge(best.getId(), 1, Integer::sum);
            productsById.putIfAbsent(best.getId(), best);
            runningCost = runningCost.add(best.getAverageCostPrice());
            bagsFilled++;
        }

        List<CampaignDtos.SuggestedPoolItemResponse> suggestedPool = new ArrayList<>();
        for (Map.Entry<UUID, Integer> entry : quantities.entrySet()) {
            Product product = productsById.get(entry.getKey());
            BigDecimal unitCost = product.getAverageCostPrice() != null
                    ? product.getAverageCostPrice()
                    : BigDecimal.ZERO;
            BigDecimal lineCost = unitCost.multiply(BigDecimal.valueOf(entry.getValue()));
            suggestedPool.add(new CampaignDtos.SuggestedPoolItemResponse(
                    product.getId(),
                    product.getName(),
                    entry.getValue(),
                    unitCost,
                    lineCost
            ));
        }

        BigDecimal deviation = runningCost.subtract(request.expectedTotalCost());
        boolean withinTolerance = deviation.abs().compareTo(request.costTolerance()) <= 0;

        return new CampaignDtos.SuggestPoolResponse(
                suggestedPool,
                runningCost,
                deviation,
                withinTolerance,
                List.copyOf(warnings)
        );
    }

    /** Open campaign without loading pool (participant bag edits, drafts, etc.). */
    public Campaign requireOpenCampaign(UUID id) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Campaign not found: " + id));
        if (campaign.getStatus() != CampaignStatus.OPEN) {
            throw new IllegalStateException("This campaign is closed, no further entries allowed");
        }
        return campaign;
    }

    /** Open campaign with pool (+ products) loaded. */
    public Campaign requireOpenCampaignWithPool(UUID id) {
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

    private void ensurePoolEditable(Campaign campaign) {
        boolean anyItemRecorded = campaign.getPoolItems().stream()
                .anyMatch(p -> p.getRemainingQuantity() != p.getLoadedQuantity());
        if (anyItemRecorded) {
            throw new IllegalStateException(POOL_LOCKED_MESSAGE);
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

    /**
     * Full detail for GET — includes participant token counts / preview names.
     */
    CampaignDtos.CampaignDetailResponse toDetail(Campaign campaign) {
        return toDetail(campaign, true);
    }

    /**
     * Mutation responses skip token aggregation. Frontend keeps cached participants
     * (names/counts) when merging, since those fields are unchanged by header/pool edits.
     */
    CampaignDtos.CampaignDetailResponse toMutationDetail(Campaign campaign) {
        return toDetail(campaign, false);
    }

    private CampaignDtos.CampaignDetailResponse toDetail(Campaign campaign, boolean includeTokenStats) {
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

        if (!includeTokenStats) {
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
                    List.of()
            );
        }

        List<CampaignParticipant> participantEntities =
                participantRepository.findByCampaignIdWithCustomer(campaign.getId());
        List<UUID> participantIds = participantEntities.stream()
                .map(CampaignParticipant::getId)
                .toList();
        Map<UUID, Integer> itemsRecordedByParticipant = new HashMap<>();
        Map<UUID, List<String>> itemNamesByParticipant = new HashMap<>();
        if (!participantIds.isEmpty()) {
            for (Object[] row : itemTokenRepository.countTokensByParticipantIds(participantIds)) {
                itemsRecordedByParticipant.put((UUID) row[0], ((Number) row[1]).intValue());
            }
            for (ItemTokenRepository.ParticipantItemNameRow row :
                    itemTokenRepository.findTopProductNamesByParticipantIds(participantIds)) {
                List<String> names = itemNamesByParticipant.computeIfAbsent(
                        row.getParticipantId(),
                        ignored -> new ArrayList<>()
                );
                names.add(row.getProductName());
            }
        }

        List<CampaignDtos.ParticipantSummaryResponse> participants = new ArrayList<>();
        for (CampaignParticipant participant : participantEntities) {
            participants.add(toParticipantSummary(
                    participant,
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

    static CampaignDtos.ParticipantSummaryResponse toParticipantSummary(
            CampaignParticipant participant,
            int itemsRecorded,
            List<String> recordedItemNames
    ) {
        return new CampaignDtos.ParticipantSummaryResponse(
                participant.getId(),
                participant.getCustomer().getId(),
                participant.getCustomer().getName(),
                participant.getCustomer().getPhone(),
                participant.getTotalBagsPurchased(),
                participant.getPrepaidAmount(),
                participant.getStatus(),
                itemsRecorded,
                recordedItemNames
        );
    }
}
