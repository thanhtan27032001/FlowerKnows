package com.gaden.flowerknows.directsale;

import com.gaden.flowerknows.common.BatchLineException;
import com.gaden.flowerknows.common.BatchLineException.LineError;
import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.customer.Customer;
import com.gaden.flowerknows.customer.CustomerService;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.product.ProductRepository;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransactionType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class DirectSaleService {

    static final String CANCELLED_NOTE = "Cancelled direct sale";

    private final DirectSaleRepository directSaleRepository;
    private final ProductRepository productRepository;
    private final CustomerService customerService;
    private final StockService stockService;

    public DirectSaleService(
            DirectSaleRepository directSaleRepository,
            ProductRepository productRepository,
            CustomerService customerService,
            StockService stockService
    ) {
        this.directSaleRepository = directSaleRepository;
        this.productRepository = productRepository;
        this.customerService = customerService;
        this.stockService = stockService;
    }

    @Transactional
    public DirectSaleDtos.DirectSaleResponse create(DirectSaleDtos.CreateDirectSaleRequest request) {
        Customer customer = null;
        if (request.customerId() != null) {
            customer = customerService.requireCustomer(request.customerId());
        }

        Set<UUID> productIds = request.lines().stream()
                .map(DirectSaleDtos.CreateDirectSaleLineRequest::productId)
                .collect(Collectors.toCollection(HashSet::new));
        Map<UUID, Product> productsById = productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(Product::getId, Function.identity()));

        List<LineError> lineErrors = new ArrayList<>();
        Map<UUID, Integer> remainingByProduct = new HashMap<>();

        for (int i = 0; i < request.lines().size(); i++) {
            DirectSaleDtos.CreateDirectSaleLineRequest line = request.lines().get(i);
            Product product = productsById.get(line.productId());
            if (product == null) {
                lineErrors.add(new LineError(i, line.productId(), "Product not found"));
                continue;
            }
            int remaining = remainingByProduct.computeIfAbsent(
                    product.getId(),
                    id -> product.getStockQuantity()
            );
            if (line.quantity() > remaining) {
                lineErrors.add(new LineError(
                        i,
                        product.getId(),
                        "SP %s chỉ còn %d trong kho".formatted(product.getName(), product.getStockQuantity())
                ));
            } else {
                remainingByProduct.put(product.getId(), remaining - line.quantity());
            }
        }
        if (!lineErrors.isEmpty()) {
            throw new BatchLineException("One or more lines exceed available stock", lineErrors);
        }

        BigDecimal recognizedRevenue = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;
        boolean missingCost = false;
        List<DirectSaleLine> lines = new ArrayList<>();

        for (DirectSaleDtos.CreateDirectSaleLineRequest lineReq : request.lines()) {
            Product product = productsById.get(lineReq.productId());
            BigDecimal costSnapshot = product.getAverageCostPrice();
            if (costSnapshot == null) {
                missingCost = true;
            }
            BigDecimal unitCost = costSnapshot == null ? BigDecimal.ZERO : costSnapshot;
            BigDecimal lineRevenue = lineReq.unitPrice()
                    .multiply(BigDecimal.valueOf(lineReq.quantity()));
            BigDecimal lineCost = unitCost
                    .multiply(BigDecimal.valueOf(lineReq.quantity()))
                    .setScale(0, RoundingMode.HALF_UP);

            recognizedRevenue = recognizedRevenue.add(lineRevenue);
            totalCost = totalCost.add(lineCost);

            BigDecimal snapshotForStore = costSnapshot == null
                    ? null
                    : costSnapshot.setScale(0, RoundingMode.HALF_UP);

            DirectSaleLine line = new DirectSaleLine(
                    product,
                    lineReq.quantity(),
                    lineReq.unitPrice(),
                    snapshotForStore
            );
            lines.add(line);

            stockService.applyStockChange(
                    product,
                    -lineReq.quantity(),
                    StockTransactionType.DIRECT_SALE,
                    null
            );
        }

        BigDecimal grossMargin = recognizedRevenue.subtract(totalCost);
        DirectSale sale = new DirectSale(customer, recognizedRevenue, totalCost, grossMargin);
        for (DirectSaleLine line : lines) {
            sale.addLine(line);
        }
        DirectSale saved = directSaleRepository.save(sale);
        return toResponse(saved, missingCost);
    }

    @Transactional
    public void cancel(UUID id) {
        DirectSale sale = directSaleRepository.findByIdWithLines(id)
                .orElseThrow(() -> new ResourceNotFoundException("Direct sale not found: " + id));

        if (sale.getLines().isEmpty()) {
            throw new BusinessException("Direct sale has no lines to cancel");
        }

        for (DirectSaleLine line : sale.getLines()) {
            stockService.applyStockChange(
                    line.getProduct(),
                    line.getQuantity(),
                    StockTransactionType.DIRECT_SALE,
                    CANCELLED_NOTE
            );
        }

        directSaleRepository.delete(sale);
    }

    @Transactional(readOnly = true)
    public List<DirectSaleDtos.DirectSaleResponse> listAll() {
        return directSaleRepository.findAllWithLines().stream()
                .sorted(Comparator.comparing(DirectSale::getCreatedAt).reversed())
                .map(sale -> toResponse(sale, hasMissingCost(sale)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DirectSaleDtos.DirectSaleResponse> listByCustomer(UUID customerId) {
        customerService.requireCustomer(customerId);
        return directSaleRepository.findByCustomerIdWithLines(customerId).stream()
                .sorted(Comparator.comparing(DirectSale::getCreatedAt).reversed())
                .map(sale -> toResponse(sale, hasMissingCost(sale)))
                .toList();
    }

    private static boolean hasMissingCost(DirectSale sale) {
        return sale.getLines().stream().anyMatch(l -> l.getCostPriceSnapshot() == null);
    }

    private DirectSaleDtos.DirectSaleResponse toResponse(DirectSale sale, boolean missingCostWarning) {
        Customer customer = sale.getCustomer();
        return new DirectSaleDtos.DirectSaleResponse(
                sale.getId(),
                customer == null ? null : customer.getId(),
                customer == null ? null : customer.getName(),
                sale.getCreatedAt(),
                sale.getRecognizedRevenue(),
                sale.getTotalCost(),
                sale.getGrossMargin(),
                missingCostWarning,
                sale.getLines().stream()
                        .map(line -> new DirectSaleDtos.DirectSaleLineResponse(
                                line.getId(),
                                line.getProduct().getId(),
                                line.getProduct().getName(),
                                line.getQuantity(),
                                line.getUnitPrice(),
                                line.getCostPriceSnapshot()
                        ))
                        .toList()
        );
    }
}
