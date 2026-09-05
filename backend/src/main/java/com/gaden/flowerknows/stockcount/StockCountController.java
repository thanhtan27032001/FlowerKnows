package com.gaden.flowerknows.stockcount;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/stock-counts")
public class StockCountController {

    private final StockCountService stockCountService;

    public StockCountController(StockCountService stockCountService) {
        this.stockCountService = stockCountService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<StockCountDtos.StockCountSummaryResponse> list(
            @RequestParam(required = false) Boolean completed
    ) {
        return stockCountService.list(completed);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public StockCountDtos.StockCountDetailResponse detail(@PathVariable UUID id) {
        return stockCountService.getDetail(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public StockCountDtos.StockCountDetailResponse create(
            @RequestBody(required = false) StockCountDtos.CreateStockCountRequest request
    ) {
        return stockCountService.create(request);
    }

    @PostMapping("/{id}/lines")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public StockCountDtos.StockCountLineResponse addLine(
            @PathVariable UUID id,
            @Valid @RequestBody StockCountDtos.AddLineRequest request
    ) {
        return stockCountService.addLine(id, request);
    }

    @PatchMapping("/{id}/lines/{lineId}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public StockCountDtos.StockCountLineResponse updateLine(
            @PathVariable UUID id,
            @PathVariable UUID lineId,
            @RequestBody StockCountDtos.UpdateLineRequest request
    ) {
        return stockCountService.updateLine(id, lineId, request);
    }

    @DeleteMapping("/{id}/lines/{lineId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public void removeLine(@PathVariable UUID id, @PathVariable UUID lineId) {
        stockCountService.removeLine(id, lineId);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public void cancel(@PathVariable UUID id) {
        stockCountService.cancel(id);
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasRole('OWNER')")
    public StockCountDtos.StockCountDetailResponse complete(@PathVariable UUID id) {
        return stockCountService.complete(id);
    }
}
