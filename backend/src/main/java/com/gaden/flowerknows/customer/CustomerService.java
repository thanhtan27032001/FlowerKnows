package com.gaden.flowerknows.customer;

import com.gaden.flowerknows.campaign.CampaignParticipant;
import com.gaden.flowerknows.campaign.CampaignParticipantRepository;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.common.TextSearch;
import com.gaden.flowerknows.directsale.DirectSale;
import com.gaden.flowerknows.directsale.DirectSaleRepository;
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
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final ItemTokenRepository itemTokenRepository;
    private final CampaignParticipantRepository participantRepository;
    private final OrderRepository orderRepository;
    private final ExchangeTransactionRepository exchangeRepository;
    private final DirectSaleRepository directSaleRepository;

    public CustomerService(
            CustomerRepository customerRepository,
            ItemTokenRepository itemTokenRepository,
            CampaignParticipantRepository participantRepository,
            OrderRepository orderRepository,
            ExchangeTransactionRepository exchangeRepository,
            DirectSaleRepository directSaleRepository
    ) {
        this.customerRepository = customerRepository;
        this.itemTokenRepository = itemTokenRepository;
        this.participantRepository = participantRepository;
        this.orderRepository = orderRepository;
        this.exchangeRepository = exchangeRepository;
        this.directSaleRepository = directSaleRepository;
    }

    @Transactional(readOnly = true)
    public List<CustomerDtos.CustomerResponse> search(
            String query,
            CustomerActionStatus actionStatus,
            ShippingStatus shippingStatus,
            String sortBy,
            String sortDir
    ) {
        String foldedQuery = TextSearch.fold(query);
        Map<UUID, ShippingStatus> latestShippingByCustomer = latestShippingStatusByCustomer();
        Comparator<Customer> sort = resolveSortComparator(sortBy, sortDir, latestShippingByCustomer);

        // Filter first (search + status), then sort — US-19 AC#11
        return customerRepository.findAll().stream()
                .filter(c -> foldedQuery.isEmpty()
                        || TextSearch.containsFolded(c.getName(), foldedQuery)
                        || TextSearch.containsFolded(c.getPhone(), foldedQuery))
                .filter(c -> actionStatus == null || c.getActionStatus() == actionStatus)
                .filter(c -> {
                    if (shippingStatus == null) {
                        return true;
                    }
                    return shippingStatus == latestShippingByCustomer.get(c.getId());
                })
                .sorted(sort)
                .map(c -> toListResponse(c, latestShippingByCustomer.get(c.getId())))
                .toList();
    }

    /** US-19 AC#8–#10: accent-folded name/phone; business ordinals for statuses; shipping nulls last. */
    static Comparator<Customer> resolveSortComparator(
            String sortBy,
            String sortDir,
            Map<UUID, ShippingStatus> latestShippingByCustomer
    ) {
        // US-19 AC#8a: default to most recently updated first
        if (sortBy == null || sortBy.isBlank()) {
            return Comparator.comparing(Customer::getUpdatedAt).reversed();
        }

        boolean ascending = resolveAscending(sortDir);

        return switch (sortBy) {
            case "name" -> comparingFolded(Customer::getName, ascending);
            case "phone" -> comparingFoldedNullable(Customer::getPhone, ascending);
            case "updatedAt" -> {
                Comparator<Instant> byUpdated = ascending
                        ? Comparator.naturalOrder()
                        : Comparator.reverseOrder();
                yield Comparator.comparing(Customer::getUpdatedAt, byUpdated);
            }
            case "actionStatus" -> {
                Comparator<Integer> ordinalCmp = ascending
                        ? Comparator.naturalOrder()
                        : Comparator.reverseOrder();
                yield Comparator.comparing(c -> actionStatusOrdinal(c.getActionStatus()), ordinalCmp);
            }
            case "shippingStatus" -> {
                // nullsLast keeps "no order" last for both directions (US-19 AC#10)
                Comparator<Integer> byOrdinal = ascending
                        ? Comparator.naturalOrder()
                        : Comparator.reverseOrder();
                Comparator<Integer> ordinalCmp = Comparator.nullsLast(byOrdinal);
                yield Comparator.comparing(
                        c -> {
                            ShippingStatus status = latestShippingByCustomer.get(c.getId());
                            return status == null ? null : Integer.valueOf(shippingStatusOrdinal(status));
                        },
                        ordinalCmp
                );
            }
            default -> throw new IllegalArgumentException(
                    "sortBy must be one of: name, phone, actionStatus, shippingStatus, updatedAt"
            );
        };
    }

    static boolean resolveAscending(String sortDir) {
        if (sortDir == null || sortDir.isBlank()) {
            return true;
        }
        if ("asc".equalsIgnoreCase(sortDir)) {
            return true;
        }
        if ("desc".equalsIgnoreCase(sortDir)) {
            return false;
        }
        throw new IllegalArgumentException("sortDir must be asc or desc");
    }

    /** Business sequence for action_status (US-19 AC#9) — not alphabetical. */
    static int actionStatusOrdinal(CustomerActionStatus status) {
        return switch (status) {
            case UNDETERMINED -> 0;
            case NEEDS_NEGOTIATE -> 1;
            case NEGOTIATING -> 2;
            case CONSOLIDATING -> 3;
            case NEEDS_IMMEDIATE_ORDER -> 4;
        };
    }

    /** Business sequence for shipping_status (US-19 AC#9). */
    static int shippingStatusOrdinal(ShippingStatus status) {
        return switch (status) {
            case ORDER_CREATED -> 0;
            case SHIPPED -> 1;
            case COMPLETED -> 2;
        };
    }

    private static Comparator<Customer> comparingFolded(
            Function<Customer, String> getter,
            boolean ascending
    ) {
        Comparator<String> keyCmp = ascending
                ? String.CASE_INSENSITIVE_ORDER
                : String.CASE_INSENSITIVE_ORDER.reversed();
        return Comparator.comparing(c -> TextSearch.fold(getter.apply(c)), keyCmp);
    }

    private static Comparator<Customer> comparingFoldedNullable(
            Function<Customer, String> getter,
            boolean ascending
    ) {
        Comparator<String> byFolded = ascending
                ? String.CASE_INSENSITIVE_ORDER
                : String.CASE_INSENSITIVE_ORDER.reversed();
        Comparator<String> keyCmp = Comparator.nullsLast(byFolded);
        return Comparator.comparing(c -> {
            String raw = getter.apply(c);
            if (raw == null || raw.isBlank()) {
                return null;
            }
            return TextSearch.fold(raw);
        }, keyCmp);
    }

    @Transactional(readOnly = true)
    public CustomerDtos.CustomerDetailResponse getById(UUID id) {
        Customer customer = requireCustomer(id);

        // JOIN FETCH product to avoid N+1 on token.getProduct()
        List<ItemToken> holding = itemTokenRepository
                .findByCustomerIdAndStatusWithProduct(id, TokenStatus.HOLDING);
        List<ItemToken> history = itemTokenRepository
                .findByCustomerIdAndStatusNotWithProduct(id, TokenStatus.HOLDING);

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

        // Batch-load orders with token count to avoid N+1 on order.getTokens().size()
        List<CustomerDtos.CustomerOrderSummaryResponse> orders = orderRepository
                .findByCustomerIdWithTokenCount(id)
                .stream()
                .map(row -> toOrderSummary((Order) row[0], ((Number) row[1]).intValue()))
                .toList();

        CustomerDtos.CustomerOrderSummaryResponse latestOrder =
                orders.isEmpty() ? null : orders.getFirst();

        List<CustomerDtos.DirectSaleSummaryResponse> directSales =
                directSaleRepository.findByCustomerIdWithLines(id).stream()
                        .sorted(Comparator.comparing(DirectSale::getCreatedAt).reversed())
                        .map(this::toDirectSaleSummary)
                        .toList();

        return new CustomerDtos.CustomerDetailResponse(
                customer.getId(),
                customer.getName(),
                customer.getPhone(),
                customer.getAddress(),
                customer.getNote(),
                customer.getActionStatus(),
                customer.getCreatedAt(),
                prepaidBalance,
                overdueHoldingCount,
                latestOrder,
                orders,
                holdingCards,
                historyCards,
                directSales
        );
    }

    @Transactional
    public CustomerDtos.CustomerResponse create(CustomerDtos.CreateCustomerRequest request) {
        Customer customer = new Customer(
                request.name().trim(),
                blankToNull(request.phone()),
                blankToNull(request.address())
        );
        customer.setNote(blankToNull(request.note()));
        customer = customerRepository.save(customer);
        return toListResponse(customer, null);
    }

    @Transactional
    public CustomerDtos.CustomerDetailResponse update(UUID id, CustomerDtos.UpdateCustomerRequest request) {
        Customer customer = requireCustomer(id);
        customer.setName(request.name().trim());
        customer.setPhone(blankToNull(request.phone()));
        customer.setAddress(blankToNull(request.address()));
        customer.setNote(blankToNull(request.note()));
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
                customer.getNote(),
                customer.getActionStatus(),
                latestShippingStatus == null ? null : latestShippingStatus.name(),
                customer.getCreatedAt()
        );
    }

    private CustomerDtos.CustomerOrderSummaryResponse toOrderSummary(Order order, int tokenCount) {
        return new CustomerDtos.CustomerOrderSummaryResponse(
                order.getId(),
                order.getCreatedAt(),
                order.getRecognizedRevenue(),
                order.getTotalCost(),
                order.getGrossMargin(),
                order.getShippingStatus().name(),
                order.getCarrierOrderId(),
                tokenCount
        );
    }

    private CustomerDtos.DirectSaleSummaryResponse toDirectSaleSummary(DirectSale sale) {
        boolean missingCost = sale.getLines().stream()
                .anyMatch(line -> line.getCostPriceSnapshot() == null);
        return new CustomerDtos.DirectSaleSummaryResponse(
                sale.getId(),
                sale.getCreatedAt(),
                sale.getRecognizedRevenue(),
                sale.getTotalCost(),
                sale.getGrossMargin(),
                missingCost,
                sale.getLines().stream()
                        .map(line -> new CustomerDtos.DirectSaleLineSummaryResponse(
                                line.getId(),
                                line.getProduct().getId(),
                                line.getProduct().getName(),
                                line.getQuantity(),
                                line.getUnitPrice(),
                                line.getCostPriceSnapshot()
                        ))
                        .toList()
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

        // JOIN FETCH campaign to avoid N+1 on participant.getCampaign().getName()
        Map<UUID, String> labels = new HashMap<>();
        for (CampaignParticipant participant : participantRepository.findAllByIdWithCampaign(participantIds)) {
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
