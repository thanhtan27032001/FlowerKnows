package com.gaden.flowerknows.order;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderDtos.OrderResponse create(@Valid @RequestBody OrderDtos.CreateOrderRequest request) {
        return orderService.createOrder(request);
    }

    @GetMapping("/{id}")
    public OrderDtos.OrderResponse get(@PathVariable UUID id) {
        return orderService.getOrder(id);
    }

    @GetMapping
    public List<OrderDtos.OrderResponse> list(@RequestParam(required = false) UUID customerId) {
        if (customerId != null) {
            return orderService.listByCustomer(customerId);
        }
        return orderService.listAll();
    }

    @PatchMapping("/{id}/shipping-status")
    public OrderDtos.OrderResponse updateShippingStatus(
            @PathVariable UUID id,
            @Valid @RequestBody OrderDtos.UpdateShippingStatusRequest request
    ) {
        return orderService.updateShippingStatus(id, request);
    }
}
