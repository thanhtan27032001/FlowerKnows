package com.gaden.flowerknows.customer;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "customer")
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    /** Optional at creation (v2.1) — only name is required. */
    @Column(nullable = true, length = 20)
    private String phone;

    /** Free-text address, optional — not split into structured fields. */
    @Column(nullable = true, length = 500)
    private String address;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_status", nullable = false, length = 30)
    private CustomerActionStatus actionStatus = CustomerActionStatus.UNDETERMINED;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Customer() {
    }

    public Customer(String name, String phone, String address) {
        this.name = name;
        this.phone = phone;
        this.address = address;
        this.actionStatus = CustomerActionStatus.UNDETERMINED;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public CustomerActionStatus getActionStatus() {
        return actionStatus;
    }

    public void setActionStatus(CustomerActionStatus actionStatus) {
        this.actionStatus = actionStatus;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
