package com.gaden.flowerknows.stock;

import com.gaden.flowerknows.product.Product;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StockInUndoServiceTests {

    @Mock
    private StockTransactionRepository stockTransactionRepository;

    private StockService stockService;

    @BeforeEach
    void setUp() {
        stockService = new StockService(stockTransactionRepository);
        lenient().when(stockTransactionRepository.save(any(StockTransaction.class)))
                .thenAnswer(invocation -> {
                    StockTransaction tx = invocation.getArgument(0);
                    if (tx.getId() == null) {
                        setId(tx, UUID.randomUUID());
                    }
                    return tx;
                });
    }

    @Test
    void applyStockInCapturesAverageCostPriceBefore() {
        Product product = product("Rose", 10);
        product.setAverageCostPrice(BigDecimal.valueOf(100));

        stockService.applyStockIn(product, 10, BigDecimal.valueOf(200), "batch");

        ArgumentCaptor<StockTransaction> captor = ArgumentCaptor.forClass(StockTransaction.class);
        verify(stockTransactionRepository).save(captor.capture());
        assertEquals(0, BigDecimal.valueOf(100).compareTo(captor.getValue().getAverageCostPriceBefore()));
        assertEquals(0, BigDecimal.valueOf(150.00).setScale(2).compareTo(product.getAverageCostPrice()));
        assertEquals(20, product.getStockQuantity());
    }

    @Test
    void applyStockInFirstBatchHasNullAverageCostPriceBefore() {
        Product product = product("Rose", 0);

        stockService.applyStockIn(product, 5, BigDecimal.valueOf(80), "Initial stock");

        ArgumentCaptor<StockTransaction> captor = ArgumentCaptor.forClass(StockTransaction.class);
        verify(stockTransactionRepository).save(captor.capture());
        assertNull(captor.getValue().getAverageCostPriceBefore());
        assertEquals(0, BigDecimal.valueOf(80).compareTo(product.getAverageCostPrice()));
        assertEquals(5, product.getStockQuantity());
    }

    @Test
    void undoRevertsQuantityAndAverageCostAndDeletesRow() {
        Product product = product("Rose", 20);
        product.setAverageCostPrice(BigDecimal.valueOf(150.00).setScale(2));

        UUID txId = UUID.randomUUID();
        StockTransaction tx = new StockTransaction(
                product,
                StockTransactionType.STOCK_IN,
                10,
                BigDecimal.valueOf(200),
                BigDecimal.valueOf(100),
                "batch"
        );
        setId(tx, txId);
        setCreatedAt(tx, Instant.parse("2026-07-01T10:00:00Z"));

        when(stockTransactionRepository.findByIdWithProduct(txId)).thenReturn(Optional.of(tx));
        when(stockTransactionRepository.existsNewerStockIn(eq(product.getId()), any(), eq(txId)))
                .thenReturn(false);

        stockService.undoStockIn(txId);

        assertEquals(10, product.getStockQuantity());
        assertEquals(0, BigDecimal.valueOf(100).compareTo(product.getAverageCostPrice()));
        verify(stockTransactionRepository).delete(tx);
    }

    @Test
    void undoFirstStockInClearsAverageCost() {
        Product product = product("Rose", 5);
        product.setAverageCostPrice(BigDecimal.valueOf(80));

        UUID txId = UUID.randomUUID();
        StockTransaction tx = new StockTransaction(
                product,
                StockTransactionType.STOCK_IN,
                5,
                BigDecimal.valueOf(80),
                null,
                "Initial stock"
        );
        setId(tx, txId);
        setCreatedAt(tx, Instant.parse("2026-07-01T10:00:00Z"));

        when(stockTransactionRepository.findByIdWithProduct(txId)).thenReturn(Optional.of(tx));
        when(stockTransactionRepository.existsNewerStockIn(eq(product.getId()), any(), eq(txId)))
                .thenReturn(false);

        stockService.undoStockIn(txId);

        assertEquals(0, product.getStockQuantity());
        assertNull(product.getAverageCostPrice());
        verify(stockTransactionRepository).delete(tx);
    }

    @Test
    void undoBlockedWhenNewerStockInExists() {
        Product product = product("Rose", 25);
        product.setAverageCostPrice(BigDecimal.valueOf(130));

        UUID txId = UUID.randomUUID();
        StockTransaction tx = new StockTransaction(
                product,
                StockTransactionType.STOCK_IN,
                10,
                BigDecimal.valueOf(200),
                BigDecimal.valueOf(100),
                "older"
        );
        setId(tx, txId);
        setCreatedAt(tx, Instant.parse("2026-07-01T10:00:00Z"));

        when(stockTransactionRepository.findByIdWithProduct(txId)).thenReturn(Optional.of(tx));
        when(stockTransactionRepository.existsNewerStockIn(eq(product.getId()), any(), eq(txId)))
                .thenReturn(true);

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> stockService.undoStockIn(txId)
        );
        assertTrue(ex.getMessage().contains("gần nhất"));
        assertEquals(25, product.getStockQuantity());
        assertEquals(0, BigDecimal.valueOf(130).compareTo(product.getAverageCostPrice()));
        verify(stockTransactionRepository, never()).delete(any());
    }

    @Test
    void undoBlockedWhenStockWouldGoNegative() {
        Product product = product("Rose", 3);
        product.setAverageCostPrice(BigDecimal.valueOf(150));

        UUID txId = UUID.randomUUID();
        StockTransaction tx = new StockTransaction(
                product,
                StockTransactionType.STOCK_IN,
                10,
                BigDecimal.valueOf(200),
                BigDecimal.valueOf(100),
                "batch"
        );
        setId(tx, txId);
        setCreatedAt(tx, Instant.parse("2026-07-01T10:00:00Z"));

        when(stockTransactionRepository.findByIdWithProduct(txId)).thenReturn(Optional.of(tx));
        when(stockTransactionRepository.existsNewerStockIn(eq(product.getId()), any(), eq(txId)))
                .thenReturn(false);

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> stockService.undoStockIn(txId)
        );
        assertEquals(StockService.UNDO_WOULD_GO_NEGATIVE_MESSAGE, ex.getMessage());
        assertEquals(3, product.getStockQuantity());
        verify(stockTransactionRepository, never()).delete(any());
    }

    @Test
    void undoneRowNoLongerAppearsInMovementHistoryQuery() {
        Product product = product("Rose", 20);
        product.setAverageCostPrice(BigDecimal.valueOf(150));

        UUID txId = UUID.randomUUID();
        StockTransaction tx = new StockTransaction(
                product,
                StockTransactionType.STOCK_IN,
                10,
                BigDecimal.valueOf(200),
                BigDecimal.valueOf(100),
                "batch"
        );
        setId(tx, txId);
        setCreatedAt(tx, Instant.parse("2026-07-01T10:00:00Z"));

        when(stockTransactionRepository.findByIdWithProduct(txId)).thenReturn(Optional.of(tx));
        when(stockTransactionRepository.existsNewerStockIn(eq(product.getId()), any(), eq(txId)))
                .thenReturn(false);
        when(stockTransactionRepository.findByProductIdOrderByCreatedAtDesc(product.getId()))
                .thenReturn(List.of())
                .thenReturn(List.of());

        stockService.undoStockIn(txId);

        verify(stockTransactionRepository).delete(tx);
        List<StockTransaction> history =
                stockTransactionRepository.findByProductIdOrderByCreatedAtDesc(product.getId());
        assertTrue(history.stream().noneMatch(row -> txId.equals(row.getId())));
        assertTrue(history.isEmpty());
    }

    private static Product product(String name, int stock) {
        Product product = new Product(name, BigDecimal.valueOf(250_000), stock);
        setId(product, UUID.randomUUID());
        return product;
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

    private static void setCreatedAt(StockTransaction tx, Instant createdAt) {
        try {
            Field field = StockTransaction.class.getDeclaredField("createdAt");
            field.setAccessible(true);
            field.set(tx, createdAt);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
