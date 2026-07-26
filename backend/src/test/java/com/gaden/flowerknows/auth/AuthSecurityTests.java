package com.gaden.flowerknows.auth;

import com.gaden.flowerknows.common.GlobalExceptionHandler;
import com.gaden.flowerknows.config.SecurityConfig;
import com.gaden.flowerknows.exchange.ExchangeController;
import com.gaden.flowerknows.exchange.ExchangeService;
import com.gaden.flowerknows.product.ProductController;
import com.gaden.flowerknows.product.ProductDtos;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
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
    void staffCanCreateProductAndStockInButNotAdjustStock() throws Exception {
        String staffToken = jwtService.generateToken("staff1", "STAFF");
        UUID productId = UUID.randomUUID();

        when(productService.create(any())).thenReturn(
                new ProductDtos.ProductResponse(
                        productId,
                        "Rose Lipstick",
                        BigDecimal.valueOf(250000),
                        0,
                        null,
                        true
                )
        );
        when(productService.stockIn(any())).thenReturn(
                new ProductDtos.StockInResponse(List.of())
        );

        mockMvc.perform(post("/api/products")
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Rose Lipstick","listPrice":250000,"stockQuantity":0}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/products/stock-in")
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"items":[{"productId":"%s","quantity":10,"costPrice":100000,"note":"batch"}]}
                                """.formatted(productId)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/products/%s/stock-adjustment".formatted(productId))
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"direction":"INCREASE","quantity":1,"note":"count surplus"}
                                """))
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
