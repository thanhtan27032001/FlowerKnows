package com.gaden.flowerknows.stockcount;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.product.ProductRepository;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransactionType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class StockCountService {

    private final StockCountRepository stockCountRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;

    public StockCountService(
            StockCountRepository stockCountRepository,
            ProductRepository productRepository,
            StockService stockService
    ) {
        this.stockCountRepository = stockCountRepository;
        this.productRepository = productRepository;
        this.stockService = stockService;
    }

    @Transactional
    public StockCountDtos.StockCountDetailResponse create(StockCountDtos.CreateStockCountRequest request) {
        StockCount stockCount = new StockCount(request == null ? null : request.note());
        return toDetailResponse(stockCountRepository.save(stockCount));
    }

    @Transactional
    public StockCountDtos.StockCountLineResponse addLine(UUID stockCountId, StockCountDtos.AddLineRequest request) {
        StockCount stockCount = requireInProgress(stockCountId);
        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + request.productId()));

        if (request.costPrice() != null && request.costPrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("costPrice must be greater than 0");
        }

        StockCountLine line = new StockCountLine(product, product.getStockQuantity());
        line.setCostPrice(request.costPrice());
        line.setNote(request.note());
        stockCount.addLine(line);
        stockCountRepository.save(stockCount);
        return toLineResponse(line);
    }

    @Transactional
    public StockCountDtos.StockCountLineResponse updateLine(
            UUID stockCountId,
            UUID lineId,
            StockCountDtos.UpdateLineRequest request
    ) {
        StockCount stockCount = requireInProgress(stockCountId);
        StockCountLine line = requireLine(stockCount, lineId);

        if (request.countedQuantity() != null) {
            if (request.countedQuantity() < 0) {
                throw new BusinessException("countedQuantity must be >= 0");
            }
            line.setCountedQuantity(request.countedQuantity());
        }
        if (request.costPrice() != null) {
            if (request.costPrice().compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException("costPrice must be greater than 0");
            }
            line.setCostPrice(request.costPrice());
        }
        if (request.note() != null) {
            line.setNote(request.note());
        }
        return toLineResponse(line);
    }

    @Transactional
    public void removeLine(UUID stockCountId, UUID lineId) {
        StockCount stockCount = requireInProgress(stockCountId);
        StockCountLine line = requireLine(stockCount, lineId);
        stockCount.removeLine(line);
    }

    @Transactional
    public void cancel(UUID stockCountId) {
        StockCount stockCount = requireInProgress(stockCountId);
        stockCountRepository.delete(stockCount);
    }

    @Transactional(readOnly = true)
    public List<StockCountDtos.StockCountSummaryResponse> list(Boolean completed) {
        List<StockCount> stockCounts;
        if (completed == null) {
            stockCounts = stockCountRepository.findAllByOrderByCreatedAtDesc();
        } else if (completed) {
            stockCounts = stockCountRepository.findByCompletedAtIsNotNullOrderByCreatedAtDesc();
        } else {
            stockCounts = stockCountRepository.findByCompletedAtIsNullOrderByCreatedAtDesc();
        }
        return stockCounts.stream()
                .map(sc -> new StockCountDtos.StockCountSummaryResponse(
                        sc.getId(),
                        sc.getCreatedAt(),
                        sc.getCompletedAt(),
                        sc.getNote(),
                        sc.getLines().size()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public StockCountDtos.StockCountDetailResponse getDetail(UUID stockCountId) {
        return toDetailResponse(requireStockCount(stockCountId));
    }

    /**
     * US-40: applies every counted line's discrepancy against the *live* product.stockQuantity,
     * either as a proper Stock In (delta &gt; 0 with a costPrice, reusing US-13's weighted-average
     * formula) or as a cost-blind Stock Adjustment, then marks the session completed.
     */
    @Transactional
    public StockCountDtos.StockCountDetailResponse complete(UUID stockCountId) {
        StockCount stockCount = requireInProgress(stockCountId);
        String note = "Kiểm kê: " + (stockCount.getNote() != null ? stockCount.getNote() : sessionDate(stockCount));

        for (StockCountLine line : stockCount.getLines()) {
            if (line.getCountedQuantity() == null) {
                continue;
            }
            Product product = line.getProduct();
            int delta = line.getCountedQuantity() - product.getStockQuantity();
            if (delta == 0) {
                continue;
            }
            if (delta > 0 && line.getCostPrice() != null) {
                stockService.applyStockIn(product, delta, line.getCostPrice(), note, stockCount.getId());
            } else {
                stockService.applyStockChange(
                        product,
                        delta,
                        StockTransactionType.STOCK_ADJUSTMENT,
                        note,
                        stockCount.getId()
                );
            }
        }

        stockCount.setCompletedAt(Instant.now());
        return toDetailResponse(stockCount);
    }

    private static String sessionDate(StockCount stockCount) {
        return DateTimeFormatter.ISO_LOCAL_DATE.format(
                stockCount.getCreatedAt().atZone(ZoneId.systemDefault())
        );
    }

    private StockCount requireStockCount(UUID stockCountId) {
        return stockCountRepository.findByIdWithLines(stockCountId)
                .orElseThrow(() -> new ResourceNotFoundException("Stock count not found: " + stockCountId));
    }

    private StockCount requireInProgress(UUID stockCountId) {
        StockCount stockCount = requireStockCount(stockCountId);
        if (stockCount.isCompleted()) {
            throw new BusinessException("Phiên kiểm kê này đã hoàn tất, không thể chỉnh sửa");
        }
        return stockCount;
    }

    private static StockCountLine requireLine(StockCount stockCount, UUID lineId) {
        return stockCount.getLines().stream()
                .filter(l -> l.getId().equals(lineId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Stock count line not found: " + lineId));
    }

    private static StockCountDtos.StockCountDetailResponse toDetailResponse(StockCount stockCount) {
        return new StockCountDtos.StockCountDetailResponse(
                stockCount.getId(),
                stockCount.getCreatedAt(),
                stockCount.getCompletedAt(),
                stockCount.getNote(),
                stockCount.getLines().stream().map(StockCountService::toLineResponse).toList()
        );
    }

    private static StockCountDtos.StockCountLineResponse toLineResponse(StockCountLine line) {
        return new StockCountDtos.StockCountLineResponse(
                line.getId(),
                line.getProduct().getId(),
                line.getProduct().getName(),
                line.getSystemQuantityAtAdd(),
                line.getCountedQuantity(),
                line.getCostPrice(),
                line.getNote()
        );
    }
}
