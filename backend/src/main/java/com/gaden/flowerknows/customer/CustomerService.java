package com.gaden.flowerknows.customer;

import com.gaden.flowerknows.campaign.CampaignParticipant;
import com.gaden.flowerknows.campaign.CampaignParticipantRepository;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.token.ItemToken;
import com.gaden.flowerknows.token.ItemTokenRepository;
import com.gaden.flowerknows.token.SourceType;
import com.gaden.flowerknows.token.TokenService;
import com.gaden.flowerknows.token.TokenStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final ItemTokenRepository itemTokenRepository;
    private final CampaignParticipantRepository participantRepository;

    public CustomerService(
            CustomerRepository customerRepository,
            ItemTokenRepository itemTokenRepository,
            CampaignParticipantRepository participantRepository
    ) {
        this.customerRepository = customerRepository;
        this.itemTokenRepository = itemTokenRepository;
        this.participantRepository = participantRepository;
    }

    @Transactional(readOnly = true)
    public List<CustomerDtos.CustomerResponse> search(String query) {
        if (query == null || query.isBlank()) {
            return customerRepository.findAll().stream()
                    .map(CustomerDtos.CustomerResponse::from)
                    .toList();
        }
        String q = query.trim();
        return customerRepository.findByNameContainingIgnoreCaseOrPhoneContaining(q, q).stream()
                .map(CustomerDtos.CustomerResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CustomerDtos.CustomerDetailResponse getById(UUID id) {
        Customer customer = requireCustomer(id);

        List<ItemToken> holding = itemTokenRepository
                .findByCustomerIdAndStatusOrderByCreatedAtDesc(id, TokenStatus.HOLDING);
        List<ItemToken> history = itemTokenRepository
                .findByCustomerIdAndStatusNotOrderByCreatedAtDesc(id, TokenStatus.HOLDING);

        Map<UUID, String> campaignNames = resolveCampaignSourceLabels(holding, history);

        List<CustomerDtos.TokenCardResponse> holdingCards = holding.stream()
                .map(t -> toTokenCard(t, campaignNames))
                .toList();
        List<CustomerDtos.TokenCardResponse> historyCards = history.stream()
                .map(t -> toTokenCard(t, campaignNames))
                .toList();

        BigDecimal prepaidBalance = holding.stream()
                .map(ItemToken::getTokenValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int overdueHoldingCount = (int) holdingCards.stream().filter(CustomerDtos.TokenCardResponse::overdue).count();

        return new CustomerDtos.CustomerDetailResponse(
                customer.getId(),
                customer.getName(),
                customer.getPhone(),
                customer.getAddress(),
                customer.getCreatedAt(),
                prepaidBalance,
                overdueHoldingCount,
                holdingCards,
                historyCards
        );
    }

    @Transactional
    public CustomerDtos.CustomerResponse create(CustomerDtos.CreateCustomerRequest request) {
        Customer customer = new Customer(request.name(), request.phone(), request.address());
        return CustomerDtos.CustomerResponse.from(customerRepository.save(customer));
    }

    public Customer requireCustomer(UUID id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found: " + id));
    }

    private Map<UUID, String> resolveCampaignSourceLabels(
            List<ItemToken> holding,
            List<ItemToken> history
    ) {
        Set<UUID> participantIds = java.util.stream.Stream.concat(holding.stream(), history.stream())
                .filter(t -> t.getSourceType() == SourceType.CAMPAIGN)
                .map(ItemToken::getSourceId)
                .collect(Collectors.toSet());

        if (participantIds.isEmpty()) {
            return Map.of();
        }

        Map<UUID, String> labels = new HashMap<>();
        for (CampaignParticipant participant : participantRepository.findAllById(participantIds)) {
            labels.put(participant.getId(), participant.getCampaign().getName());
        }
        return labels;
    }

    private CustomerDtos.TokenCardResponse toTokenCard(
            ItemToken token,
            Map<UUID, String> campaignNames
    ) {
        long daysHeld = ChronoUnit.DAYS.between(token.getCreatedAt(), Instant.now());
        String sourceLabel = switch (token.getSourceType()) {
            case CAMPAIGN -> campaignNames.getOrDefault(token.getSourceId(), "Campaign");
            case EXCHANGE -> "Item Exchange";
        };

        return new CustomerDtos.TokenCardResponse(
                token.getId(),
                token.getProduct().getId(),
                token.getProduct().getName(),
                token.getTokenValue(),
                token.getCostBasis(),
                token.getStatus().name(),
                token.getSourceType().name(),
                token.getSourceId(),
                sourceLabel,
                token.getCreatedAt(),
                daysHeld,
                daysHeld >= TokenService.OVERDUE_DAYS
        );
    }
}
