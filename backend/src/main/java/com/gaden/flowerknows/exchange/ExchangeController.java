package com.gaden.flowerknows.exchange;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/exchanges")
public class ExchangeController {

    private final ExchangeService exchangeService;

    public ExchangeController(ExchangeService exchangeService) {
        this.exchangeService = exchangeService;
    }

    @GetMapping("/customer/{customerId}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<ExchangeDtos.ExchangeHistoryResponse> listByCustomer(@PathVariable UUID customerId) {
        return exchangeService.listCustomerItemExchanges(customerId);
    }

    @PostMapping("/item-exchange")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('OWNER')")
    public ExchangeDtos.ExchangeResponse itemExchange(@Valid @RequestBody ExchangeDtos.ItemExchangeRequest request) {
        return exchangeService.itemExchange(request);
    }

    @PostMapping("/cash-out")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('OWNER')")
    public ExchangeDtos.ExchangeResponse cashOut(@Valid @RequestBody ExchangeDtos.CashOutRequest request) {
        return exchangeService.cashOut(request);
    }

    /** US-29: fully reverse a mistaken item exchange. */
    @PostMapping("/{exchangeTransactionId}/undo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('OWNER')")
    public void undo(@PathVariable UUID exchangeTransactionId) {
        exchangeService.undoItemExchange(exchangeTransactionId);
    }
}
