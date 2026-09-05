package com.gaden.flowerknows.order;

import com.gaden.flowerknows.customer.Customer;
import com.gaden.flowerknows.customer.CustomerService;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.stock.StockTransactionRepository;
import com.gaden.flowerknows.token.ItemToken;
import com.gaden.flowerknows.token.ItemTokenRepository;
import com.gaden.flowerknows.token.SourceType;
import com.gaden.flowerknows.token.TokenStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * US-41: undo/cancel an order created by mistake.
 */
@ExtendWith(MockitoExtension.class)
class OrderCancelServiceTests {

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private ItemTokenRepository itemTokenRepository;
    @Mock
    private CustomerService customerService;
    @Mock
    private StockTransactionRepository stockTransactionRepository;

    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(orderRepository, itemTokenRepository, customerService);
    }

    @Test
    void cancelRevertsTokensToHoldingAndDeletesOrder() {
        Customer customer = customer();
        Order order = createdOrderWithTokens(customer);
        ItemToken token = order.getTokens().get(0);

        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.cancelOrder(order.getId());

        assertEquals(TokenStatus.HOLDING, token.getStatus());
        verify(orderRepository).delete(order);
        verify(stockTransactionRepository, never()).save(any());
    }

    @Test
    void cancelBlockedOnceOrderHasShipped() {
        Customer customer = customer();
        Order order = createdOrderWithTokens(customer);
        order.setShippingStatus(ShippingStatus.SHIPPED);
        ItemToken token = order.getTokens().get(0);

        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        assertThrows(IllegalStateException.class, () -> orderService.cancelOrder(order.getId()));

        assertEquals(TokenStatus.ORDERED, token.getStatus());
        verify(orderRepository, never()).delete(any());
        verify(orderRepository, never()).save(any());
    }

    @Test
    void cancelBlockedOnceOrderHasCompleted() {
        Customer customer = customer();
        Order order = createdOrderWithTokens(customer);
        order.setShippingStatus(ShippingStatus.COMPLETED);

        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        assertThrows(IllegalStateException.class, () -> orderService.cancelOrder(order.getId()));

        verify(orderRepository, never()).delete(any());
    }

    @Test
    void cancelRemovesOrderFromRevenueAggregates() {
        // Before cancel: the order's revenue is included in the aggregate.
        when(orderRepository.sumAllRecognizedRevenue())
                .thenReturn(BigDecimal.valueOf(300_000))
                .thenReturn(BigDecimal.ZERO);

        BigDecimal before = orderRepository.sumAllRecognizedRevenue();
        assertEquals(0, BigDecimal.valueOf(300_000).compareTo(before));

        Customer customer = customer();
        Order order = createdOrderWithTokens(customer);
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.cancelOrder(order.getId());
        verify(orderRepository, times(1)).delete(order);

        // After cancel: the deleted row is excluded from the SUM aggregate the revenue
        // report reads (order/OrderRepository.sumAllRecognizedRevenue).
        BigDecimal after = orderRepository.sumAllRecognizedRevenue();
        assertEquals(0, BigDecimal.ZERO.compareTo(after));
    }

    private Customer customer() {
        Customer c = new Customer("Lan", "0900000000", null);
        setId(c, UUID.randomUUID());
        return c;
    }

    private Order createdOrderWithTokens(Customer customer) {
        Order order = new Order(
                customer,
                BigDecimal.valueOf(100_000),
                BigDecimal.valueOf(50_000),
                BigDecimal.valueOf(50_000),
                null
        );
        setId(order, UUID.randomUUID());
        Product product = new Product("Lipstick", BigDecimal.valueOf(250_000), 10);
        setId(product, UUID.randomUUID());
        ItemToken token = new ItemToken(
                product, customer, BigDecimal.valueOf(100_000), BigDecimal.valueOf(50_000),
                SourceType.CAMPAIGN, UUID.randomUUID()
        );
        token.setStatus(TokenStatus.ORDERED);
        setId(token, UUID.randomUUID());
        order.getTokens().add(token);
        return order;
    }

    private static void setId(Object entity, UUID id) {
        try {
            var idField = entity.getClass().getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(entity, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
