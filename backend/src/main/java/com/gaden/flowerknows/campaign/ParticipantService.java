package com.gaden.flowerknows.campaign;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.customer.Customer;
import com.gaden.flowerknows.customer.CustomerActionStatus;
import com.gaden.flowerknows.customer.CustomerDtos;
import com.gaden.flowerknows.customer.CustomerService;
import com.gaden.flowerknows.exchange.ExchangeTransaction;
import com.gaden.flowerknows.exchange.ExchangeTransactionRepository;
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

        if (participant == null) {
            participant = new CampaignParticipant(campaign, customer, request.bagsPurchased(), amount);
            campaign.getParticipants().add(participant);
            // US-18 / US-03 AC #7: new campaign engagement resets pre-order workflow
            customer.setActionStatus(CustomerActionStatus.UNDETERMINED);
        } else {
            participant.addBags(request.bagsPurchased(), amount);
        }

        CampaignParticipant saved = participantRepository.save(participant);
        int itemsRecorded = (int) itemTokenRepository.countBySourceTypeAndSourceId(
                SourceType.CAMPAIGN, saved.getId()
        );
        List<String> recordedItemNames = itemTokenRepository
                .findBySourceTypeAndSourceIdOrderByCreatedAtDesc(SourceType.CAMPAIGN, saved.getId())
                .stream()
                .limit(3)
                .map(t -> t.getProduct().getName())
                .toList();
        return new CampaignDtos.ParticipantSummaryResponse(
                saved.getId(),
                customer.getId(),
                customer.getName(),
                customer.getPhone(),
                saved.getTotalBagsPurchased(),
                saved.getPrepaidAmount(),
                itemsRecorded,
                recordedItemNames
        );
    }

    @Transactional
    public List<TokenRecordResponse> recordItems(UUID campaignId, RecordItemsRequest request) {
        Campaign campaign = campaignService.requireOpenCampaign(campaignId);

        CampaignParticipant participant = participantRepository
                .findByCampaignIdAndCustomerId(campaignId, request.customerId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Customer is not a participant in this campaign"
                ));

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
        campaignService.autoCloseIfPoolEmpty(campaign);

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
        CampaignParticipant participant = participantRepository.findById(participantId)
                .orElseThrow(() -> new ResourceNotFoundException("Participant not found: " + participantId));

        if (!participant.getCampaign().getId().equals(campaignId)) {
            throw new ResourceNotFoundException("Participant not found in this campaign");
        }

        List<ItemToken> tokens = itemTokenRepository
                .findBySourceTypeAndSourceIdOrderByCreatedAtDesc(SourceType.CAMPAIGN, participantId);

        List<UUID> nonHoldingIds = tokens.stream()
                .filter(t -> t.getStatus() != TokenStatus.HOLDING)
                .map(ItemToken::getId)
                .toList();

        Map<UUID, ExchangeTransaction> exchangeByTokenId = new HashMap<>();
        Map<UUID, Order> orderByTokenId = new HashMap<>();

        if (!nonHoldingIds.isEmpty()) {
            for (ExchangeTransaction tx : exchangeRepository.findAllByTokenInIds(nonHoldingIds)) {
                for (ItemToken t : tx.getTokensIn()) {
                    if (nonHoldingIds.contains(t.getId())) {
                        exchangeByTokenId.put(t.getId(), tx);
                    }
                }
            }
            for (Order order : orderRepository.findAllByTokenIds(nonHoldingIds)) {
                for (ItemToken t : order.getTokens()) {
                    if (nonHoldingIds.contains(t.getId())) {
                        orderByTokenId.put(t.getId(), order);
                    }
                }
            }
        }

        return tokens.stream()
                .map(token -> toParticipantTokenResponse(
                        token,
                        exchangeByTokenId.get(token.getId()),
                        orderByTokenId.get(token.getId())
                ))
                .collect(Collectors.toList());
    }

    private CampaignDtos.ParticipantTokenResponse toParticipantTokenResponse(
            ItemToken token,
            ExchangeTransaction exchange,
            Order order
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
                actionable
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
