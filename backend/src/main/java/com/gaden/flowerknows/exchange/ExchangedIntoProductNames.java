package com.gaden.flowerknows.exchange;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Groups batched {@link ExchangeTransactionRepository#findExchangedIntoProductNameRows}
 * results into {@code tokenInId → product names}.
 */
public final class ExchangedIntoProductNames {

    private ExchangedIntoProductNames() {
    }

    public static Map<UUID, List<String>> load(
            ExchangeTransactionRepository repository,
            Collection<UUID> tokenInIds
    ) {
        if (tokenInIds == null || tokenInIds.isEmpty()) {
            return Map.of();
        }

        Map<UUID, List<String>> byTokenId = new LinkedHashMap<>();
        for (Object[] row : repository.findExchangedIntoProductNameRows(tokenInIds)) {
            UUID tokenId = (UUID) row[0];
            String productName = (String) row[1];
            byTokenId.computeIfAbsent(tokenId, ignored -> new ArrayList<>()).add(productName);
        }
        return byTokenId;
    }

    public static List<String> forToken(Map<UUID, List<String>> byTokenId, UUID tokenId) {
        List<String> names = byTokenId.get(tokenId);
        return names == null || names.isEmpty() ? List.of() : List.copyOf(names);
    }
}
