package com.gaden.flowerknows.customer;

import com.gaden.flowerknows.common.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;

    public CustomerService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    @Transactional(readOnly = true)
    public List<CustomerDtos.CustomerResponse> search(String query) {
        if (query == null || query.isBlank()) {
            return customerRepository.findAll().stream()
                    .map(CustomerDtos.CustomerResponse::from)
                    .toList();
        }
        String q = query.trim();
        return customerRepository.findByNameContainingIgnoreCaseOrPhoneContaining(q, q).stream()
                .map(CustomerDtos.CustomerResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CustomerDtos.CustomerResponse getById(UUID id) {
        return CustomerDtos.CustomerResponse.from(requireCustomer(id));
    }

    @Transactional
    public CustomerDtos.CustomerResponse create(CustomerDtos.CreateCustomerRequest request) {
        Customer customer = new Customer(request.name(), request.phone(), request.address());
        return CustomerDtos.CustomerResponse.from(customerRepository.save(customer));
    }

    public Customer requireCustomer(UUID id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found: " + id));
    }
}
