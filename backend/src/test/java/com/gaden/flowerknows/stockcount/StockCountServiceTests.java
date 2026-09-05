package com.gaden.flowerknows.stockcount;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.product.ProductRepository;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransaction;
import com.gaden.flowerknows.stock.StockTransactionRepository;
import com.gaden.flowerknows.stock.StockTransactionType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StockCountServiceTests {

    @Mock
    private StockCountRepository stockCountRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private StockTransactionRepository stockTransactionRepository;

    private StockCountService stockCountService;

    @BeforeEach
    void setUp() {
        StockService stockService = new StockService(stockTransactionRepository);
        stockCountService = new StockCountService(stockCountRepository, productRepository, stockService);
        lenient().when(stockTransactionRepository.save(any(StockTransaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void deltaPositiveWithCostPriceUpdatesAverageAndWritesStockIn() {
        Product product = product("Rose", 10);
        product.setAverageCostPrice(BigDecimal.valueOf(100));

        StockCount stockCount = stockCountSession("Q3 count");
        StockCountLine line = line(stockCount, product, 10);
        line.setCountedQuantity(15);
        line.setCostPrice(BigDecimal.valueOf(200));

        when(stockCountRepository.findByIdWithLines(stockCount.getId())).thenReturn(Optional.of(stockCount));

        stockCountService.complete(stockCount.getId());

        ArgumentCaptor<StockTransaction> captor = ArgumentCaptor.forClass(StockTransaction.class);
        verify(stockTransactionRepository).save(captor.capture());
        StockTransaction tx = captor.getValue();

        assertEquals(StockTransactionType.STOCK_IN, tx.getType());
        assertEquals(5, tx.getQuantityChange());
        assertEquals(0, BigDecimal.valueOf(200).compareTo(tx.getCostPrice()));
        assertEquals(0, BigDecimal.valueOf(100).compareTo(tx.getAverageCostPriceBefore()));
        assertEquals(stockCount.getId(), tx.getStockCountId());
        assertEquals(15, product.getStockQuantity());
        // (100*10 + 200*5) / 15 = 133.33
        assertEquals(0, BigDecimal.valueOf(133.33).compareTo(product.getAverageCostPrice()));
        assertNotNull(stockCount.getCompletedAt());
    }

    @Test
    void deltaPositiveWithoutCostPriceWritesCostBlindAdjustment() {
        Product product = product("Rose", 10);
        product.setAverageCostPrice(BigDecimal.valueOf(100));

        StockCount stockCount = stockCountSession(null);
        StockCountLine line = line(stockCount, product, 10);
        line.setCountedQuantity(15);
        // no costPrice set

        when(stockCountRepository.findByIdWithLines(stockCount.getId())).thenReturn(Optional.of(stockCount));

        stockCountService.complete(stockCount.getId());

        ArgumentCaptor<StockTransaction> captor = ArgumentCaptor.forClass(StockTransaction.class);
        verify(stockTransactionRepository).save(captor.capture());
        StockTransaction tx = captor.getValue();

        assertEquals(StockTransactionType.STOCK_ADJUSTMENT, tx.getType());
        assertEquals(5, tx.getQuantityChange());
        assertNull(tx.getCostPrice());
        assertEquals(15, product.getStockQuantity());
        // average cost price must not have changed
        assertEquals(0, BigDecimal.valueOf(100).compareTo(product.getAverageCostPrice()));
    }

    @Test
    void deltaNegativeAlwaysWritesAdjustmentEvenWithCostPriceSet() {
        Product product = product("Rose", 20);
        product.setAverageCostPrice(BigDecimal.valueOf(100));

        StockCount stockCount = stockCountSession(null);
        StockCountLine line = line(stockCount, product, 20);
        line.setCountedQuantity(12);
        line.setCostPrice(BigDecimal.valueOf(200)); // should be ignored for a decrease

        when(stockCountRepository.findByIdWithLines(stockCount.getId())).thenReturn(Optional.of(stockCount));

        stockCountService.complete(stockCount.getId());

        ArgumentCaptor<StockTransaction> captor = ArgumentCaptor.forClass(StockTransaction.class);
        verify(stockTransactionRepository).save(captor.capture());
        StockTransaction tx = captor.getValue();

        assertEquals(StockTransactionType.STOCK_ADJUSTMENT, tx.getType());
        assertEquals(-8, tx.getQuantityChange());
        assertEquals(12, product.getStockQuantity());
        assertEquals(0, BigDecimal.valueOf(100).compareTo(product.getAverageCostPrice()));
    }

    @Test
    void nullCountedQuantityLinesAreSkipped() {
        Product product = product("Rose", 10);
        StockCount stockCount = stockCountSession(null);
        line(stockCount, product, 10); // countedQuantity left null

        when(stockCountRepository.findByIdWithLines(stockCount.getId())).thenReturn(Optional.of(stockCount));

        stockCountService.complete(stockCount.getId());

        verify(stockTransactionRepository, never()).save(any());
        assertEquals(10, product.getStockQuantity());
        assertNotNull(stockCount.getCompletedAt());
    }

    @Test
    void zeroDeltaWritesNothing() {
        Product product = product("Rose", 10);
        StockCount stockCount = stockCountSession(null);
        StockCountLine line = line(stockCount, product, 10);
        line.setCountedQuantity(10);

        when(stockCountRepository.findByIdWithLines(stockCount.getId())).thenReturn(Optional.of(stockCount));

        stockCountService.complete(stockCount.getId());

        verify(stockTransactionRepository, never()).save(any());
    }

    @Test
    void completeUsesLiveStockQuantityNotStaleSnapshot() {
        // Line was added when stock was 10 (system_quantity_at_add = 10), but a concurrent
        // stock-in bumped the live product.stockQuantity to 14 before this session completes.
        Product product = product("Rose", 10);
        StockCount stockCount = stockCountSession(null);
        StockCountLine line = line(stockCount, product, 10);
        line.setCountedQuantity(16);

        // Simulate the concurrent stock-in that happened after the line was added.
        product.setStockQuantity(14);

        when(stockCountRepository.findByIdWithLines(stockCount.getId())).thenReturn(Optional.of(stockCount));

        stockCountService.complete(stockCount.getId());

        ArgumentCaptor<StockTransaction> captor = ArgumentCaptor.forClass(StockTransaction.class);
        verify(stockTransactionRepository).save(captor.capture());
        // delta must be computed against the live 14, not the stale snapshot of 10.
        assertEquals(2, captor.getValue().getQuantityChange());
        assertEquals(16, product.getStockQuantity());
    }

    @Test
    void cancelDeletesSessionWithoutTouchingStockOrLedger() {
        Product product = product("Rose", 10);
        StockCount stockCount = stockCountSession(null);
        StockCountLine line = line(stockCount, product, 10);
        line.setCountedQuantity(99);
        line.setCostPrice(BigDecimal.valueOf(500));

        when(stockCountRepository.findByIdWithLines(stockCount.getId())).thenReturn(Optional.of(stockCount));

        stockCountService.cancel(stockCount.getId());

        verify(stockCountRepository).delete(stockCount);
        verify(stockTransactionRepository, never()).save(any());
        assertEquals(10, product.getStockQuantity());
    }

    @Test
    void cannotCompleteAnAlreadyCompletedSession() {
        StockCount stockCount = stockCountSession(null);
        stockCount.setCompletedAt(java.time.Instant.now());

        when(stockCountRepository.findByIdWithLines(stockCount.getId())).thenReturn(Optional.of(stockCount));

        assertThrows(BusinessException.class, () -> stockCountService.complete(stockCount.getId()));
    }

    private static Product product(String name, int stock) {
        Product product = new Product(name, BigDecimal.valueOf(250_000), stock);
        setId(product, UUID.randomUUID());
        return product;
    }

    private static StockCount stockCountSession(String note) {
        StockCount stockCount = new StockCount(note);
        setId(stockCount, UUID.randomUUID());
        return stockCount;
    }

    private static StockCountLine line(StockCount stockCount, Product product, int systemQuantityAtAdd) {
        StockCountLine line = new StockCountLine(product, systemQuantityAtAdd);
        setId(line, UUID.randomUUID());
        stockCount.addLine(line);
        return line;
    }

    private static void setId(Object entity, UUID id) {
        try {
            Field field = entity.getClass().getDeclaredField("id");
            field.setAccessible(true);
            field.set(entity, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
