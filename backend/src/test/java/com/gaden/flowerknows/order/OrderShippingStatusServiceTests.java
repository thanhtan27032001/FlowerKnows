package com.gaden.flowerknows.order;

import com.gaden.flowerknows.customer.Customer;
import com.gaden.flowerknows.customer.CustomerActionStatus;
import com.gaden.flowerknows.customer.CustomerService;
import com.gaden.flowerknows.product.Product;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderShippingStatusServiceTests {

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private ItemTokenRepository itemTokenRepository;
    @Mock
    private CustomerService customerService;

    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(orderRepository, itemTokenRepository, customerService);
    }

    @Test
    void completingOrderResetsActionStatusWhenNoHoldingTokensRemain() {
        Customer customer = customer(CustomerActionStatus.NEEDS_IMMEDIATE_ORDER);
        Order order = shippedOrder(customer);

        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(itemTokenRepository.countByCustomerIdAndStatus(customer.getId(), TokenStatus.HOLDING))
                .thenReturn(0L);

        orderService.updateShippingStatus(
                order.getId(),
                new OrderDtos.UpdateShippingStatusRequest(ShippingStatus.COMPLETED, null)
        );

        assertEquals(CustomerActionStatus.UNDETERMINED, customer.getActionStatus());
        assertEquals(ShippingStatus.COMPLETED, order.getShippingStatus());
    }

    @Test
    void completingOrderDoesNotResetActionStatusWhenOtherHoldingTokensExist() {
        Customer customer = customer(CustomerActionStatus.CONSOLIDATING);
        Order order = shippedOrder(customer);

        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(itemTokenRepository.countByCustomerIdAndStatus(customer.getId(), TokenStatus.HOLDING))
                .thenReturn(1L);

        orderService.updateShippingStatus(
                order.getId(),
                new OrderDtos.UpdateShippingStatusRequest(ShippingStatus.COMPLETED, null)
        );

        assertEquals(CustomerActionStatus.CONSOLIDATING, customer.getActionStatus());
        assertEquals(ShippingStatus.COMPLETED, order.getShippingStatus());
    }

    @Test
    void transitioningOrderCreatedToShippedDoesNotTouchActionStatus() {
        Customer customer = customer(CustomerActionStatus.NEEDS_NEGOTIATE);
        Order order = createdOrder(customer);

        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        orderService.updateShippingStatus(
                order.getId(),
                new OrderDtos.UpdateShippingStatusRequest(ShippingStatus.SHIPPED, null)
        );

        assertEquals(CustomerActionStatus.NEEDS_NEGOTIATE, customer.getActionStatus());
        assertEquals(ShippingStatus.SHIPPED, order.getShippingStatus());
        verify(itemTokenRepository, never()).countByCustomerIdAndStatus(any(), any());
    }

    private Customer customer(CustomerActionStatus actionStatus) {
        Customer c = new Customer("Lan", "0900000000", null);
        setId(c, UUID.randomUUID());
        c.setActionStatus(actionStatus);
        return c;
    }

    private Order createdOrder(Customer customer) {
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

    private Order shippedOrder(Customer customer) {
        Order order = createdOrder(customer);
        order.setShippingStatus(ShippingStatus.SHIPPED);
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
