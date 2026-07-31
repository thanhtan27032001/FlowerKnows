package com.gaden.flowerknows.stock;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.product.Product;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

@Service
public class StockService {

    static final String UNDO_WOULD_GO_NEGATIVE_MESSAGE =
            "Không thể hoàn tác vì một phần hàng đã được sử dụng (VD khóa vào campaign). "
                    + "Tồn kho sau hoàn tác sẽ âm.";

    static final String UNDO_NOT_LATEST_MESSAGE =
            "Chỉ có thể hoàn tác lần nhập kho gần nhất của sản phẩm này.";

    private final StockTransactionRepository stockTransactionRepository;

    public StockService(StockTransactionRepository stockTransactionRepository) {
        this.stockTransactionRepository = stockTransactionRepository;
    }

    /**
     * Applies a stock change to the product and writes a ledger row.
     * Must be called inside an existing {@code @Transactional} boundary.
     */
    public StockTransaction applyStockChange(
            Product product,
            int quantityChange,
            StockTransactionType type,
            String note
    ) {
        int newQuantity = product.getStockQuantity() + quantityChange;
        if (newQuantity < 0) {
            throw new BusinessException(
                    "Product %s does not have enough stock (%d available, change %d)"
                            .formatted(product.getName(), product.getStockQuantity(), quantityChange)
            );
        }
        product.setStockQuantity(newQuantity);
        return stockTransactionRepository.save(
                new StockTransaction(product, type, quantityChange, note)
        );
    }

    /**
     * Stock in (US-13): increases quantity, recalculates weighted average cost,
     * and snapshots {@code average_cost_price_before} for US-33 undo.
     */
    public StockTransaction applyStockIn(Product product, int quantityChange, BigDecimal costPrice, String note) {
        int newQuantity = product.getStockQuantity() + quantityChange;
        if (quantityChange <= 0) {
            throw new BusinessException("quantity must be greater than 0");
        }
        if (costPrice == null || costPrice.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("costPrice must be greater than 0");
        }

        BigDecimal averageCostPriceBefore = product.getAverageCostPrice();

        if (averageCostPriceBefore == null) {
            product.setAverageCostPrice(costPrice);
        } else {
            BigDecimal oldAverage = averageCostPriceBefore;
            BigDecimal oldQuantity = BigDecimal.valueOf(product.getStockQuantity());
            BigDecimal receivedQuantity = BigDecimal.valueOf(quantityChange);

            BigDecimal weightedAverage = oldAverage.multiply(oldQuantity)
                    .add(costPrice.multiply(receivedQuantity))
                    .divide(oldQuantity.add(receivedQuantity), 2, java.math.RoundingMode.HALF_UP);
            product.setAverageCostPrice(weightedAverage);
        }

        product.setStockQuantity(newQuantity);
        return stockTransactionRepository.save(
                new StockTransaction(
                        product,
                        StockTransactionType.STOCK_IN,
                        quantityChange,
                        costPrice,
                        averageCostPriceBefore,
                        note
                )
        );
    }

    /**
     * US-33: undo the most recent stock-in for a product.
     */
    @Transactional
    public void undoStockIn(UUID stockTransactionId) {
        StockTransaction tx = stockTransactionRepository.findByIdWithProduct(stockTransactionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Stock transaction not found: " + stockTransactionId
                ));

        if (tx.getType() != StockTransactionType.STOCK_IN) {
            throw new BusinessException("Only stock-in transactions can be undone");
        }

        Product product = tx.getProduct();
        if (stockTransactionRepository.existsNewerStockIn(
                product.getId(),
                tx.getCreatedAt(),
                tx.getId()
        )) {
            throw new IllegalStateException(UNDO_NOT_LATEST_MESSAGE);
        }

        int remaining = product.getStockQuantity() - tx.getQuantityChange();
        if (remaining < 0) {
            throw new IllegalStateException(UNDO_WOULD_GO_NEGATIVE_MESSAGE);
        }

        product.setStockQuantity(remaining);
        product.setAverageCostPrice(tx.getAverageCostPriceBefore());
        stockTransactionRepository.delete(tx);
    }
}
