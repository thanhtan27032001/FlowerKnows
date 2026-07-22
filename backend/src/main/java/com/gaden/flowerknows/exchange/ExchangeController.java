package com.gaden.flowerknows.exchange;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/exchanges")
public class ExchangeController {

    private final ExchangeService exchangeService;

    public ExchangeController(ExchangeService exchangeService) {
        this.exchangeService = exchangeService;
    }

    @PostMapping("/item-exchange")
    @ResponseStatus(HttpStatus.CREATED)
    public ExchangeDtos.ExchangeResponse itemExchange(@Valid @RequestBody ExchangeDtos.ItemExchangeRequest request) {
        return exchangeService.itemExchange(request);
    }

    @PostMapping("/cash-out")
    @ResponseStatus(HttpStatus.CREATED)
    public ExchangeDtos.ExchangeResponse cashOut(@Valid @RequestBody ExchangeDtos.CashOutRequest request) {
        return exchangeService.cashOut(request);
    }
}
