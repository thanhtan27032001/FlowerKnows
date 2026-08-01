package com.gaden.flowerknows.customer;

import com.gaden.flowerknows.auth.JwtAuthenticationFilter;
import com.gaden.flowerknows.auth.JwtService;
import com.gaden.flowerknows.common.GlobalExceptionHandler;
import com.gaden.flowerknows.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = CustomerController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class, GlobalExceptionHandler.class})
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "app.jwt.secret=test-secret-key-at-least-32-characters-long!!",
        "app.jwt.expiration-ms=3600000"
})
class CustomerControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private CustomerService customerService;

    @Test
    void createWithOnlyNameSucceeds() throws Exception {
        String staffToken = jwtService.generateToken("staff1", "STAFF");
        UUID id = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-07-01T00:00:00Z");

        when(customerService.create(any())).thenReturn(
                new CustomerDtos.CustomerResponse(
                        id,
                        "Lan",
                        null,
                        null,
                        CustomerActionStatus.UNDETERMINED,
                        null,
                        createdAt
                )
        );

        mockMvc.perform(post("/api/customers")
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Lan"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Lan"))
                .andExpect(jsonPath("$.phone").doesNotExist());

        verify(customerService).create(any(CustomerDtos.CreateCustomerRequest.class));
    }

    @Test
    void staffJwtCanUpdateCustomerProfile() throws Exception {
        String staffToken = jwtService.generateToken("staff1", "STAFF");
        UUID id = UUID.randomUUID();

        when(customerService.update(eq(id), any())).thenReturn(
                detail(id, "Lan Updated", "0901111222", null, CustomerActionStatus.UNDETERMINED)
        );

        mockMvc.perform(patch("/api/customers/" + id)
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Lan Updated","phone":"0901111222","address":null}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Lan Updated"));

        verify(customerService).update(eq(id), any(CustomerDtos.UpdateCustomerRequest.class));
    }

    @Test
    void staffJwtCanUpdateActionStatus() throws Exception {
        String staffToken = jwtService.generateToken("staff1", "STAFF");
        UUID id = UUID.randomUUID();

        when(customerService.updateActionStatus(eq(id), any())).thenReturn(
                detail(id, "Lan", null, null, CustomerActionStatus.NEEDS_IMMEDIATE_ORDER)
        );

        mockMvc.perform(patch("/api/customers/" + id + "/action-status")
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"actionStatus":"NEEDS_IMMEDIATE_ORDER"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionStatus").value("NEEDS_IMMEDIATE_ORDER"));

        verify(customerService).updateActionStatus(eq(id), any(CustomerDtos.UpdateActionStatusRequest.class));
    }

    private static CustomerDtos.CustomerDetailResponse detail(
            UUID id,
            String name,
            String phone,
            String address,
            CustomerActionStatus actionStatus
    ) {
        return new CustomerDtos.CustomerDetailResponse(
                id,
                name,
                phone,
                address,
                actionStatus,
                Instant.parse("2026-07-01T00:00:00Z"),
                BigDecimal.ZERO,
                0,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );
    }
}
