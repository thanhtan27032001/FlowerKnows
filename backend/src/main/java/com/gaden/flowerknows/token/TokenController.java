package com.gaden.flowerknows.token;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tokens")
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
}
