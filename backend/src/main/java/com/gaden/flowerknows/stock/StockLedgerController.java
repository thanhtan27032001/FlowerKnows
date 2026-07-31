package com.gaden.flowerknows.stock;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/stock-transactions")
public class StockLedgerController {

    private final StockLedgerService stockLedgerService;
    private final StockService stockService;

    public StockLedgerController(StockLedgerService stockLedgerService, StockService stockService) {
        this.stockLedgerService = stockLedgerService;
        this.stockService = stockService;
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

    @PostMapping("/{id}/undo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('OWNER')")
    public void undoStockIn(@PathVariable UUID id) {
        stockService.undoStockIn(id);
    }
}
