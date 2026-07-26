package com.gaden.flowerknows.customer;

import com.gaden.flowerknows.order.ShippingStatus;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
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
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<CustomerDtos.CustomerResponse> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) CustomerActionStatus actionStatus,
            @RequestParam(required = false) ShippingStatus shippingStatus
    ) {
        return customerService.search(q, actionStatus, shippingStatus);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public CustomerDtos.CustomerDetailResponse getById(@PathVariable UUID id) {
        return customerService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public CustomerDtos.CustomerResponse create(@Valid @RequestBody CustomerDtos.CreateCustomerRequest request) {
        return customerService.create(request);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public CustomerDtos.CustomerDetailResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody CustomerDtos.UpdateCustomerRequest request
    ) {
        return customerService.update(id, request);
    }

    @PatchMapping("/{id}/action-status")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public CustomerDtos.CustomerDetailResponse updateActionStatus(
            @PathVariable UUID id,
            @Valid @RequestBody CustomerDtos.UpdateActionStatusRequest request
    ) {
        return customerService.updateActionStatus(id, request);
    }
}
