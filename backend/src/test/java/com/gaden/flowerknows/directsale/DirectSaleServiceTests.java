package com.gaden.flowerknows.directsale;

import com.gaden.flowerknows.common.BatchLineException;
import com.gaden.flowerknows.customer.CustomerService;
import com.gaden.flowerknows.order.OrderRepository;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.product.ProductRepository;
import com.gaden.flowerknows.report.ReportDtos;
import com.gaden.flowerknows.report.ReportService;
import com.gaden.flowerknows.campaign.CampaignParticipantRepository;
import com.gaden.flowerknows.campaign.CampaignPoolRepository;
import com.gaden.flowerknows.campaign.CampaignRepository;
import com.gaden.flowerknows.exchange.ExchangeTransactionRepository;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransaction;
import com.gaden.flowerknows.stock.StockTransactionRepository;
import com.gaden.flowerknows.stock.StockTransactionType;
import com.gaden.flowerknows.token.ItemTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DirectSaleServiceTests {

    @Mock
    private DirectSaleRepository directSaleRepository;
    @Mock
    private ProductRepository productRepository;
    @Mock
    private CustomerService customerService;
    @Mock
    private StockTransactionRepository stockTransactionRepository;
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private ItemTokenRepository itemTokenRepository;
    @Mock
    private ExchangeTransactionRepository exchangeRepository;
    @Mock
    private CampaignPoolRepository campaignPoolRepository;
    @Mock
    private CampaignRepository campaignRepository;
    @Mock
    private CampaignParticipantRepository participantRepository;

    private StockService stockService;
    private DirectSaleService directSaleService;
    private ReportService reportService;

    @BeforeEach
    void setUp() {
        stockService = new StockService(stockTransactionRepository);
        directSaleService = new DirectSaleService(
                directSaleRepository,
                productRepository,
                customerService,
                stockService
        );
        reportService = new ReportService(
                productRepository,
                campaignPoolRepository,
                campaignRepository,
                participantRepository,
                orderRepository,
                itemTokenRepository,
                exchangeRepository,
                stockTransactionRepository,
                directSaleRepository,
                5
        );

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
    void createRejectsAtomicallyWhenAnyLineExceedsStock() {
        Product lipstick = product("Lipstick", 5, BigDecimal.valueOf(50_000));
        Product blush = product("Blush", 10, BigDecimal.valueOf(40_000));
        when(productRepository.findAllById(anyCollection()))
                .thenReturn(List.of(lipstick, blush));

        BatchLineException ex = assertThrows(
                BatchLineException.class,
                () -> directSaleService.create(new DirectSaleDtos.CreateDirectSaleRequest(
                        null,
                        List.of(
                                new DirectSaleDtos.CreateDirectSaleLineRequest(
                                        lipstick.getId(), 3, BigDecimal.valueOf(100_000)
                                ),
                                new DirectSaleDtos.CreateDirectSaleLineRequest(
                                        blush.getId(), 12, BigDecimal.valueOf(80_000)
                                )
                        )
                ))
        );

        assertEquals(1, ex.getLineErrors().size());
        assertEquals(1, ex.getLineErrors().getFirst().lineIndex());
        assertTrue(ex.getLineErrors().getFirst().message().contains("Blush"));
        assertTrue(ex.getLineErrors().getFirst().message().contains("10"));
        assertEquals(5, lipstick.getStockQuantity());
        assertEquals(10, blush.getStockQuantity());
        verify(directSaleRepository, never()).save(any());
        verify(stockTransactionRepository, never()).save(any());
    }

    @Test
    void createDeductsStockWritesLedgerAndComputesMargin() {
        Product lipstick = product("Lipstick", 10, BigDecimal.valueOf(50_000));
        when(productRepository.findAllById(anyCollection())).thenReturn(List.of(lipstick));
        when(directSaleRepository.save(any(DirectSale.class))).thenAnswer(invocation -> {
            DirectSale sale = invocation.getArgument(0);
            setId(sale, UUID.randomUUID());
            for (DirectSaleLine line : sale.getLines()) {
                setId(line, UUID.randomUUID());
            }
            return sale;
        });

        DirectSaleDtos.DirectSaleResponse response = directSaleService.create(
                new DirectSaleDtos.CreateDirectSaleRequest(
                        null,
                        List.of(new DirectSaleDtos.CreateDirectSaleLineRequest(
                                lipstick.getId(), 2, BigDecimal.valueOf(100_000)
                        ))
                )
        );

        assertEquals(8, lipstick.getStockQuantity());
        assertEquals(0, BigDecimal.valueOf(200_000).compareTo(response.recognizedRevenue()));
        assertEquals(0, BigDecimal.valueOf(100_000).compareTo(response.totalCost()));
        assertEquals(0, BigDecimal.valueOf(100_000).compareTo(response.grossMargin()));

        ArgumentCaptor<StockTransaction> captor = ArgumentCaptor.forClass(StockTransaction.class);
        verify(stockTransactionRepository).save(captor.capture());
        assertEquals(StockTransactionType.DIRECT_SALE, captor.getValue().getType());
        assertEquals(-2, captor.getValue().getQuantityChange());
    }

    @Test
    void cancelRestoresStockWritesLedgerAndDeletesSale() {
        Product lipstick = product("Lipstick", 8, BigDecimal.valueOf(50_000));
        UUID saleId = UUID.randomUUID();
        DirectSale sale = new DirectSale(
                null,
                BigDecimal.valueOf(200_000),
                BigDecimal.valueOf(100_000),
                BigDecimal.valueOf(100_000)
        );
        setId(sale, saleId);
        DirectSaleLine line = new DirectSaleLine(
                lipstick, 2, BigDecimal.valueOf(100_000), BigDecimal.valueOf(50_000)
        );
        sale.addLine(line);

        when(directSaleRepository.findByIdWithLines(saleId)).thenReturn(Optional.of(sale));

        directSaleService.cancel(saleId);

        assertEquals(10, lipstick.getStockQuantity());
        ArgumentCaptor<StockTransaction> captor = ArgumentCaptor.forClass(StockTransaction.class);
        verify(stockTransactionRepository).save(captor.capture());
        assertEquals(StockTransactionType.DIRECT_SALE, captor.getValue().getType());
        assertEquals(2, captor.getValue().getQuantityChange());
        assertEquals(DirectSaleService.CANCELLED_NOTE, captor.getValue().getNote());
        verify(directSaleRepository).delete(sale);
    }

    @Test
    void cancelRemovesSaleFromRevenueTotals() {
        LocalDate day = LocalDate.of(2026, 8, 1);
        Instant from = day.atStartOfDay().toInstant(java.time.ZoneOffset.UTC);
        Instant to = day.plusDays(1).atStartOfDay().toInstant(java.time.ZoneOffset.UTC);

        when(orderRepository.sumRecognizedRevenueBetween(from, to)).thenReturn(BigDecimal.valueOf(300_000));
        when(itemTokenRepository.sumCancelledTokenValueBetween(from, to)).thenReturn(BigDecimal.valueOf(50_000));
        when(directSaleRepository.sumRecognizedRevenueBetween(from, to))
                .thenReturn(BigDecimal.valueOf(200_000))
                .thenReturn(BigDecimal.ZERO);
        when(orderRepository.sumGrossMarginBetween(from, to)).thenReturn(BigDecimal.valueOf(120_000));
        when(directSaleRepository.sumGrossMarginBetween(from, to))
                .thenReturn(BigDecimal.valueOf(100_000))
                .thenReturn(BigDecimal.ZERO);
        when(orderRepository.countOrdersWithNullCostBasisBetween(from, to)).thenReturn(0L);
        when(exchangeRepository.sumActualRefundBetween(from, to)).thenReturn(BigDecimal.ZERO);
        when(participantRepository.sumAllPrepaidAmount()).thenReturn(BigDecimal.ZERO);
        when(itemTokenRepository.sumHoldingTokenValue()).thenReturn(BigDecimal.ZERO);
        when(orderRepository.sumAllRecognizedRevenue()).thenReturn(BigDecimal.ZERO);
        when(itemTokenRepository.sumAllCancelledTokenValue()).thenReturn(BigDecimal.ZERO);
        when(exchangeRepository.sumAllActualRefund()).thenReturn(BigDecimal.ZERO);

        ReportDtos.RevenueReportResponse before = reportService.revenueReport(day, day, null);
        assertEquals(0, BigDecimal.valueOf(550_000).compareTo(before.totalRevenue()));
        assertEquals(0, BigDecimal.valueOf(200_000).compareTo(before.revenueFromDirectSales()));
        assertEquals(0, BigDecimal.valueOf(270_000).compareTo(before.totalGrossMargin()));

        // Simulate cancel: repository aggregates no longer include the deleted sale
        ReportDtos.RevenueReportResponse after = reportService.revenueReport(day, day, null);
        assertEquals(0, BigDecimal.valueOf(350_000).compareTo(after.totalRevenue()));
        assertEquals(0, BigDecimal.ZERO.compareTo(after.revenueFromDirectSales()));
        assertEquals(0, BigDecimal.valueOf(170_000).compareTo(after.totalGrossMargin()));
    }

    @Test
    void revenueReportSumsOrdersCancelledTokensAndDirectSales() {
        LocalDate day = LocalDate.of(2026, 8, 1);
        Instant from = day.atStartOfDay().toInstant(java.time.ZoneOffset.UTC);
        Instant to = day.plusDays(1).atStartOfDay().toInstant(java.time.ZoneOffset.UTC);

        when(orderRepository.sumRecognizedRevenueBetween(from, to)).thenReturn(BigDecimal.valueOf(100_000));
        when(itemTokenRepository.sumCancelledTokenValueBetween(from, to)).thenReturn(BigDecimal.valueOf(20_000));
        when(directSaleRepository.sumRecognizedRevenueBetween(from, to)).thenReturn(BigDecimal.valueOf(30_000));
        when(orderRepository.sumGrossMarginBetween(from, to)).thenReturn(BigDecimal.valueOf(40_000));
        when(directSaleRepository.sumGrossMarginBetween(from, to)).thenReturn(BigDecimal.valueOf(15_000));
        when(orderRepository.countOrdersWithNullCostBasisBetween(from, to)).thenReturn(0L);
        when(exchangeRepository.sumActualRefundBetween(from, to)).thenReturn(BigDecimal.ZERO);
        when(participantRepository.sumAllPrepaidAmount()).thenReturn(BigDecimal.ZERO);
        when(itemTokenRepository.sumHoldingTokenValue()).thenReturn(BigDecimal.ZERO);
        when(orderRepository.sumAllRecognizedRevenue()).thenReturn(BigDecimal.valueOf(100_000));
        when(itemTokenRepository.sumAllCancelledTokenValue()).thenReturn(BigDecimal.valueOf(20_000));
        when(exchangeRepository.sumAllActualRefund()).thenReturn(BigDecimal.ZERO);

        ReportDtos.RevenueReportResponse report = reportService.revenueReport(day, day, null);

        assertEquals(0, BigDecimal.valueOf(100_000).compareTo(report.revenueFromOrders()));
        assertEquals(0, BigDecimal.valueOf(20_000).compareTo(report.revenueFromCancelledTokens()));
        assertEquals(0, BigDecimal.valueOf(30_000).compareTo(report.revenueFromDirectSales()));
        assertEquals(0, BigDecimal.valueOf(150_000).compareTo(report.totalRevenue()));
        assertEquals(0, BigDecimal.valueOf(40_000).compareTo(report.orderGrossMargin()));
        assertEquals(0, BigDecimal.valueOf(20_000).compareTo(report.cancelledTokenMargin()));
        assertEquals(0, BigDecimal.valueOf(15_000).compareTo(report.directSaleGrossMargin()));
        assertEquals(0, BigDecimal.valueOf(75_000).compareTo(report.totalGrossMargin()));
    }

    @Test
    void profitOverviewIncludesDirectSaleRevenue() {
        when(stockTransactionRepository.sumCapitalInvestedFromStockIn()).thenReturn(BigDecimal.valueOf(500_000));
        when(orderRepository.sumAllRecognizedRevenue()).thenReturn(BigDecimal.valueOf(200_000));
        when(itemTokenRepository.sumAllCancelledTokenValue()).thenReturn(BigDecimal.valueOf(50_000));
        when(directSaleRepository.sumAllRecognizedRevenue()).thenReturn(BigDecimal.valueOf(75_000));

        ReportDtos.ProfitOverviewResponse overview = reportService.profitOverview();

        assertEquals(0, BigDecimal.valueOf(325_000).compareTo(overview.totalRevenue()));
        assertEquals(0, BigDecimal.valueOf(75_000).compareTo(overview.revenueFromDirectSales()));
        assertEquals(0, BigDecimal.valueOf(-175_000).compareTo(overview.totalProfit()));
        verify(directSaleRepository, times(1)).sumAllRecognizedRevenue();
    }

    private static Product product(String name, int stock, BigDecimal averageCost) {
        Product product = new Product(name, BigDecimal.valueOf(100_000), stock);
        product.setAverageCostPrice(averageCost);
        setId(product, UUID.randomUUID());
        return product;
    }

    private static void setId(Object entity, UUID id) {
        try {
            Field idField = entity.getClass().getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(entity, id);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }
}
