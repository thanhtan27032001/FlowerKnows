package com.gaden.flowerknows.token;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tokens")
@PreAuthorize("hasRole('OWNER')")
public class TokenController {

    private final TokenService tokenService;

    public TokenController(TokenService tokenService) {
        this.tokenService = tokenService;
    }

    @GetMapping("/overdue")
    public List<TokenDtos.OverdueTokenResponse> listOverdue() {
        return tokenService.listOverdueTokens();
    }

    @PostMapping("/{id}/cancel")
    public TokenDtos.CancelTokenResponse cancel(@PathVariable UUID id) {
        return tokenService.cancelToken(id);
    }

    /** US-28: hard-delete a mistaken campaign recording and restore pool remaining. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRecorded(@PathVariable UUID id) {
        tokenService.deleteRecordedCampaignToken(id);
    }
}
