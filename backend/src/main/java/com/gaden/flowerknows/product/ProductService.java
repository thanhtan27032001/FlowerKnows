package com.gaden.flowerknows.product;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransaction;
import com.gaden.flowerknows.stock.StockTransactionRepository;
import com.gaden.flowerknows.stock.StockTransactionType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final StockService stockService;
    private final StockTransactionRepository stockTransactionRepository;
    private final int lowStockThreshold;

    public ProductService(
            ProductRepository productRepository,
            StockService stockService,
            StockTransactionRepository stockTransactionRepository,
            @Value("${app.low-stock-threshold:5}") int lowStockThreshold
    ) {
        this.productRepository = productRepository;
        this.stockService = stockService;
        this.stockTransactionRepository = stockTransactionRepository;
        this.lowStockThreshold = lowStockThreshold;
    }

    @Transactional(readOnly = true)
    public List<ProductDtos.ProductResponse> list() {
        return productRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(p -> ProductDtos.ProductResponse.from(p, lowStockThreshold))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductDtos.ProductResponse get(UUID id) {
        return ProductDtos.ProductResponse.from(requireProduct(id), lowStockThreshold);
    }

    @Transactional(readOnly = true)
    public boolean nameExists(String name, UUID excludeId) {
        String trimmed = name.trim();
        if (excludeId == null) {
            return productRepository.existsByNameIgnoreCase(trimmed);
        }
        return productRepository.existsByNameIgnoreCaseAndIdNot(trimmed, excludeId);
    }

    @Transactional
    public ProductDtos.ProductResponse create(ProductDtos.CreateProductRequest request) {
        String name = request.name().trim();
        if (productRepository.existsByNameIgnoreCase(name) && !request.isConfirmDuplicate()) {
            throw new BusinessException(
                    "A product named \"" + name + "\" already exists. Confirm to create a duplicate, or select the existing product."
            );
        }

        Product product = new Product(name, request.listPrice(), 0);
        product = productRepository.save(product);

        int initialStock = request.resolvedStockQuantity();
        if (initialStock > 0) {
            stockService.applyStockChange(
                    product,
                    initialStock,
                    StockTransactionType.STOCK_IN,
                    "Initial stock"
            );
        }
        return ProductDtos.ProductResponse.from(product, lowStockThreshold);
    }

    @Transactional
    public ProductDtos.ProductResponse update(UUID id, ProductDtos.UpdateProductRequest request) {
        Product product = requireProduct(id);
        String name = request.name().trim();
        if (productRepository.existsByNameIgnoreCaseAndIdNot(name, id)
                && !request.isConfirmDuplicate()) {
            throw new BusinessException(
                    "A product named \"" + name + "\" already exists. Confirm to create a duplicate, or select the existing product."
            );
        }
        product.setName(name);
        return ProductDtos.ProductResponse.from(product, lowStockThreshold);
    }

    @Transactional
    public ProductDtos.StockInResponse stockIn(ProductDtos.StockInRequest request) {
        Map<UUID, Product> updated = new LinkedHashMap<>();

        for (ProductDtos.StockInItemRequest item : request.items()) {
            if (item.quantity() <= 0) {
                throw new BusinessException("quantity must be greater than 0");
            }
            if (item.costPrice() == null || item.costPrice().signum() <= 0) {
                throw new BusinessException("costPrice must be greater than 0");
            }
            Product product = requireProduct(item.productId());
            stockService.applyStockIn(
                    product,
                    item.quantity(),
                    item.costPrice(),
                    item.note()
            );
            updated.put(product.getId(), product);
        }

        List<ProductDtos.ProductResponse> products = updated.values().stream()
                .map(p -> ProductDtos.ProductResponse.from(p, lowStockThreshold))
                .toList();
        return new ProductDtos.StockInResponse(products);
    }

    @Transactional
    public ProductDtos.ProductResponse adjustStock(UUID productId, ProductDtos.StockAdjustmentRequest request) {
        if (request.note() == null || request.note().isBlank()) {
            throw new BusinessException("Please enter a reason for the adjustment");
        }

        Product product = requireProduct(productId);
        int change = request.direction() == ProductDtos.AdjustmentDirection.INCREASE
                ? request.quantity()
                : -request.quantity();

        if (request.direction() == ProductDtos.AdjustmentDirection.DECREASE
                && request.quantity() > product.getStockQuantity()) {
            throw new BusinessException(
                    "Cannot decrease below current stock (%d available)".formatted(product.getStockQuantity())
            );
        }

        stockService.applyStockChange(
                product,
                change,
                StockTransactionType.STOCK_ADJUSTMENT,
                request.note().trim()
        );
        return ProductDtos.ProductResponse.from(product, lowStockThreshold);
    }

    @Transactional(readOnly = true)
    public List<ProductDtos.StockTransactionResponse> listStockTransactions(UUID productId) {
        Product product = requireProduct(productId);
        List<StockTransaction> newestFirst =
                stockTransactionRepository.findByProductIdOrderByCreatedAtDesc(productId);

        long ledgerSum = stockTransactionRepository.sumQuantityChangeByProductId(productId);
        boolean mismatch = ledgerSum != product.getStockQuantity();

        int running = product.getStockQuantity();
        List<ProductDtos.StockTransactionResponse> result = new ArrayList<>();
        for (StockTransaction tx : newestFirst) {
            result.add(new ProductDtos.StockTransactionResponse(
                    tx.getId(),
                    product.getId(),
                    product.getName(),
                    tx.getType().name(),
                    toLabel(tx.getType()),
                    tx.getQuantityChange(),
                    tx.getCostPrice(),
                    tx.getNote(),
                    tx.getCreatedAt(),
                    running,
                    mismatch
            ));
            running -= tx.getQuantityChange();
        }
        return result;
    }

    public Product requireProduct(UUID id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + id));
    }

    private static String toLabel(StockTransactionType type) {
        return switch (type) {
            case STOCK_IN -> "Stock In";
            case STOCK_ADJUSTMENT -> "Stock Adjustment";
            case CAMPAIGN_LOCK -> "Locked for Campaign";
            case CAMPAIGN_RETURN -> "Returned from Campaign Close";
            case EXCHANGE_IN -> "Returned from Item Exchange (old token)";
            case EXCHANGE_OUT -> "Removed for Item Exchange (new token)";
            case CASH_OUT_RETURN -> "Returned from Cash Out";
            case TOKEN_CANCEL_RETURN -> "Returned from Overdue Token Cancellation";
            case ORDER_FULFILLMENT -> "Removed for Order Fulfillment";
            case EXCHANGE_UNDO_RETURN -> "Returned from Undoing Item Exchange";
            case EXCHANGE_UNDO_REMOVE -> "Removed from Undoing Item Exchange";
        };
    }
}
