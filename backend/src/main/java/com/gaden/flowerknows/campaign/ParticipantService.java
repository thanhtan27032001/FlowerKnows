package com.gaden.flowerknows.campaign;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.customer.Customer;
import com.gaden.flowerknows.customer.CustomerActionStatus;
import com.gaden.flowerknows.customer.CustomerDtos;
import com.gaden.flowerknows.customer.CustomerService;
import com.gaden.flowerknows.exchange.ExchangeTransaction;
import com.gaden.flowerknows.exchange.ExchangeTransactionRepository;
import com.gaden.flowerknows.exchange.ExchangedIntoProductNames;
import com.gaden.flowerknows.order.Order;
import com.gaden.flowerknows.order.OrderRepository;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.token.ItemToken;
import com.gaden.flowerknows.token.ItemTokenRepository;
import com.gaden.flowerknows.token.SourceType;
import com.gaden.flowerknows.token.TokenStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ParticipantService {

    private static final DateTimeFormatter OUTCOME_DATE =
            DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(ZoneOffset.UTC);

    private final CampaignService campaignService;
    private final CampaignParticipantRepository participantRepository;
    private final CustomerService customerService;
    private final ItemTokenRepository itemTokenRepository;
    private final ExchangeTransactionRepository exchangeRepository;
    private final OrderRepository orderRepository;

    public ParticipantService(
            CampaignService campaignService,
            CampaignParticipantRepository participantRepository,
            CustomerService customerService,
            ItemTokenRepository itemTokenRepository,
            ExchangeTransactionRepository exchangeRepository,
            OrderRepository orderRepository
    ) {
        this.campaignService = campaignService;
        this.participantRepository = participantRepository;
        this.customerService = customerService;
        this.itemTokenRepository = itemTokenRepository;
        this.exchangeRepository = exchangeRepository;
        this.orderRepository = orderRepository;
    }

    @Transactional
    public CampaignDtos.ParticipantSummaryResponse recordParticipant(
            UUID campaignId,
            RecordParticipantRequest request
    ) {
        Campaign campaign = campaignService.requireOpenCampaign(campaignId);

        Customer customer = resolveCustomer(request);

        long bagsSold = participantRepository.sumBagsPurchasedByCampaign(campaignId);
        long remaining = campaign.getTotalBags() - bagsSold;
        if (request.bagsPurchased() > remaining) {
            throw new BusinessException("Only %d bags remaining".formatted(remaining));
        }

        BigDecimal amount = campaign.getBagPrice().multiply(BigDecimal.valueOf(request.bagsPurchased()));

        CampaignParticipant participant = participantRepository
                .findByCampaignIdAndCustomerId(campaignId, customer.getId())
                .orElse(null);
        boolean isNew = participant == null;

        if (isNew) {
            participant = new CampaignParticipant(
                    campaign,
                    customer,
                    request.bagsPurchased(),
                    amount,
                    ParticipantStatus.CONFIRMED
            );
            campaign.getParticipants().add(participant);
            // US-18 / US-03 AC #7: new campaign engagement resets pre-order workflow
            customer.setActionStatus(CustomerActionStatus.UNDETERMINED);
        } else if (participant.getStatus() == ParticipantStatus.DRAFT) {
            throw new BusinessException(
                    "Customer already has a draft participation in this campaign — confirm or cancel the draft first"
            );
        } else {
            participant.addBags(request.bagsPurchased(), amount);
        }

        CampaignParticipant saved = participantRepository.save(participant);
        if (isNew) {
            return toSummaryResponse(saved, 0, List.of());
        }
        int itemsRecorded = (int) itemTokenRepository.countBySourceTypeAndSourceId(
                SourceType.CAMPAIGN, saved.getId()
        );
        return toSummaryResponse(saved, itemsRecorded, List.of());
    }

    @Transactional
    public CampaignDtos.ParticipantSummaryResponse createDraft(
            UUID campaignId,
            RecordParticipantRequest request
    ) {
        Campaign campaign = campaignService.requireOpenCampaign(campaignId);
        Customer customer = resolveCustomer(request);

        participantRepository.findByCampaignIdAndCustomerId(campaignId, customer.getId())
                .ifPresent(existing -> {
                    throw new BusinessException(
                            "Customer is already a participant in this campaign"
                    );
                });

        CampaignParticipant draft = new CampaignParticipant(
                campaign,
                customer,
                request.bagsPurchased(),
                BigDecimal.ZERO,
                ParticipantStatus.DRAFT
        );
        campaign.getParticipants().add(draft);
        customer.setActionStatus(CustomerActionStatus.UNDETERMINED);

        return toSummaryResponse(participantRepository.save(draft), 0, List.of());
    }

    @Transactional
    public CampaignDtos.ParticipantSummaryResponse confirmDraft(UUID campaignId, UUID participantId) {
        Campaign campaign = campaignService.requireOpenCampaign(campaignId);
        CampaignParticipant participant = requireParticipantInCampaign(campaignId, participantId);

        if (participant.getStatus() != ParticipantStatus.DRAFT) {
            throw new IllegalStateException("Only draft participants can be confirmed");
        }

        long bagsSold = participantRepository.sumBagsPurchasedByCampaign(campaignId);
        long remaining = campaign.getTotalBags() - bagsSold;
        if (participant.getTotalBagsPurchased() > remaining) {
            throw new BusinessException("Only %d bags remaining".formatted(remaining));
        }

        participant.setStatus(ParticipantStatus.CONFIRMED);
        participant.setPrepaidAmount(
                campaign.getBagPrice().multiply(BigDecimal.valueOf(participant.getTotalBagsPurchased()))
        );

        return toSummaryResponse(participant, 0, List.of());
    }

    @Transactional
    public void deleteParticipant(UUID campaignId, UUID participantId) {
        campaignService.requireOpenCampaign(campaignId);
        CampaignParticipant participant = requireParticipantInCampaign(campaignId, participantId);

        long tokensRecorded = itemTokenRepository.countBySourceTypeAndSourceId(
                SourceType.CAMPAIGN, participant.getId()
        );
        if (tokensRecorded > 0) {
            throw new IllegalStateException(
                    "Không thể xóa người tham gia đã có món được ghi nhận."
            );
        }

        participant.getCampaign().getParticipants().remove(participant);
        participantRepository.delete(participant);
    }

    @Transactional
    public CampaignDtos.ParticipantSummaryResponse updateParticipant(
            UUID campaignId,
            UUID participantId,
            CampaignDtos.UpdateParticipantRequest request
    ) {
        Campaign campaign = campaignService.requireOpenCampaign(campaignId);
        CampaignParticipant participant = requireParticipantInCampaign(campaignId, participantId);

        long tokensRecorded = itemTokenRepository.countBySourceTypeAndSourceId(
                SourceType.CAMPAIGN, participant.getId()
        );
        if (request.totalBagsPurchased() < tokensRecorded) {
            throw new BusinessException(
                    "Không thể giảm xuống dưới số túi đã khui (%d túi).".formatted(tokensRecorded)
            );
        }

        if (participant.getStatus() == ParticipantStatus.CONFIRMED) {
            long bagsSoldExcludingSelf = participantRepository.sumBagsPurchasedByCampaign(campaignId)
                    - participant.getTotalBagsPurchased();
            long remaining = campaign.getTotalBags() - bagsSoldExcludingSelf;
            if (request.totalBagsPurchased() > remaining) {
                throw new BusinessException("Only %d bags remaining".formatted(remaining));
            }
            participant.setTotalBagsPurchased(request.totalBagsPurchased());
            participant.setPrepaidAmount(
                    campaign.getBagPrice().multiply(BigDecimal.valueOf(request.totalBagsPurchased()))
            );
        } else {
            participant.setTotalBagsPurchased(request.totalBagsPurchased());
            participant.setPrepaidAmount(BigDecimal.ZERO);
        }

        return toSummaryResponse(participant, (int) tokensRecorded, List.of());
    }

    @Transactional
    public List<TokenRecordResponse> recordItems(UUID campaignId, RecordItemsRequest request) {
        Campaign campaign = campaignService.requireOpenCampaignWithPool(campaignId);

        CampaignParticipant participant = participantRepository
                .findByCampaignIdAndCustomerId(campaignId, request.customerId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Customer is not a participant in this campaign"
                ));

        if (participant.getStatus() != ParticipantStatus.CONFIRMED) {
            throw new BusinessException(
                    "Items can only be recorded for confirmed participants"
            );
        }

        long alreadyRecorded = itemTokenRepository.countBySourceTypeAndSourceId(
                SourceType.CAMPAIGN, participant.getId()
        );
        int remainingBags = participant.getTotalBagsPurchased() - (int) alreadyRecorded;
        if (request.quantity() > remainingBags) {
            throw new BusinessException(
                    "The customer has already recorded all purchased bags (%d/%d)"
                            .formatted(alreadyRecorded, participant.getTotalBagsPurchased())
            );
        }

        CampaignPool poolItem = campaign.getPoolItems().stream()
                .filter(p -> p.getProduct().getId().equals(request.productId()))
                .findFirst()
                .orElseThrow(() -> new BusinessException("Product is not in this campaign pool"));

        if (request.quantity() > poolItem.getRemainingQuantity()) {
            throw new BusinessException(
                    "Only %d of this product remaining in the pool".formatted(poolItem.getRemainingQuantity())
            );
        }

        Product product = poolItem.getProduct();
        List<ItemToken> tokens = new ArrayList<>();
        for (int i = 0; i < request.quantity(); i++) {
            tokens.add(new ItemToken(
                    product,
                    participant.getCustomer(),
                    campaign.getBagPrice(),
                    product.getAverageCostPrice(),
                    SourceType.CAMPAIGN,
                    participant.getId()
            ));
        }

        poolItem.setRemainingQuantity(poolItem.getRemainingQuantity() - request.quantity());
        List<ItemToken> saved = itemTokenRepository.saveAll(tokens);

        return saved.stream()
                .map(t -> new TokenRecordResponse(
                        t.getId(),
                        t.getProduct().getId(),
                        t.getProduct().getName(),
                        t.getCustomer().getId(),
                        t.getTokenValue(),
                        t.getStatus().name(),
                        t.getSourceType().name(),
                        t.getSourceId(),
                        t.getCreatedAt()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CampaignDtos.ParticipantTokenResponse> listParticipantTokens(
            UUID campaignId,
            UUID participantId
    ) {
        CampaignParticipant participant = requireParticipantInCampaign(campaignId, participantId);

        List<ItemToken> tokens = itemTokenRepository
                .findBySourceTypeAndSourceIdWithProduct(SourceType.CAMPAIGN, participantId);

        List<UUID> nonHoldingIds = tokens.stream()
                .filter(t -> t.getStatus() != TokenStatus.HOLDING)
                .map(ItemToken::getId)
                .toList();

        Map<UUID, ExchangeTransaction> exchangeByTokenId = new HashMap<>();
        Map<UUID, Order> orderByTokenId = new HashMap<>();
        Map<UUID, List<String>> exchangedIntoByTokenId = Map.of();

        if (!nonHoldingIds.isEmpty()) {
            for (Object[] row : exchangeRepository.findExchangesMappedByTokenInIds(nonHoldingIds)) {
                exchangeByTokenId.put((UUID) row[0], (ExchangeTransaction) row[1]);
            }
            for (Object[] row : orderRepository.findOrdersMappedByTokenIds(nonHoldingIds)) {
                orderByTokenId.put((UUID) row[0], (Order) row[1]);
            }

            List<UUID> exchangedIds = tokens.stream()
                    .filter(t -> t.getStatus() == TokenStatus.EXCHANGED)
                    .map(ItemToken::getId)
                    .toList();
            exchangedIntoByTokenId = ExchangedIntoProductNames.load(exchangeRepository, exchangedIds);
        }

        Map<UUID, List<String>> exchangedIntoNames = exchangedIntoByTokenId;
        return tokens.stream()
                .map(token -> toParticipantTokenResponse(
                        token,
                        exchangeByTokenId.get(token.getId()),
                        orderByTokenId.get(token.getId()),
                        ExchangedIntoProductNames.forToken(exchangedIntoNames, token.getId())
                ))
                .collect(Collectors.toList());
    }

    private CampaignParticipant requireParticipantInCampaign(UUID campaignId, UUID participantId) {
        CampaignParticipant participant = participantRepository.findByIdWithCampaign(participantId)
                .orElseThrow(() -> new ResourceNotFoundException("Participant not found: " + participantId));

        if (!participant.getCampaign().getId().equals(campaignId)) {
            throw new ResourceNotFoundException("Participant not found in this campaign");
        }
        return participant;
    }

    private CampaignDtos.ParticipantSummaryResponse toSummaryResponse(CampaignParticipant participant) {
        int itemsRecorded = (int) itemTokenRepository.countBySourceTypeAndSourceId(
                SourceType.CAMPAIGN, participant.getId()
        );
        List<String> recordedItemNames = itemTokenRepository
                .findBySourceTypeAndSourceIdOrderByCreatedAtDesc(SourceType.CAMPAIGN, participant.getId())
                .stream()
                .limit(3)
                .map(t -> t.getProduct().getName())
                .toList();
        return toSummaryResponse(participant, itemsRecorded, recordedItemNames);
    }

    private CampaignDtos.ParticipantSummaryResponse toSummaryResponse(
            CampaignParticipant participant,
            int itemsRecorded,
            List<String> recordedItemNames
    ) {
        return CampaignService.toParticipantSummary(participant, itemsRecorded, recordedItemNames);
    }

    private CampaignDtos.ParticipantTokenResponse toParticipantTokenResponse(
            ItemToken token,
            ExchangeTransaction exchange,
            Order order,
            List<String> exchangedIntoProductNames
    ) {
        boolean actionable = token.getStatus() == TokenStatus.HOLDING;
        Instant outcomeAt = null;
        UUID orderId = null;
        String statusLabel = switch (token.getStatus()) {
            case HOLDING -> "Holding";
            case EXCHANGED -> {
                if (exchange != null) {
                    outcomeAt = exchange.getCreatedAt();
                    yield "Exchanged on " + OUTCOME_DATE.format(outcomeAt);
                }
                yield "Exchanged";
            }
            case CASHED_OUT -> {
                if (exchange != null) {
                    outcomeAt = exchange.getCreatedAt();
                    yield "Cashed out on " + OUTCOME_DATE.format(outcomeAt);
                }
                yield "Cashed out";
            }
            case ORDERED -> {
                if (order != null) {
                    orderId = order.getId();
                    outcomeAt = order.getCreatedAt();
                    yield "Included in order " + shortId(orderId);
                }
                yield "Ordered";
            }
            case CANCELLED -> {
                outcomeAt = token.getCancelledAt();
                if (outcomeAt != null) {
                    yield "Cancelled on " + OUTCOME_DATE.format(outcomeAt);
                }
                yield "Cancelled";
            }
        };

        return new CampaignDtos.ParticipantTokenResponse(
                token.getId(),
                token.getProduct().getId(),
                token.getProduct().getName(),
                token.getTokenValue(),
                token.getCostBasis(),
                token.getStatus().name(),
                statusLabel,
                token.getCreatedAt(),
                outcomeAt,
                orderId,
                actionable,
                token.getStatus() == TokenStatus.EXCHANGED
                        ? exchangedIntoProductNames
                        : List.of()
        );
    }

    private static String shortId(UUID id) {
        String s = id.toString().replace("-", "");
        return "#" + s.substring(0, Math.min(8, s.length())).toUpperCase();
    }

    private Customer resolveCustomer(RecordParticipantRequest request) {
        if (request.customerId() != null) {
            return customerService.requireCustomer(request.customerId());
        }
        if (request.newCustomer() != null) {
            var created = customerService.create(request.newCustomer());
            return customerService.requireCustomer(created.id());
        }
        throw new BusinessException("Either customerId or newCustomer is required");
    }

    public record RecordParticipantRequest(
            UUID customerId,
            @Valid CustomerDtos.CreateCustomerRequest newCustomer,
            @Min(value = 1, message = "bagsPurchased must be at least 1") int bagsPurchased
    ) {
    }

    public record RecordItemsRequest(
            @NotNull(message = "customerId is required") UUID customerId,
            @NotNull(message = "productId is required") UUID productId,
            @Min(value = 1, message = "quantity must be at least 1") int quantity
    ) {
    }

    public record TokenRecordResponse(
            UUID id,
            UUID productId,
            String productName,
            UUID customerId,
            BigDecimal tokenValue,
            String status,
            String sourceType,
            UUID sourceId,
            java.time.Instant createdAt
    ) {
    }
}
