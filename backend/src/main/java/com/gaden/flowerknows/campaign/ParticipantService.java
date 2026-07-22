package com.gaden.flowerknows.campaign;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.customer.Customer;
import com.gaden.flowerknows.customer.CustomerDtos;
import com.gaden.flowerknows.customer.CustomerService;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.token.ItemToken;
import com.gaden.flowerknows.token.ItemTokenRepository;
import com.gaden.flowerknows.token.SourceType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class ParticipantService {

    private final CampaignService campaignService;
    private final CampaignParticipantRepository participantRepository;
    private final CustomerService customerService;
    private final ItemTokenRepository itemTokenRepository;

    public ParticipantService(
            CampaignService campaignService,
            CampaignParticipantRepository participantRepository,
            CustomerService customerService,
            ItemTokenRepository itemTokenRepository
    ) {
        this.campaignService = campaignService;
        this.participantRepository = participantRepository;
        this.customerService = customerService;
        this.itemTokenRepository = itemTokenRepository;
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
        } else {
            participant.addBags(request.bagsPurchased(), amount);
        }

        CampaignParticipant saved = participantRepository.save(participant);
        return new CampaignDtos.ParticipantSummaryResponse(
                saved.getId(),
                customer.getId(),
                customer.getName(),
                customer.getPhone(),
                saved.getTotalBagsPurchased(),
                saved.getPrepaidAmount()
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
