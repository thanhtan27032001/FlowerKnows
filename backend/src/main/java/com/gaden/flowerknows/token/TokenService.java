package com.gaden.flowerknows.token;

import com.gaden.flowerknows.common.ResourceNotFoundException;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransactionType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
public class TokenService {

    public static final int OVERDUE_DAYS = 30;

    private final ItemTokenRepository itemTokenRepository;
    private final StockService stockService;

    public TokenService(ItemTokenRepository itemTokenRepository, StockService stockService) {
        this.itemTokenRepository = itemTokenRepository;
        this.stockService = stockService;
    }

    @Transactional(readOnly = true)
    public List<TokenDtos.OverdueTokenResponse> listOverdueTokens() {
        Instant cutoff = Instant.now().minus(OVERDUE_DAYS, ChronoUnit.DAYS);
        return itemTokenRepository
                .findByStatusAndCreatedAtBeforeOrderByCreatedAtAsc(TokenStatus.HOLDING, cutoff)
                .stream()
                .map(this::toOverdueResponse)
                .sorted((a, b) -> Long.compare(b.daysHeld(), a.daysHeld()))
                .toList();
    }

    @Transactional
    public TokenDtos.CancelTokenResponse cancelToken(UUID tokenId) {
        ItemToken token = itemTokenRepository.findById(tokenId)
                .orElseThrow(() -> new ResourceNotFoundException("Token not found: " + tokenId));

        token.cancel();

        stockService.applyStockChange(
                token.getProduct(),
                1,
                StockTransactionType.TOKEN_CANCEL_RETURN,
                "Returned from token cancellation; revenue recognized: " + token.getTokenValue()
        );

        return new TokenDtos.CancelTokenResponse(
                token.getId(),
                token.getStatus().name(),
                token.getTokenValue(),
                token.getCancelledAt(),
                "Cancelling this token returned the product to stock and recognized %s as revenue"
                        .formatted(token.getTokenValue())
        );
    }

    private TokenDtos.OverdueTokenResponse toOverdueResponse(ItemToken token) {
        long daysHeld = ChronoUnit.DAYS.between(token.getCreatedAt(), Instant.now());
        return new TokenDtos.OverdueTokenResponse(
                token.getId(),
                token.getCustomer().getId(),
                token.getCustomer().getName(),
                token.getCustomer().getPhone(),
                token.getProduct().getId(),
                token.getProduct().getName(),
                token.getCreatedAt(),
                daysHeld,
                token.getTokenValue(),
                daysHeld >= OVERDUE_DAYS
        );
    }
}
