package com.gaden.flowerknows.stock;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/stock-transactions")
public class StockLedgerController {

    private final StockLedgerService stockLedgerService;

    public StockLedgerController(StockLedgerService stockLedgerService) {
        this.stockLedgerService = stockLedgerService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public StockLedgerDtos.StockLedgerPageResponse list(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) UUID productId,
            @RequestParam(required = false) StockTransactionType type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo
    ) {
        return stockLedgerService.listLedger(productId, type, dateFrom, dateTo, page, size);
    }
}
