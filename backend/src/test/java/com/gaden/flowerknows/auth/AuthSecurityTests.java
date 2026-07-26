package com.gaden.flowerknows.auth;

import com.gaden.flowerknows.common.GlobalExceptionHandler;
import com.gaden.flowerknows.config.SecurityConfig;
import com.gaden.flowerknows.exchange.ExchangeController;
import com.gaden.flowerknows.exchange.ExchangeService;
import com.gaden.flowerknows.product.ProductController;
import com.gaden.flowerknows.product.ProductService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {ProductController.class, ExchangeController.class})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class, GlobalExceptionHandler.class})
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "app.jwt.secret=test-secret-key-at-least-32-characters-long!!",
        "app.jwt.expiration-ms=3600000"
})
class AuthSecurityTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private ProductService productService;

    @MockitoBean
    private ExchangeService exchangeService;

    @Test
    void staffJwtCallingOwnerOnlyEndpointReturns403() throws Exception {
        String staffToken = jwtService.generateToken("staff1", "STAFF");

        mockMvc.perform(get("/api/products")
                        .header("Authorization", "Bearer " + staffToken))
                .andExpect(status().isForbidden());

        String body = """
                {"customerId":"%s","tokenIds":["%s"],"actualRefundAmount":100}
                """.formatted(UUID.randomUUID(), UUID.randomUUID());

        mockMvc.perform(post("/api/exchanges/cash-out")
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    void missingJwtOnProtectedEndpointReturns401() throws Exception {
        mockMvc.perform(get("/api/products"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidJwtOnProtectedEndpointReturns401() throws Exception {
        mockMvc.perform(get("/api/products")
                        .header("Authorization", "Bearer not-a-valid-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ownerJwtCanAccessOwnerOnlyEndpoint() throws Exception {
        String ownerToken = jwtService.generateToken("owner1", "OWNER");

        mockMvc.perform(get("/api/products")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk());
    }
}
