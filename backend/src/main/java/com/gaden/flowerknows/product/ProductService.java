package com.gaden.flowerknows.product;

import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransactionType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Minimal product API so Modules 1–8 can be exercised end-to-end.
 * Full Module 9 (stock-in / adjustment / ledger UI) can extend this later.
 */
@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final StockService stockService;

    public ProductService(ProductRepository productRepository, StockService stockService) {
        this.productRepository = productRepository;
        this.stockService = stockService;
    }

    @Transactional(readOnly = true)
    public List<ProductDtos.ProductResponse> list() {
        return productRepository.findAll().stream()
                .map(ProductDtos.ProductResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductDtos.ProductResponse get(UUID id) {
        return ProductDtos.ProductResponse.from(requireProduct(id));
    }

    @Transactional
    public ProductDtos.ProductResponse create(ProductDtos.CreateProductRequest request) {
        Product product = new Product(request.name(), request.listPrice(), 0);
        product = productRepository.save(product);
        if (request.stockQuantity() > 0) {
            stockService.applyStockChange(
                    product,
                    request.stockQuantity(),
                    StockTransactionType.STOCK_IN,
                    "Initial stock"
            );
        }
        return ProductDtos.ProductResponse.from(product);
    }

    public Product requireProduct(UUID id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + id));
    }
}
