package com.gaden.flowerknows.exchange;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.customer.Customer;
import com.gaden.flowerknows.customer.CustomerService;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.product.ProductRepository;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransaction;
import com.gaden.flowerknows.stock.StockTransactionRepository;
import com.gaden.flowerknows.stock.StockTransactionType;
import com.gaden.flowerknows.token.ItemToken;
import com.gaden.flowerknows.token.ItemTokenRepository;
import com.gaden.flowerknows.token.SourceType;
import com.gaden.flowerknows.token.TokenStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExchangeServiceUndoTests {

    @Mock
    private ExchangeTransactionRepository exchangeRepository;
    @Mock
    private ItemTokenRepository itemTokenRepository;
    @Mock
    private ProductRepository productRepository;
    @Mock
    private CustomerService customerService;
    @Mock
    private StockTransactionRepository stockTransactionRepository;

    private ExchangeService exchangeService;

    @BeforeEach
    void setUp() {
        StockService stockService = new StockService(stockTransactionRepository);
        exchangeService = new ExchangeService(
                exchangeRepository,
                itemTokenRepository,
                productRepository,
                customerService,
                stockService
        );
        lenient().when(stockTransactionRepository.save(any(StockTransaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(exchangeRepository.saveAndFlush(any(ExchangeTransaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void undoItemExchangeFullyReversesBothSides() {
        UUID exchangeId = UUID.randomUUID();
        Customer customer = customer("Lan");
        Product oldProduct = product("Old Item", 5);
        Product newProduct = product("New Item", 2);

        ItemToken tokenIn = token(oldProduct, customer, TokenStatus.EXCHANGED, SourceType.CAMPAIGN);
        ItemToken tokenOut = token(newProduct, customer, TokenStatus.HOLDING, SourceType.EXCHANGE);
        setId(tokenOut, UUID.randomUUID());
        // sourceId would be exchange id for out tokens in production
        ExchangeTransaction tx = ExchangeTransaction.itemExchange(customer, BigDecimal.ZERO);
        setId(tx, exchangeId);
        tx.getTokensIn().add(tokenIn);
        tx.getTokensOut().add(tokenOut);

        when(exchangeRepository.findById(exchangeId)).thenReturn(Optional.of(tx));

        exchangeService.undoItemExchange(exchangeId);

        assertEquals(TokenStatus.HOLDING, tokenIn.getStatus());
        assertEquals(4, oldProduct.getStockQuantity()); // 5 - 1
        assertEquals(3, newProduct.getStockQuantity()); // 2 + 1
        assertTrue(tx.getTokensIn().isEmpty());
        assertTrue(tx.getTokensOut().isEmpty());

        verify(itemTokenRepository).delete(tokenOut);
        verify(exchangeRepository).delete(tx);

        ArgumentCaptor<StockTransaction> captor = ArgumentCaptor.forClass(StockTransaction.class);
        verify(stockTransactionRepository, times(2)).save(captor.capture());
        List<StockTransaction> rows = captor.getAllValues();
        assertEquals(StockTransactionType.EXCHANGE_UNDO_RETURN, rows.get(0).getType());
        assertEquals(1, rows.get(0).getQuantityChange());
        assertEquals(StockTransactionType.EXCHANGE_UNDO_REMOVE, rows.get(1).getType());
        assertEquals(-1, rows.get(1).getQuantityChange());
    }

    @Test
    void undoBlockedWhenReceivedTokenNoLongerHolding() {
        UUID exchangeId = UUID.randomUUID();
        Customer customer = customer("Lan");
        Product oldProduct = product("Old Item", 5);
        Product newProduct = product("New Item", 2);

        ItemToken tokenIn = token(oldProduct, customer, TokenStatus.EXCHANGED, SourceType.CAMPAIGN);
        ItemToken tokenOut = token(newProduct, customer, TokenStatus.ORDERED, SourceType.EXCHANGE);
        ExchangeTransaction tx = ExchangeTransaction.itemExchange(customer, BigDecimal.ZERO);
        setId(tx, exchangeId);
        tx.getTokensIn().add(tokenIn);
        tx.getTokensOut().add(tokenOut);

        when(exchangeRepository.findById(exchangeId)).thenReturn(Optional.of(tx));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> exchangeService.undoItemExchange(exchangeId)
        );
        assertTrue(ex.getMessage().contains("Không thể hoàn tác"));
        assertEquals(TokenStatus.EXCHANGED, tokenIn.getStatus());
        assertEquals(5, oldProduct.getStockQuantity());
        assertEquals(2, newProduct.getStockQuantity());
        verify(itemTokenRepository, never()).delete(any());
        verify(exchangeRepository, never()).delete(any());
        verify(stockTransactionRepository, never()).save(any());
    }

    @Test
    void undoBlockedWithNoPartialStockRowsWhenStockWouldGoNegative() {
        UUID exchangeId = UUID.randomUUID();
        Customer customer = customer("Lan");
        // Old product has 0 stock — cannot re-remove the original token's unit.
        Product oldProduct = product("Old Item", 0);
        Product newProduct = product("New Item", 2);

        ItemToken tokenIn = token(oldProduct, customer, TokenStatus.EXCHANGED, SourceType.CAMPAIGN);
        ItemToken tokenOut = token(newProduct, customer, TokenStatus.HOLDING, SourceType.EXCHANGE);
        ExchangeTransaction tx = ExchangeTransaction.itemExchange(customer, BigDecimal.ZERO);
        setId(tx, exchangeId);
        tx.getTokensIn().add(tokenIn);
        tx.getTokensOut().add(tokenOut);

        when(exchangeRepository.findById(exchangeId)).thenReturn(Optional.of(tx));

        BusinessException ex = assertThrows(
                BusinessException.class,
                () -> exchangeService.undoItemExchange(exchangeId)
        );
        assertTrue(ex.getMessage().contains("Không đủ hàng để hoàn tác"));
        assertTrue(ex.getMessage().contains("Old Item"));

        // Pre-check failed: nothing applied.
        assertEquals(TokenStatus.EXCHANGED, tokenIn.getStatus());
        assertEquals(0, oldProduct.getStockQuantity());
        assertEquals(2, newProduct.getStockQuantity());
        assertEquals(1, tx.getTokensIn().size());
        assertEquals(1, tx.getTokensOut().size());
        verify(itemTokenRepository, never()).delete(any());
        verify(exchangeRepository, never()).delete(any());
        verify(exchangeRepository, never()).saveAndFlush(any());
        verify(stockTransactionRepository, never()).save(any());
    }

    private ItemToken token(Product product, Customer customer, TokenStatus status, SourceType sourceType) {
        ItemToken token = new ItemToken(
                product,
                customer,
                BigDecimal.valueOf(100_000),
                BigDecimal.valueOf(40_000),
                sourceType,
                UUID.randomUUID()
        );
        setId(token, UUID.randomUUID());
        token.setStatus(status);
        return token;
    }

    private Product product(String name, int stock) {
        Product product = new Product(name, BigDecimal.valueOf(250_000), stock);
        setId(product, UUID.randomUUID());
        return product;
    }

    private Customer customer(String name) {
        Customer customer = new Customer(name, "0900000000", null);
        setId(customer, UUID.randomUUID());
        return customer;
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
