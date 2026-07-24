package com.gaden.flowerknows.order;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.customer.Customer;
import com.gaden.flowerknows.customer.CustomerService;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransactionType;
import com.gaden.flowerknows.token.ItemToken;
import com.gaden.flowerknows.token.ItemTokenRepository;
import com.gaden.flowerknows.token.TokenStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final ItemTokenRepository itemTokenRepository;
    private final CustomerService customerService;
    private final StockService stockService;

    public OrderService(
            OrderRepository orderRepository,
            ItemTokenRepository itemTokenRepository,
            CustomerService customerService,
            StockService stockService
    ) {
        this.orderRepository = orderRepository;
        this.itemTokenRepository = itemTokenRepository;
        this.customerService = customerService;
        this.stockService = stockService;
    }

    @Transactional
    public OrderDtos.OrderResponse createOrder(OrderDtos.CreateOrderRequest request) {
        Customer customer = customerService.requireCustomer(request.customerId());

        List<ItemToken> tokens = itemTokenRepository.findByIdInAndCustomerId(
                request.tokenIds(), customer.getId()
        );
        if (tokens.size() != request.tokenIds().size()) {
            throw new BusinessException("One or more tokens were not found for this customer");
        }
        for (ItemToken token : tokens) {
            token.requireHolding();
        }

        BigDecimal revenue = tokens.stream()
                .map(ItemToken::getTokenValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCost = tokens.stream()
                .map(token -> token.getCostBasis() == null ? BigDecimal.ZERO : token.getCostBasis())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal grossMargin = revenue.subtract(totalCost);

        Map<UUID, Integer> fulfillCounts = new HashMap<>();
        for (ItemToken token : tokens) {
            fulfillCounts.merge(token.getProduct().getId(), 1, Integer::sum);
            token.setStatus(TokenStatus.ORDERED);
        }

        for (Map.Entry<UUID, Integer> entry : fulfillCounts.entrySet()) {
            Product product = tokens.stream()
                    .map(ItemToken::getProduct)
                    .filter(p -> p.getId().equals(entry.getKey()))
                    .findFirst()
                    .orElseThrow();
            stockService.applyStockChange(
                    product,
                    -entry.getValue(),
                    StockTransactionType.ORDER_FULFILLMENT,
                    "Removed for order fulfillment"
            );
        }

        Order order = new Order(customer, revenue, totalCost, grossMargin, request.carrierOrderId());
        order.getTokens().addAll(tokens);
        Order saved = orderRepository.save(order);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public OrderDtos.OrderResponse getOrder(UUID id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + id));
        order.getTokens().size();
        return toResponse(order);
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.OrderResponse> listByCustomer(UUID customerId) {
        customerService.requireCustomer(customerId);
        return orderRepository.findByCustomerIdOrderByCreatedAtDesc(customerId).stream()
                .map(order -> {
                    order.getTokens().size();
                    return toResponse(order);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.OrderResponse> listAll() {
        return orderRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(order -> {
                    order.getTokens().size();
                    return toResponse(order);
                })
                .toList();
    }

    @Transactional
    public OrderDtos.OrderResponse updateShippingStatus(UUID id, OrderDtos.UpdateShippingStatusRequest request) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + id));

        validateShippingTransition(order.getShippingStatus(), request.shippingStatus());
        order.setShippingStatus(request.shippingStatus());
        if (request.carrierOrderId() != null) {
            order.setCarrierOrderId(request.carrierOrderId());
        }
        order.getTokens().size();
        return toResponse(order);
    }

    private void validateShippingTransition(ShippingStatus current, ShippingStatus next) {
        boolean valid = switch (current) {
            case ORDER_CREATED -> next == ShippingStatus.SHIPPED || next == ShippingStatus.ORDER_CREATED;
            case SHIPPED -> next == ShippingStatus.COMPLETED || next == ShippingStatus.SHIPPED;
            case COMPLETED -> next == ShippingStatus.COMPLETED;
        };
        if (!valid) {
            throw new BusinessException(
                    "Invalid shipping status transition: %s → %s".formatted(current, next)
            );
        }
    }

    private OrderDtos.OrderResponse toResponse(Order order) {
        return new OrderDtos.OrderResponse(
                order.getId(),
                order.getCustomer().getId(),
                order.getCustomer().getName(),
                order.getCreatedAt(),
                order.getRecognizedRevenue(),
                order.getTotalCost(),
                order.getGrossMargin(),
                order.getShippingStatus(),
                order.getCarrierOrderId(),
                order.getTokens().stream()
                        .map(t -> new OrderDtos.OrderTokenResponse(
                                t.getId(),
                                t.getProduct().getId(),
                                t.getProduct().getName(),
                                t.getTokenValue(),
                                t.getCostBasis(),
                                t.getStatus().name()
                        ))
                        .toList()
        );
    }
}
