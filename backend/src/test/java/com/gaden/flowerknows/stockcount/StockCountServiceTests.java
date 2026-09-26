package com.gaden.flowerknows.stockcount;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.common.ResourceNotFoundException;
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
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
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

    // --- US-39 AC #9: bulk add ---

    @Test
    void bulkAddAddsAllNewProductsWithCountAtAddTime() {
        Product rose = product("Rose", 10);
        Product tulip = product("Tulip", 4);
        StockCount stockCount = inProgress();
        stubProducts(rose, tulip);

        StockCountDtos.BulkAddLinesResponse response = stockCountService.addLinesBulk(
                stockCount.getId(),
                new StockCountDtos.BulkAddLinesRequest(List.of(
                        new StockCountDtos.BulkAddLineItem(rose.getId(), 12, BigDecimal.valueOf(150), "shelf A"),
                        new StockCountDtos.BulkAddLineItem(tulip.getId(), null, null, null)
                ))
        );

        assertEquals(2, response.added().size());
        assertTrue(response.skippedProductIds().isEmpty());
        assertEquals(2, stockCount.getLines().size());
        StockCountLine roseLine = stockCount.getLines().get(0);
        assertEquals(rose, roseLine.getProduct());
        assertEquals(10, roseLine.getSystemQuantityAtAdd());
        assertEquals(12, roseLine.getCountedQuantity());
        assertEquals(0, BigDecimal.valueOf(150).compareTo(roseLine.getCostPrice()));
        assertEquals("shelf A", roseLine.getNote());
        assertNull(stockCount.getLines().get(1).getCountedQuantity());
        verify(stockCountRepository).save(stockCount);
    }

    @Test
    void bulkAddSkipsProductsAlreadyInSessionAndAddsTheRest() {
        Product rose = product("Rose", 10);
        Product tulip = product("Tulip", 4);
        StockCount stockCount = inProgress();
        line(stockCount, rose, 10);
        stubProducts(tulip);

        StockCountDtos.BulkAddLinesResponse response = stockCountService.addLinesBulk(
                stockCount.getId(),
                new StockCountDtos.BulkAddLinesRequest(List.of(
                        new StockCountDtos.BulkAddLineItem(rose.getId(), 5, null, null),
                        new StockCountDtos.BulkAddLineItem(tulip.getId(), 3, null, null)
                ))
        );

        assertEquals(List.of(rose.getId()), response.skippedProductIds());
        assertEquals(1, response.added().size());
        assertEquals(tulip.getId(), response.added().get(0).productId());
        assertEquals(2, stockCount.getLines().size());
        // the existing line must not be touched by the skipped row
        assertNull(stockCount.getLines().get(0).getCountedQuantity());
    }

    @Test
    void bulkAddRejectsDuplicateProductWithinRequestBeforeCreatingAnything() {
        Product rose = product("Rose", 10);
        StockCount stockCount = inProgress();

        assertThrows(BusinessException.class, () -> stockCountService.addLinesBulk(
                stockCount.getId(),
                new StockCountDtos.BulkAddLinesRequest(List.of(
                        new StockCountDtos.BulkAddLineItem(rose.getId(), 1, null, null),
                        new StockCountDtos.BulkAddLineItem(rose.getId(), 2, null, null)
                ))
        ));

        assertTrue(stockCount.getLines().isEmpty());
        verify(productRepository, never()).findById(any());
        verify(stockCountRepository, never()).save(any());
    }

    @Test
    void bulkAddWithInvalidCostPriceAddsNothing() {
        Product rose = product("Rose", 10);
        Product tulip = product("Tulip", 4);
        StockCount stockCount = inProgress();
        stubProducts(rose, tulip);

        assertThrows(BusinessException.class, () -> stockCountService.addLinesBulk(
                stockCount.getId(),
                new StockCountDtos.BulkAddLinesRequest(List.of(
                        new StockCountDtos.BulkAddLineItem(rose.getId(), 12, null, null),
                        new StockCountDtos.BulkAddLineItem(tulip.getId(), 5, BigDecimal.ZERO, null)
                ))
        ));

        assertTrue(stockCount.getLines().isEmpty());
        verify(stockCountRepository, never()).save(any());
    }

    @Test
    void bulkAddWithUnknownProductAddsNothing() {
        Product rose = product("Rose", 10);
        UUID unknown = UUID.randomUUID();
        StockCount stockCount = inProgress();
        stubProducts(rose);
        when(productRepository.findById(unknown)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> stockCountService.addLinesBulk(
                stockCount.getId(),
                new StockCountDtos.BulkAddLinesRequest(List.of(
                        new StockCountDtos.BulkAddLineItem(rose.getId(), 12, null, null),
                        new StockCountDtos.BulkAddLineItem(unknown, 1, null, null)
                ))
        ));

        assertTrue(stockCount.getLines().isEmpty());
        verify(stockCountRepository, never()).save(any());
    }

    @Test
    void bulkAddRejectsCompletedSession() {
        Product rose = product("Rose", 10);
        StockCount stockCount = completed();

        assertThrows(BusinessException.class, () -> stockCountService.addLinesBulk(
                stockCount.getId(),
                new StockCountDtos.BulkAddLinesRequest(List.of(
                        new StockCountDtos.BulkAddLineItem(rose.getId(), 1, null, null)
                ))
        ));
        assertTrue(stockCount.getLines().isEmpty());
    }

    // --- US-39 AC #10: bulk update ---

    @Test
    void bulkUpdateUpdatesManyLinesInOneCall() {
        StockCount stockCount = inProgress();
        StockCountLine rose = line(stockCount, product("Rose", 10), 10);
        StockCountLine tulip = line(stockCount, product("Tulip", 4), 4);
        tulip.setNote("keep me");

        StockCountDtos.StockCountDetailResponse response = stockCountService.updateLinesBulk(
                stockCount.getId(),
                new StockCountDtos.BulkUpdateLinesRequest(List.of(
                        new StockCountDtos.BulkUpdateLineItem(rose.getId(), 15, BigDecimal.valueOf(200), "extra box"),
                        new StockCountDtos.BulkUpdateLineItem(tulip.getId(), 3, null, null)
                ))
        );

        assertEquals(15, rose.getCountedQuantity());
        assertEquals(0, BigDecimal.valueOf(200).compareTo(rose.getCostPrice()));
        assertEquals("extra box", rose.getNote());
        assertEquals(3, tulip.getCountedQuantity());
        assertEquals("keep me", tulip.getNote()); // null = don't change
        assertEquals(2, response.lines().size());
    }

    @Test
    void bulkUpdateRejectsLineFromAnotherSession() {
        StockCount stockCount = inProgress();
        StockCountLine rose = line(stockCount, product("Rose", 10), 10);
        StockCount other = stockCountSession(null);
        StockCountLine foreign = line(other, product("Tulip", 4), 4);

        assertThrows(ResourceNotFoundException.class, () -> stockCountService.updateLinesBulk(
                stockCount.getId(),
                new StockCountDtos.BulkUpdateLinesRequest(List.of(
                        new StockCountDtos.BulkUpdateLineItem(rose.getId(), 15, null, null),
                        new StockCountDtos.BulkUpdateLineItem(foreign.getId(), 3, null, null)
                ))
        ));

        assertNull(rose.getCountedQuantity());
        assertNull(foreign.getCountedQuantity());
    }

    @Test
    void bulkUpdateWithOneInvalidItemChangesNothing() {
        StockCount stockCount = inProgress();
        StockCountLine rose = line(stockCount, product("Rose", 10), 10);
        StockCountLine tulip = line(stockCount, product("Tulip", 4), 4);

        assertThrows(BusinessException.class, () -> stockCountService.updateLinesBulk(
                stockCount.getId(),
                new StockCountDtos.BulkUpdateLinesRequest(List.of(
                        new StockCountDtos.BulkUpdateLineItem(rose.getId(), 15, null, "counted"),
                        new StockCountDtos.BulkUpdateLineItem(tulip.getId(), -1, null, null)
                ))
        ));

        assertNull(rose.getCountedQuantity());
        assertNull(rose.getNote());
        assertNull(tulip.getCountedQuantity());
    }

    @Test
    void bulkUpdateRejectsCompletedSession() {
        StockCount stockCount = completed();
        StockCountLine rose = line(stockCount, product("Rose", 10), 10);

        assertThrows(BusinessException.class, () -> stockCountService.updateLinesBulk(
                stockCount.getId(),
                new StockCountDtos.BulkUpdateLinesRequest(List.of(
                        new StockCountDtos.BulkUpdateLineItem(rose.getId(), 15, null, null)
                ))
        ));
        assertNull(rose.getCountedQuantity());
    }

    // --- US-39 AC #11: newest-first ---

    @Test
    void detailListsLinesNewestFirst() {
        StockCount stockCount = inProgress();
        StockCountLine oldest = line(stockCount, product("Rose", 1), 1);
        StockCountLine middle = line(stockCount, product("Tulip", 1), 1);
        StockCountLine newest = line(stockCount, product("Lily", 1), 1);
        Instant now = Instant.now();
        setField(oldest, "createdAt", now.minusSeconds(20));
        setField(middle, "createdAt", now.minusSeconds(10));
        setField(newest, "createdAt", now);

        List<UUID> ids = stockCountService.getDetail(stockCount.getId()).lines().stream()
                .map(StockCountDtos.StockCountLineResponse::id)
                .toList();

        assertEquals(List.of(newest.getId(), middle.getId(), oldest.getId()), ids);
    }

    @Test
    void bulkAddedLinesComeBeforeExistingOnesInDetail() {
        StockCount stockCount = inProgress();
        StockCountLine existing = line(stockCount, product("Rose", 1), 1);
        setField(existing, "createdAt", Instant.now().minusSeconds(60));
        Product tulip = product("Tulip", 4);
        stubProducts(tulip);

        stockCountService.addLinesBulk(stockCount.getId(), new StockCountDtos.BulkAddLinesRequest(List.of(
                new StockCountDtos.BulkAddLineItem(tulip.getId(), null, null, null)
        )));

        List<StockCountDtos.StockCountLineResponse> lines = stockCountService.getDetail(stockCount.getId()).lines();
        assertEquals(tulip.getId(), lines.get(0).productId());
        assertEquals(existing.getId(), lines.get(1).id());
    }

    @Test
    void equalTimestampsFallBackToIdOrder() {
        StockCount stockCount = inProgress();
        StockCountLine a = line(stockCount, product("Rose", 1), 1);
        StockCountLine b = line(stockCount, product("Tulip", 1), 1);
        Instant same = Instant.now();
        setField(a, "createdAt", same);
        setField(b, "createdAt", same);

        List<UUID> ids = stockCountService.getDetail(stockCount.getId()).lines().stream()
                .map(StockCountDtos.StockCountLineResponse::id)
                .toList();

        assertEquals(List.of(a.getId(), b.getId()).stream().sorted().toList(), ids);
    }

    private static void setField(Object entity, String name, Object value) {
        try {
            Field field = entity.getClass().getDeclaredField(name);
            field.setAccessible(true);
            field.set(entity, value);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    private StockCount inProgress() {
        StockCount stockCount = stockCountSession(null);
        when(stockCountRepository.findByIdWithLines(stockCount.getId())).thenReturn(Optional.of(stockCount));
        return stockCount;
    }

    private StockCount completed() {
        StockCount stockCount = inProgress();
        stockCount.setCompletedAt(java.time.Instant.now());
        return stockCount;
    }

    private void stubProducts(Product... products) {
        for (Product product : products) {
            lenient().when(productRepository.findById(product.getId())).thenReturn(Optional.of(product));
        }
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
