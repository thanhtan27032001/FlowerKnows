package com.gaden.flowerknows.stock;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.product.Product;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class StockService {

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

    public StockTransaction applyStockIn(Product product, int quantityChange, BigDecimal costPrice, String note) {
        int newQuantity = product.getStockQuantity() + quantityChange;
        if (quantityChange <= 0) {
            throw new BusinessException("quantity must be greater than 0");
        }
        if (costPrice == null || costPrice.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("costPrice must be greater than 0");
        }

        if (product.getAverageCostPrice() == null) {
            product.setAverageCostPrice(costPrice);
        } else {
            BigDecimal oldAverage = product.getAverageCostPrice();
            BigDecimal oldQuantity = BigDecimal.valueOf(product.getStockQuantity());
            BigDecimal receivedQuantity = BigDecimal.valueOf(quantityChange);

            BigDecimal weightedAverage = oldAverage.multiply(oldQuantity)
                    .add(costPrice.multiply(receivedQuantity))
                    .divide(oldQuantity.add(receivedQuantity), 2, java.math.RoundingMode.HALF_UP);
            product.setAverageCostPrice(weightedAverage);
        }

        product.setStockQuantity(newQuantity);
        return stockTransactionRepository.save(
                new StockTransaction(product, StockTransactionType.STOCK_IN, quantityChange, costPrice, note)
        );
    }
}
