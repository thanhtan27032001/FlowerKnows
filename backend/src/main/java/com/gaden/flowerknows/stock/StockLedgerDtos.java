package com.gaden.flowerknows.stock;

import java.util.List;

public final class StockLedgerDtos {

    private StockLedgerDtos() {
    }

    public record StockLedgerPageResponse(
            List<StockLedgerItem> content,
            int page,
            int size,
            long totalElements,
            int totalPages,
            boolean hasNext
    ) {
    }
}
