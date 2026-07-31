package com.gaden.flowerknows.product;

import com.gaden.flowerknows.common.BatchLineException;
import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransaction;
import com.gaden.flowerknows.stock.StockTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductServiceTests {

    @Mock
    private ProductRepository productRepository;
    @Mock
    private StockTransactionRepository stockTransactionRepository;

    private ProductService productService;
    private StockService stockService;

    @BeforeEach
    void setUp() {
        stockService = new StockService(stockTransactionRepository);
        productService = new ProductService(
                productRepository,
                stockService,
                stockTransactionRepository,
                5
        );
    }

    @Test
    void createBatchRequiresCostPriceWhenInitialStockPositive() {
        var request = new ProductDtos.CreateProductsRequest(
                List.of(
                        new ProductDtos.CreateProductItemRequest(
                                "A", BigDecimal.valueOf(100), 5, null
                        )
                ),
                false
        );

        BatchLineException ex = assertThrows(
                BatchLineException.class,
                () -> productService.create(request)
        );
        assertEquals(1, ex.getLineErrors().size());
        assertEquals(0, ex.getLineErrors().getFirst().lineIndex());
        assertTrue(ex.getLineErrors().getFirst().message().contains("giá vốn"));
        verify(productRepository, never()).save(any());
    }

    @Test
    void createBatchRejectsDuplicateNamesWithoutConfirm() {
        when(productRepository.existsByNameIgnoreCase("Rose")).thenReturn(true);

        var request = new ProductDtos.CreateProductsRequest(
                List.of(
                        new ProductDtos.CreateProductItemRequest(
                                "Rose", BigDecimal.valueOf(100), 0, null
                        )
                ),
                false
        );

        assertThrows(BusinessException.class, () -> productService.create(request));
        verify(productRepository, never()).save(any());
    }

    @Test
    void createBatchRejectsDuplicatesWithinSubmission() {
        var request = new ProductDtos.CreateProductsRequest(
                List.of(
                        new ProductDtos.CreateProductItemRequest(
                                "Rose", BigDecimal.valueOf(100), 0, null
                        ),
                        new ProductDtos.CreateProductItemRequest(
                                "rose", BigDecimal.valueOf(200), 0, null
                        )
                ),
                false
        );

        assertThrows(BusinessException.class, () -> productService.create(request));
        verify(productRepository, never()).save(any());
    }

    @Test
    void createBatchWithInitialStockUsesStockInAndSetsAverageCost() {
        when(productRepository.existsByNameIgnoreCase("Rose")).thenReturn(false);
        when(productRepository.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));
        when(stockTransactionRepository.save(any(StockTransaction.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        var request = new ProductDtos.CreateProductsRequest(
                List.of(
                        new ProductDtos.CreateProductItemRequest(
                                "Rose",
                                BigDecimal.valueOf(250000),
                                10,
                                BigDecimal.valueOf(80000)
                        )
                ),
                false
        );

        ProductDtos.CreateProductsResponse response = productService.create(request);
        assertEquals(1, response.products().size());
        assertEquals(10, response.products().getFirst().stockQuantity());
        assertEquals(0, BigDecimal.valueOf(80000).compareTo(
                response.products().getFirst().averageCostPrice()
        ));

        ArgumentCaptor<StockTransaction> txCaptor = ArgumentCaptor.forClass(StockTransaction.class);
        verify(stockTransactionRepository).save(txCaptor.capture());
        assertEquals("Initial stock", txCaptor.getValue().getNote());
        assertEquals(10, txCaptor.getValue().getQuantityChange());
    }

    @Test
    void resolveSortUsesNullsLastForAverageCost() {
        Sort sort = ProductService.resolveSort("averageCostPrice", "desc");
        Sort.Order order = sort.getOrderFor("averageCostPrice");
        assertEquals(Sort.Direction.DESC, order.getDirection());
        assertEquals(Sort.NullHandling.NULLS_LAST, order.getNullHandling());
    }

    @Test
    void resolveSortDefaultsToCreatedAtDesc() {
        Sort sort = ProductService.resolveSort(null, null);
        assertEquals(Sort.Direction.DESC, sort.getOrderFor("createdAt").getDirection());
    }

    @Test
    void listPassesFoldedQueryToRepository() {
        when(productRepository.search(eq("guong"), any(Sort.class))).thenReturn(List.of());
        productService.list("Gương", "name", "asc");
        verify(productRepository).search(eq("guong"), any(Sort.class));
    }
}
