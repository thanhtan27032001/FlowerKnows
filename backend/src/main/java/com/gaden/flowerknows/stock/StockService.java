package com.gaden.flowerknows.stock;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.product.Product;
import org.springframework.stereotype.Service;

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
}
