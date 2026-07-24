package com.gaden.flowerknows.exchange;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.customer.Customer;
import com.gaden.flowerknows.customer.CustomerService;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.product.ProductRepository;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransactionType;
import com.gaden.flowerknows.token.ItemToken;
import com.gaden.flowerknows.token.ItemTokenRepository;
import com.gaden.flowerknows.token.SourceType;
import com.gaden.flowerknows.token.TokenStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ExchangeService {

    private final ExchangeTransactionRepository exchangeRepository;
    private final ItemTokenRepository itemTokenRepository;
    private final ProductRepository productRepository;
    private final CustomerService customerService;
    private final StockService stockService;

    public ExchangeService(
            ExchangeTransactionRepository exchangeRepository,
            ItemTokenRepository itemTokenRepository,
            ProductRepository productRepository,
            CustomerService customerService,
            StockService stockService
    ) {
        this.exchangeRepository = exchangeRepository;
        this.itemTokenRepository = itemTokenRepository;
        this.productRepository = productRepository;
        this.customerService = customerService;
        this.stockService = stockService;
    }

    @Transactional
    public ExchangeDtos.ExchangeResponse itemExchange(ExchangeDtos.ItemExchangeRequest request) {
        Customer customer = customerService.requireCustomer(request.customerId());
        List<ItemToken> tokensIn = loadHoldingTokens(request.tokenIds(), customer.getId());

        BigDecimal oldValueSum = tokensIn.stream()
                .map(ItemToken::getTokenValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal additional = request.additionalPayment() != null
                ? request.additionalPayment()
                : BigDecimal.ZERO;
        BigDecimal targetNewValue = oldValueSum.add(additional);

        // Expand receive products into individual units with allocated values
        List<ProductUnit> units = expandReceiveProducts(request.receiveProducts(), targetNewValue);

        // Return old token products to stock
        Map<UUID, Integer> returnCounts = new HashMap<>();
        for (ItemToken token : tokensIn) {
            returnCounts.merge(token.getProduct().getId(), 1, Integer::sum);
            token.setStatus(TokenStatus.EXCHANGED);
        }
        for (Map.Entry<UUID, Integer> entry : returnCounts.entrySet()) {
            Product product = productRepository.findById(entry.getKey())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + entry.getKey()));
            stockService.applyStockChange(
                    product,
                    entry.getValue(),
                    StockTransactionType.EXCHANGE_IN,
                    "Returned from item exchange (old tokens)"
            );
        }

        // Deduct new products from stock and create new tokens
        Map<UUID, Integer> deductCounts = new HashMap<>();
        for (ProductUnit unit : units) {
            deductCounts.merge(unit.product().getId(), 1, Integer::sum);
        }
        for (Map.Entry<UUID, Integer> entry : deductCounts.entrySet()) {
            Product product = productRepository.findById(entry.getKey())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + entry.getKey()));
            if (entry.getValue() > product.getStockQuantity()) {
                throw new BusinessException(
                        "Product %s does not have enough stock (%d available, %d requested)"
                                .formatted(product.getName(), product.getStockQuantity(), entry.getValue())
                );
            }
            stockService.applyStockChange(
                    product,
                    -entry.getValue(),
                    StockTransactionType.EXCHANGE_OUT,
                    "Removed for item exchange (new tokens)"
            );
        }

        ExchangeTransaction tx = ExchangeTransaction.itemExchange(customer, additional);
        tx.getTokensIn().addAll(tokensIn);

        List<ItemToken> tokensOut = new ArrayList<>();
        // Save exchange first to get ID for source_id
        ExchangeTransaction savedTx = exchangeRepository.save(tx);

        for (ProductUnit unit : units) {
            ItemToken newToken = new ItemToken(
                    unit.product(),
                    customer,
                    unit.tokenValue(),
                    unit.product().getAverageCostPrice(),
                    SourceType.EXCHANGE,
                    savedTx.getId()
            );
            tokensOut.add(newToken);
        }
        List<ItemToken> savedOut = itemTokenRepository.saveAll(tokensOut);
        savedTx.getTokensOut().addAll(savedOut);

        return toResponse(savedTx);
    }

    @Transactional
    public ExchangeDtos.ExchangeResponse cashOut(ExchangeDtos.CashOutRequest request) {
        Customer customer = customerService.requireCustomer(request.customerId());
        List<ItemToken> tokensIn = loadHoldingTokens(request.tokenIds(), customer.getId());

        BigDecimal suggested = tokensIn.stream()
                .map(t -> t.getProduct().getListPrice())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<UUID, Integer> returnCounts = new HashMap<>();
        for (ItemToken token : tokensIn) {
            returnCounts.merge(token.getProduct().getId(), 1, Integer::sum);
            token.setStatus(TokenStatus.CASHED_OUT);
        }
        for (Map.Entry<UUID, Integer> entry : returnCounts.entrySet()) {
            Product product = productRepository.findById(entry.getKey())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + entry.getKey()));
            stockService.applyStockChange(
                    product,
                    entry.getValue(),
                    StockTransactionType.CASH_OUT_RETURN,
                    "Returned from cash out"
            );
        }

        ExchangeTransaction tx = ExchangeTransaction.cashOut(customer, suggested, request.actualRefundAmount());
        tx.getTokensIn().addAll(tokensIn);
        ExchangeTransaction saved = exchangeRepository.save(tx);
        return toResponse(saved);
    }

    private List<ItemToken> loadHoldingTokens(List<UUID> tokenIds, UUID customerId) {
        List<ItemToken> tokens = itemTokenRepository.findByIdInAndCustomerId(tokenIds, customerId);
        if (tokens.size() != tokenIds.size()) {
            throw new BusinessException("One or more tokens were not found for this customer");
        }
        for (ItemToken token : tokens) {
            token.requireHolding();
        }
        return tokens;
    }

    private List<ProductUnit> expandReceiveProducts(
            List<ExchangeDtos.ReceiveProductRequest> receiveProducts,
            BigDecimal targetTotalValue
    ) {
        List<ProductUnit> units = new ArrayList<>();
        List<BigDecimal> explicitValues = new ArrayList<>();
        boolean anyExplicit = false;
        boolean allExplicit = true;

        for (ExchangeDtos.ReceiveProductRequest row : receiveProducts) {
            Product product = productRepository.findById(row.productId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + row.productId()));
            for (int i = 0; i < row.quantity(); i++) {
                units.add(new ProductUnit(product, null));
                if (row.tokenValue() != null) {
                    anyExplicit = true;
                    explicitValues.add(row.tokenValue());
                } else {
                    allExplicit = false;
                    explicitValues.add(null);
                }
            }
        }

        if (units.isEmpty()) {
            throw new BusinessException("At least one product must be received");
        }

        List<BigDecimal> allocated;
        if (anyExplicit && allExplicit) {
            allocated = explicitValues;
            BigDecimal sum = allocated.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            if (sum.compareTo(targetTotalValue) != 0) {
                throw new BusinessException(
                        "Sum of new token values (%s) must equal old token values + additional_payment (%s)"
                                .formatted(sum, targetTotalValue)
                );
            }
        } else if (anyExplicit) {
            throw new BusinessException("Provide tokenValue for all receive products or none (auto-allocate by list_price)");
        } else {
            allocated = allocateByListPrice(units, targetTotalValue);
        }

        List<ProductUnit> result = new ArrayList<>();
        for (int i = 0; i < units.size(); i++) {
            result.add(new ProductUnit(units.get(i).product(), allocated.get(i)));
        }
        return result;
    }

    private List<BigDecimal> allocateByListPrice(List<ProductUnit> units, BigDecimal targetTotal) {
        BigDecimal priceSum = units.stream()
                .map(u -> u.product().getListPrice())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<BigDecimal> values = new ArrayList<>();
        BigDecimal allocated = BigDecimal.ZERO;

        if (priceSum.compareTo(BigDecimal.ZERO) == 0) {
            BigDecimal each = targetTotal.divide(BigDecimal.valueOf(units.size()), 0, RoundingMode.DOWN);
            for (int i = 0; i < units.size(); i++) {
                if (i < units.size() - 1) {
                    values.add(each);
                    allocated = allocated.add(each);
                } else {
                    values.add(targetTotal.subtract(allocated));
                }
            }
            return values;
        }

        for (int i = 0; i < units.size(); i++) {
            if (i < units.size() - 1) {
                BigDecimal share = targetTotal
                        .multiply(units.get(i).product().getListPrice())
                        .divide(priceSum, 0, RoundingMode.HALF_UP);
                values.add(share);
                allocated = allocated.add(share);
            } else {
                values.add(targetTotal.subtract(allocated));
            }
        }
        return values;
    }

    private ExchangeDtos.ExchangeResponse toResponse(ExchangeTransaction tx) {
        return new ExchangeDtos.ExchangeResponse(
                tx.getId(),
                tx.getCustomer().getId(),
                tx.getType().name(),
                tx.getCreatedAt(),
                tx.getAdditionalPayment(),
                tx.getSuggestedRefundAmount(),
                tx.getActualRefundAmount(),
                tx.getTokensIn().stream().map(this::toBrief).toList(),
                tx.getTokensOut().stream().map(this::toBrief).toList()
        );
    }

    private ExchangeDtos.TokenBriefResponse toBrief(ItemToken token) {
        return new ExchangeDtos.TokenBriefResponse(
                token.getId(),
                token.getProduct().getId(),
                token.getProduct().getName(),
                token.getTokenValue(),
                token.getStatus().name()
        );
    }

    private record ProductUnit(Product product, BigDecimal tokenValue) {
    }
}
