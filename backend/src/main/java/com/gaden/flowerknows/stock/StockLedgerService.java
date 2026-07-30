package com.gaden.flowerknows.stock;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

@Service
public class StockLedgerService {

    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final Instant MIN_INSTANT = Instant.EPOCH;
    private static final Instant MAX_INSTANT = Instant.parse("9999-12-31T23:59:59.999999Z");

    private final StockTransactionRepository stockTransactionRepository;

    public StockLedgerService(StockTransactionRepository stockTransactionRepository) {
        this.stockTransactionRepository = stockTransactionRepository;
    }

    @Transactional(readOnly = true)
    public StockLedgerDtos.StockLedgerPageResponse listLedger(
            UUID productId,
            StockTransactionType type,
            LocalDate dateFrom,
            LocalDate dateTo,
            Integer page,
            Integer size
    ) {
        if (dateFrom != null && dateTo != null && dateFrom.isAfter(dateTo)) {
            throw new IllegalArgumentException("dateFrom must be before or equal to dateTo");
        }

        int resolvedPage = page == null ? 0 : Math.max(page, 0);
        int resolvedSize = size == null ? DEFAULT_PAGE_SIZE : Math.max(size, 1);
        Pageable pageable = PageRequest.of(resolvedPage, resolvedSize);

        Instant from = dateFrom == null
                ? MIN_INSTANT
                : dateFrom.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant toExclusive = dateTo == null
                ? MAX_INSTANT
                : dateTo.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);

        Page<StockLedgerItem> result = stockTransactionRepository.findLedgerPage(
                productId,
                type,
                from,
                toExclusive,
                pageable
        );

        return new StockLedgerDtos.StockLedgerPageResponse(
                result.getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.hasNext()
        );
    }
}
