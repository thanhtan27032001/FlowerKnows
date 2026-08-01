package com.gaden.flowerknows.report;

import com.gaden.flowerknows.campaign.Campaign;
import com.gaden.flowerknows.campaign.CampaignParticipant;
import com.gaden.flowerknows.campaign.CampaignParticipantRepository;
import com.gaden.flowerknows.campaign.CampaignPoolRepository;
import com.gaden.flowerknows.campaign.CampaignRepository;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.directsale.DirectSaleRepository;
import com.gaden.flowerknows.exchange.ExchangeTransactionRepository;
import com.gaden.flowerknows.order.OrderRepository;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.product.ProductRepository;
import com.gaden.flowerknows.stock.StockTransactionRepository;
import com.gaden.flowerknows.token.ItemTokenRepository;
import com.gaden.flowerknows.token.TokenStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ReportService {

    private final ProductRepository productRepository;
    private final CampaignPoolRepository campaignPoolRepository;
    private final CampaignRepository campaignRepository;
    private final CampaignParticipantRepository participantRepository;
    private final OrderRepository orderRepository;
    private final ItemTokenRepository itemTokenRepository;
    private final ExchangeTransactionRepository exchangeRepository;
    private final StockTransactionRepository stockTransactionRepository;
    private final DirectSaleRepository directSaleRepository;
    private final int lowStockThreshold;

    public ReportService(
            ProductRepository productRepository,
            CampaignPoolRepository campaignPoolRepository,
            CampaignRepository campaignRepository,
            CampaignParticipantRepository participantRepository,
            OrderRepository orderRepository,
            ItemTokenRepository itemTokenRepository,
            ExchangeTransactionRepository exchangeRepository,
            StockTransactionRepository stockTransactionRepository,
            DirectSaleRepository directSaleRepository,
            @Value("${app.low-stock-threshold:5}") int lowStockThreshold
    ) {
        this.productRepository = productRepository;
        this.campaignPoolRepository = campaignPoolRepository;
        this.campaignRepository = campaignRepository;
        this.participantRepository = participantRepository;
        this.orderRepository = orderRepository;
        this.itemTokenRepository = itemTokenRepository;
        this.exchangeRepository = exchangeRepository;
        this.stockTransactionRepository = stockTransactionRepository;
        this.directSaleRepository = directSaleRepository;
        this.lowStockThreshold = lowStockThreshold;
    }

    @Transactional(readOnly = true)
    public List<ReportDtos.InventoryItemResponse> inventoryReport() {
        return productRepository.findAll().stream()
                .map(this::toInventoryItem)
                .toList();
    }

    @Transactional(readOnly = true)
    public ReportDtos.ProfitOverviewResponse profitOverview() {
        BigDecimal totalCapitalInvested = stockTransactionRepository.sumCapitalInvestedFromStockIn();
        BigDecimal revenueFromOrders = orderRepository.sumAllRecognizedRevenue();
        BigDecimal revenueFromCancelled = itemTokenRepository.sumAllCancelledTokenValue();
        BigDecimal revenueFromDirectSales = directSaleRepository.sumAllRecognizedRevenue();
        BigDecimal totalRevenue = revenueFromOrders.add(revenueFromCancelled).add(revenueFromDirectSales);
        BigDecimal totalProfit = totalRevenue.subtract(totalCapitalInvested);

        return new ReportDtos.ProfitOverviewResponse(
                totalCapitalInvested,
                totalRevenue,
                totalProfit,
                revenueFromOrders,
                revenueFromCancelled,
                revenueFromDirectSales,
                "Đây là số liệu theo cơ sở tiền mặt đơn giản, bao gồm toàn bộ chi phí nhập kho dù đã bán hay chưa. Để xem biên lợi nhuận khớp theo từng đơn, mở Báo cáo biên lợi nhuận."
        );
    }

    @Transactional(readOnly = true)
    public ReportDtos.RevenueReportResponse revenueReport(LocalDate fromDate, LocalDate toDate, UUID campaignId) {
        Instant from = fromDate.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant to = toDate.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);

        BigDecimal revenueFromOrders = orderRepository.sumRecognizedRevenueBetween(from, to);
        BigDecimal revenueFromCancelled = itemTokenRepository.sumCancelledTokenValueBetween(from, to);
        BigDecimal revenueFromDirectSales = directSaleRepository.sumRecognizedRevenueBetween(from, to);
        BigDecimal totalRevenue = revenueFromOrders.add(revenueFromCancelled).add(revenueFromDirectSales);
        BigDecimal orderGrossMargin = orderRepository.sumGrossMarginBetween(from, to);
        BigDecimal cancelledTokenMargin = revenueFromCancelled;
        BigDecimal directSaleGrossMargin = directSaleRepository.sumGrossMarginBetween(from, to);
        BigDecimal totalGrossMargin = orderGrossMargin.add(cancelledTokenMargin).add(directSaleGrossMargin);
        BigDecimal grossMarginPercent = totalRevenue.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : totalGrossMargin
                .multiply(BigDecimal.valueOf(100))
                .divide(totalRevenue, 2, java.math.RoundingMode.HALF_UP);
        long ordersWithMissingCostBasis = orderRepository.countOrdersWithNullCostBasisBetween(from, to);
        BigDecimal totalRefunded = exchangeRepository.sumActualRefundBetween(from, to);

        ReportDtos.ReconciliationResponse reconciliation = buildReconciliation();
        ReportDtos.CampaignBreakdownResponse campaignBreakdown = null;
        if (campaignId != null) {
            campaignBreakdown = buildCampaignBreakdown(campaignId);
        }

        return new ReportDtos.RevenueReportResponse(
                from,
                to,
                revenueFromOrders,
                revenueFromCancelled,
                revenueFromDirectSales,
                totalRevenue,
                orderGrossMargin,
                cancelledTokenMargin,
                directSaleGrossMargin,
                totalGrossMargin,
                grossMarginPercent,
                ordersWithMissingCostBasis,
                ordersWithMissingCostBasis > 0,
                totalRefunded,
                reconciliation,
                campaignBreakdown
        );
    }

    private ReportDtos.InventoryItemResponse toInventoryItem(Product product) {
        long locked = campaignPoolRepository.sumRemainingQuantityInOpenCampaigns(product.getId());
        return new ReportDtos.InventoryItemResponse(
                product.getId(),
                product.getName(),
                product.getStockQuantity(),
                locked,
                product.getStockQuantity() <= lowStockThreshold
        );
    }

    private ReportDtos.ReconciliationResponse buildReconciliation() {
        BigDecimal totalPrepaid = participantRepository.sumAllPrepaidAmount();
        BigDecimal holding = itemTokenRepository.sumHoldingTokenValue();
        BigDecimal orderRevenue = orderRepository.sumAllRecognizedRevenue();
        BigDecimal cancelledRevenue = itemTokenRepository.sumAllCancelledTokenValue();
        BigDecimal recognizedRevenue = orderRevenue.add(cancelledRevenue);
        BigDecimal totalRefunded = exchangeRepository.sumAllActualRefund();
        BigDecimal rhs = holding.add(recognizedRevenue).add(totalRefunded);
        boolean balanced = totalPrepaid.compareTo(rhs) == 0;

        return new ReportDtos.ReconciliationResponse(
                totalPrepaid,
                holding,
                recognizedRevenue,
                totalRefunded,
                rhs,
                balanced,
                "Tổng trả trước = Token đang giữ + Doanh thu đã ghi nhận + Tổng hoàn tiền"
        );
    }

    private ReportDtos.CampaignBreakdownResponse buildCampaignBreakdown(UUID campaignId) {
        Campaign campaign = campaignRepository.findById(campaignId)
                .orElseThrow(() -> new ResourceNotFoundException("Campaign not found: " + campaignId));

        BigDecimal prepaid = participantRepository.sumPrepaidAmountByCampaign(campaignId);
        long bagsSold = participantRepository.sumBagsPurchasedByCampaign(campaignId);

        List<UUID> participantIds = participantRepository.findByCampaignId(campaignId).stream()
                .map(CampaignParticipant::getId)
                .toList();

        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (TokenStatus status : TokenStatus.values()) {
            byStatus.put(status.name(), 0L);
        }

        if (!participantIds.isEmpty()) {
            List<Object[]> rows = itemTokenRepository.countByStatusForParticipants(participantIds);
            for (Object[] row : rows) {
                TokenStatus status = (TokenStatus) row[0];
                Long count = (Long) row[1];
                byStatus.put(status.name(), count);
            }
        }

        return new ReportDtos.CampaignBreakdownResponse(
                campaign.getId(),
                campaign.getName(),
                prepaid,
                bagsSold,
                campaign.getTotalBags(),
                byStatus
        );
    }
}
