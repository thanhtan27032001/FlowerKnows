package com.gaden.flowerknows.product;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<ProductDtos.ProductResponse> list() {
        return productService.list();
    }

    @GetMapping("/name-exists")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public Map<String, Boolean> nameExists(@RequestParam String name) {
        return Map.of("exists", productService.nameExists(name));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public ProductDtos.ProductResponse get(@PathVariable UUID id) {
        return productService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public ProductDtos.ProductResponse create(@Valid @RequestBody ProductDtos.CreateProductRequest request) {
        return productService.create(request);
    }

    @PostMapping("/stock-in")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public ProductDtos.StockInResponse stockIn(@Valid @RequestBody ProductDtos.StockInRequest request) {
        return productService.stockIn(request);
    }

    @PostMapping("/{id}/stock-adjustment")
    @PreAuthorize("hasRole('OWNER')")
    public ProductDtos.ProductResponse adjustStock(
            @PathVariable UUID id,
            @Valid @RequestBody ProductDtos.StockAdjustmentRequest request
    ) {
        return productService.adjustStock(id, request);
    }

    @GetMapping("/{id}/stock-transactions")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<ProductDtos.StockTransactionResponse> stockTransactions(@PathVariable UUID id) {
        return productService.listStockTransactions(id);
    }
}
