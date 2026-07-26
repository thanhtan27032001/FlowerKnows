package com.gaden.flowerknows.report;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/reports")
@PreAuthorize("hasRole('OWNER')")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/inventory")
    public List<ReportDtos.InventoryItemResponse> inventory() {
        return reportService.inventoryReport();
    }

    @GetMapping("/profit-overview")
    public ReportDtos.ProfitOverviewResponse profitOverview() {
        return reportService.profitOverview();
    }

    @GetMapping("/revenue")
    public ReportDtos.RevenueReportResponse revenue(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) UUID campaignId
    ) {
        return reportService.revenueReport(from, to, campaignId);
    }
}
