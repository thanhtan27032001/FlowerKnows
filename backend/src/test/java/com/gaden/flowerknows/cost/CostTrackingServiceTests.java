package com.gaden.flowerknows.cost;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.customer.Customer;
import com.gaden.flowerknows.customer.CustomerService;
import com.gaden.flowerknows.order.Order;
import com.gaden.flowerknows.order.OrderDtos;
import com.gaden.flowerknows.order.OrderRepository;
import com.gaden.flowerknows.order.OrderService;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.product.ProductDtos;
import com.gaden.flowerknows.product.ProductRepository;
import com.gaden.flowerknows.product.ProductService;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransaction;
import com.gaden.flowerknows.stock.StockTransactionRepository;
import com.gaden.flowerknows.stock.StockTransactionType;
import com.gaden.flowerknows.token.ItemToken;
import com.gaden.flowerknows.token.ItemTokenRepository;
import com.gaden.flowerknows.token.SourceType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CostTrackingServiceTests {

    @Mock
    private StockTransactionRepository stockTransactionRepository;
    @Mock
    private ProductRepository productRepository;
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private ItemTokenRepository itemTokenRepository;
    @Mock
    private CustomerService customerService;

    @Test
    void weightedAverageCostPriceIsRecalculatedAcrossMultipleStockIns() {
        StockService stockService = new StockService(stockTransactionRepository);
        Product product = new Product("Rose", BigDecimal.valueOf(250), 10);
        product.setAverageCostPrice(BigDecimal.valueOf(100));

        when(stockTransactionRepository.save(any(StockTransaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        stockService.applyStockIn(product, 10, BigDecimal.valueOf(200), "batch 1");
        stockService.applyStockIn(product, 5, BigDecimal.valueOf(50), "batch 2");

        assertEquals(25, product.getStockQuantity());
        assertEquals(BigDecimal.valueOf(130.00).setScale(2), product.getAverageCostPrice());

        ArgumentCaptor<StockTransaction> captor = ArgumentCaptor.forClass(StockTransaction.class);
        verify(stockTransactionRepository, times(2)).save(captor.capture());
        List<StockTransaction> rows = captor.getAllValues();
        assertEquals(0, BigDecimal.valueOf(100).compareTo(rows.get(0).getAverageCostPriceBefore()));
        assertEquals(0, BigDecimal.valueOf(150.00).setScale(2).compareTo(rows.get(1).getAverageCostPriceBefore()));
    }

    @Test
    void stockInRejectsMissingOrInvalidCostPrice() {
        ProductService productService = new ProductService(
                productRepository,
                new StockService(stockTransactionRepository),
                stockTransactionRepository,
                5
        );

        UUID productId = UUID.randomUUID();

        ProductDtos.StockInRequest missingCost = new ProductDtos.StockInRequest(
                List.of(new ProductDtos.StockInItemRequest(productId, 3, null, "x"))
        );
        assertThrows(BusinessException.class, () -> productService.stockIn(missingCost));

        ProductDtos.StockInRequest invalidCost = new ProductDtos.StockInRequest(
                List.of(new ProductDtos.StockInItemRequest(productId, 3, BigDecimal.ZERO, "x"))
        );
        assertThrows(BusinessException.class, () -> productService.stockIn(invalidCost));

        verify(stockTransactionRepository, never()).save(any(StockTransaction.class));
    }

    @Test
    void nonStockInFlowDoesNotChangeAverageCostPrice() {
        StockService stockService = new StockService(stockTransactionRepository);
        Product product = new Product("Lily", BigDecimal.valueOf(100), 10);
        product.setAverageCostPrice(BigDecimal.valueOf(77.77).setScale(2));

        when(stockTransactionRepository.save(any(StockTransaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        stockService.applyStockChange(product, 2, StockTransactionType.CAMPAIGN_RETURN, "return");
        stockService.applyStockChange(product, -1, StockTransactionType.ORDER_FULFILLMENT, "fulfill");

        assertEquals(BigDecimal.valueOf(77.77).setScale(2), product.getAverageCostPrice());
    }

    @Test
    void orderCreationComputesTotalCostAndGrossMarginIncludingNullCostBasis() {
        OrderService orderService = new OrderService(
                orderRepository,
                itemTokenRepository,
                customerService
        );

        UUID customerId = UUID.randomUUID();
        Customer customer = new Customer("A", "1", null);
        setId(customer, customerId);
        when(customerService.requireCustomer(customerId)).thenReturn(customer);

        Product p1 = new Product("A", BigDecimal.valueOf(100), 10);
        Product p2 = new Product("B", BigDecimal.valueOf(200), 10);
        setId(p1, UUID.randomUUID());
        setId(p2, UUID.randomUUID());
        int p1Before = p1.getStockQuantity();
        int p2Before = p2.getStockQuantity();

        ItemToken t1 = new ItemToken(p1, customer, BigDecimal.valueOf(100), BigDecimal.valueOf(30), SourceType.CAMPAIGN, UUID.randomUUID());
        ItemToken t2 = new ItemToken(p2, customer, BigDecimal.valueOf(200), null, SourceType.CAMPAIGN, UUID.randomUUID());

        when(itemTokenRepository.findByIdInAndCustomerId(any(), eq(customerId))).thenReturn(List.of(t1, t2));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        OrderDtos.OrderResponse response = orderService.createOrder(
                new OrderDtos.CreateOrderRequest(customerId, List.of(UUID.randomUUID(), UUID.randomUUID()), null)
        );

        assertEquals(BigDecimal.valueOf(300), response.recognizedRevenue());
        assertEquals(BigDecimal.valueOf(30), response.totalCost());
        assertEquals(BigDecimal.valueOf(270), response.grossMargin());
        assertTrue(response.tokens().stream().anyMatch(t -> t.costBasis() == null));

        // v2.7: create order must not touch stock or write ORDER_FULFILLMENT rows
        assertEquals(p1Before, p1.getStockQuantity());
        assertEquals(p2Before, p2.getStockQuantity());
        verify(stockTransactionRepository, never()).save(any(StockTransaction.class));
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
