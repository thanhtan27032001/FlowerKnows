package com.gaden.flowerknows.order;

import com.gaden.flowerknows.customer.Customer;
import com.gaden.flowerknows.customer.CustomerService;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.stock.StockTransactionRepository;
import com.gaden.flowerknows.token.ItemToken;
import com.gaden.flowerknows.token.ItemTokenRepository;
import com.gaden.flowerknows.token.SourceType;
import com.gaden.flowerknows.token.TokenStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderCreateServiceTests {

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private ItemTokenRepository itemTokenRepository;
    @Mock
    private CustomerService customerService;
    @Mock
    private StockTransactionRepository stockTransactionRepository;

    @Test
    void createOrderDoesNotChangeStockQuantityOrWriteStockTransactions() {
        OrderService orderService = new OrderService(
                orderRepository,
                itemTokenRepository,
                customerService
        );

        UUID customerId = UUID.randomUUID();
        Customer customer = new Customer("Lan", "090", null);
        setId(customer, customerId);
        when(customerService.requireCustomer(customerId)).thenReturn(customer);

        Product lipstick = new Product("Lipstick", BigDecimal.valueOf(250_000), 40);
        Product blush = new Product("Blush", BigDecimal.valueOf(180_000), 12);
        setId(lipstick, UUID.randomUUID());
        setId(blush, UUID.randomUUID());
        int lipstickBefore = lipstick.getStockQuantity();
        int blushBefore = blush.getStockQuantity();

        ItemToken t1 = new ItemToken(
                lipstick, customer, BigDecimal.valueOf(100_000), BigDecimal.valueOf(50_000),
                SourceType.CAMPAIGN, UUID.randomUUID()
        );
        ItemToken t2 = new ItemToken(
                blush, customer, BigDecimal.valueOf(80_000), BigDecimal.valueOf(40_000),
                SourceType.CAMPAIGN, UUID.randomUUID()
        );
        ItemToken t3 = new ItemToken(
                lipstick, customer, BigDecimal.valueOf(100_000), BigDecimal.valueOf(50_000),
                SourceType.EXCHANGE, UUID.randomUUID()
        );
        setId(t1, UUID.randomUUID());
        setId(t2, UUID.randomUUID());
        setId(t3, UUID.randomUUID());

        when(itemTokenRepository.findByIdInAndCustomerId(any(), eq(customerId)))
                .thenReturn(List.of(t1, t2, t3));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        OrderDtos.OrderResponse response = orderService.createOrder(
                new OrderDtos.CreateOrderRequest(
                        customerId,
                        List.of(t1.getId(), t2.getId(), t3.getId()),
                        null
                )
        );

        assertEquals(lipstickBefore, lipstick.getStockQuantity());
        assertEquals(blushBefore, blush.getStockQuantity());
        assertEquals(TokenStatus.ORDERED, t1.getStatus());
        assertEquals(TokenStatus.ORDERED, t2.getStatus());
        assertEquals(TokenStatus.ORDERED, t3.getStatus());
        assertEquals(BigDecimal.valueOf(280_000), response.recognizedRevenue());
        verify(stockTransactionRepository, never()).save(any());
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
