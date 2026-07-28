package com.gaden.flowerknows.customer;

import com.gaden.flowerknows.campaign.CampaignParticipant;
import com.gaden.flowerknows.campaign.CampaignParticipantRepository;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.common.TextSearch;
import com.gaden.flowerknows.exchange.ExchangeTransactionRepository;
import com.gaden.flowerknows.exchange.ExchangedIntoProductNames;
import com.gaden.flowerknows.order.Order;
import com.gaden.flowerknows.order.OrderRepository;
import com.gaden.flowerknows.order.ShippingStatus;
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
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
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
    private final OrderRepository orderRepository;
    private final ExchangeTransactionRepository exchangeRepository;

    public CustomerService(
            CustomerRepository customerRepository,
            ItemTokenRepository itemTokenRepository,
            CampaignParticipantRepository participantRepository,
            OrderRepository orderRepository,
            ExchangeTransactionRepository exchangeRepository
    ) {
        this.customerRepository = customerRepository;
        this.itemTokenRepository = itemTokenRepository;
        this.participantRepository = participantRepository;
        this.orderRepository = orderRepository;
        this.exchangeRepository = exchangeRepository;
    }

    @Transactional(readOnly = true)
    public List<CustomerDtos.CustomerResponse> search(
            String query,
            CustomerActionStatus actionStatus,
            ShippingStatus shippingStatus
    ) {
        String foldedQuery = TextSearch.fold(query);
        List<Customer> customers = customerRepository.findAll().stream()
                .filter(c -> foldedQuery.isEmpty()
                        || TextSearch.containsFolded(c.getName(), foldedQuery)
                        || TextSearch.containsFolded(c.getPhone(), foldedQuery))
                .sorted(Comparator.comparing(
                        c -> TextSearch.fold(c.getName()),
                        String.CASE_INSENSITIVE_ORDER
                ))
                .toList();

        Map<UUID, ShippingStatus> latestShippingByCustomer = latestShippingStatusByCustomer();

        return customers.stream()
                .filter(c -> actionStatus == null || c.getActionStatus() == actionStatus)
                .filter(c -> {
                    if (shippingStatus == null) {
                        return true;
                    }
                    return shippingStatus == latestShippingByCustomer.get(c.getId());
                })
                .map(c -> toListResponse(c, latestShippingByCustomer.get(c.getId())))
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

        List<UUID> exchangedIds = history.stream()
                .filter(t -> t.getStatus() == TokenStatus.EXCHANGED)
                .map(ItemToken::getId)
                .toList();
        Map<UUID, List<String>> exchangedIntoByTokenId =
                ExchangedIntoProductNames.load(exchangeRepository, exchangedIds);

        List<CustomerDtos.TokenCardResponse> holdingCards = holding.stream()
                .map(t -> toTokenCard(t, campaignNames, List.of()))
                .toList();
        List<CustomerDtos.TokenCardResponse> historyCards = history.stream()
                .map(t -> toTokenCard(
                        t,
                        campaignNames,
                        ExchangedIntoProductNames.forToken(exchangedIntoByTokenId, t.getId())
                ))
                .toList();

        BigDecimal prepaidBalance = holding.stream()
                .map(ItemToken::getTokenValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int overdueHoldingCount = (int) holdingCards.stream().filter(CustomerDtos.TokenCardResponse::overdue).count();

        List<CustomerDtos.CustomerOrderSummaryResponse> orders = orderRepository
                .findByCustomerIdOrderByCreatedAtDesc(id)
                .stream()
                .map(this::toOrderSummary)
                .toList();

        CustomerDtos.CustomerOrderSummaryResponse latestOrder =
                orders.isEmpty() ? null : orders.getFirst();

        return new CustomerDtos.CustomerDetailResponse(
                customer.getId(),
                customer.getName(),
                customer.getPhone(),
                customer.getAddress(),
                customer.getActionStatus(),
                customer.getCreatedAt(),
                prepaidBalance,
                overdueHoldingCount,
                latestOrder,
                orders,
                holdingCards,
                historyCards
        );
    }

    @Transactional
    public CustomerDtos.CustomerResponse create(CustomerDtos.CreateCustomerRequest request) {
        Customer customer = customerRepository.save(
                new Customer(
                        request.name().trim(),
                        blankToNull(request.phone()),
                        blankToNull(request.address())
                )
        );
        return toListResponse(customer, null);
    }

    @Transactional
    public CustomerDtos.CustomerDetailResponse update(UUID id, CustomerDtos.UpdateCustomerRequest request) {
        Customer customer = requireCustomer(id);
        customer.setName(request.name().trim());
        customer.setPhone(blankToNull(request.phone()));
        customer.setAddress(blankToNull(request.address()));
        return getById(id);
    }

    @Transactional
    public CustomerDtos.CustomerDetailResponse updateActionStatus(
            UUID id,
            CustomerDtos.UpdateActionStatusRequest request
    ) {
        Customer customer = requireCustomer(id);
        customer.setActionStatus(request.actionStatus());
        return getById(id);
    }

    public Customer requireCustomer(UUID id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found: " + id));
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private Map<UUID, ShippingStatus> latestShippingStatusByCustomer() {
        Map<UUID, ShippingStatus> latest = new LinkedHashMap<>();
        for (Object[] row : orderRepository.findLatestShippingStatusByCustomer()) {
            UUID customerId = (UUID) row[0];
            ShippingStatus status = ShippingStatus.valueOf(String.valueOf(row[1]));
            latest.put(customerId, status);
        }
        return latest;
    }

    private CustomerDtos.CustomerResponse toListResponse(
            Customer customer,
            ShippingStatus latestShippingStatus
    ) {
        return new CustomerDtos.CustomerResponse(
                customer.getId(),
                customer.getName(),
                customer.getPhone(),
                customer.getAddress(),
                customer.getActionStatus(),
                latestShippingStatus == null ? null : latestShippingStatus.name(),
                customer.getCreatedAt()
        );
    }

    private CustomerDtos.CustomerOrderSummaryResponse toOrderSummary(Order order) {
        order.getTokens().size();
        return new CustomerDtos.CustomerOrderSummaryResponse(
                order.getId(),
                order.getCreatedAt(),
                order.getRecognizedRevenue(),
                order.getTotalCost(),
                order.getGrossMargin(),
                order.getShippingStatus().name(),
                order.getCarrierOrderId(),
                order.getTokens().size()
        );
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
            Map<UUID, String> campaignNames,
            List<String> exchangedIntoProductNames
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
                daysHeld >= TokenService.OVERDUE_DAYS,
                token.getStatus() == TokenStatus.EXCHANGED
                        ? exchangedIntoProductNames
                        : List.of()
        );
    }
}
