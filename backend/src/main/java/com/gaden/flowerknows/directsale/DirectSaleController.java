package com.gaden.flowerknows.directsale;

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
@RequestMapping("/api/direct-sales")
public class DirectSaleController {

    private final DirectSaleService directSaleService;

    public DirectSaleController(DirectSaleService directSaleService) {
        this.directSaleService = directSaleService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public List<DirectSaleDtos.DirectSaleResponse> list() {
        return directSaleService.listAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    public DirectSaleDtos.DirectSaleResponse create(
            @Valid @RequestBody DirectSaleDtos.CreateDirectSaleRequest request
    ) {
        return directSaleService.create(request);
    }

    @PostMapping("/{id}/cancel")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('OWNER')")
    public void cancel(@PathVariable UUID id) {
        directSaleService.cancel(id);
    }
}
