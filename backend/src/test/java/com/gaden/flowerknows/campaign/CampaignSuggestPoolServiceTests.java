package com.gaden.flowerknows.campaign;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.product.ProductRepository;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransactionRepository;
import com.gaden.flowerknows.token.ItemTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CampaignSuggestPoolServiceTests {

    @Mock
    private CampaignRepository campaignRepository;
    @Mock
    private CampaignParticipantRepository participantRepository;
    @Mock
    private ProductRepository productRepository;
    @Mock
    private StockTransactionRepository stockTransactionRepository;
    @Mock
    private ItemTokenRepository itemTokenRepository;

    private CampaignService campaignService;

    @BeforeEach
    void setUp() {
        StockService stockService = new StockService(stockTransactionRepository);
        campaignService = new CampaignService(
                campaignRepository,
                participantRepository,
                productRepository,
                stockService,
                itemTokenRepository
        );
    }

    @Test
    void suggestPoolRejectsWhenWishlistExceedsTotalBags() {
        UUID productId = UUID.randomUUID();
        CampaignDtos.SuggestPoolRequest request = new CampaignDtos.SuggestPoolRequest(
                5,
                BigDecimal.valueOf(100_000),
                BigDecimal.valueOf(400_000),
                BigDecimal.valueOf(50_000),
                List.of(new CampaignDtos.WishlistItemRequest(productId, 6))
        );

        BusinessException ex = assertThrows(
                BusinessException.class,
                () -> campaignService.suggestPool(request)
        );

        assertEquals("Wishlist yêu cầu 6 túi nhưng tổng chỉ có 5 túi", ex.getMessage());
    }

    @Test
    void suggestPoolExcludesNullCostFromAutofillAndWarnsWhenInWishlist() {
        Product wishlistNullCost = product("Unknown Cost", 20, null);
        Product autofillNullCost = product("Never Stocked", 50, null);
        Product a = product("Lipstick A", 30, BigDecimal.valueOf(40_000));
        Product b = product("Lipstick B", 30, BigDecimal.valueOf(45_000));
        Product c = product("Blush", 30, BigDecimal.valueOf(35_000));
        Product d = product("Mascara", 30, BigDecimal.valueOf(50_000));

        when(productRepository.findById(wishlistNullCost.getId())).thenReturn(Optional.of(wishlistNullCost));
        when(productRepository.findByStockQuantityGreaterThanAndAverageCostPriceIsNotNull(0))
                .thenReturn(List.of(a, b, c, d));

        CampaignDtos.SuggestPoolResponse response = campaignService.suggestPool(
                new CampaignDtos.SuggestPoolRequest(
                        5,
                        BigDecimal.valueOf(100_000),
                        BigDecimal.valueOf(160_000),
                        BigDecimal.valueOf(20_000),
                        List.of(new CampaignDtos.WishlistItemRequest(wishlistNullCost.getId(), 1))
                )
        );

        assertEquals(5, response.suggestedPool().size());
        assertTrue(response.suggestedPool().stream()
                .anyMatch(row -> row.productId().equals(wishlistNullCost.getId()) && row.quantity() == 1));
        assertTrue(response.suggestedPool().stream()
                .filter(row -> !row.productId().equals(wishlistNullCost.getId()))
                .allMatch(row -> row.quantity() == 1));
        assertTrue(response.suggestedPool().stream()
                .noneMatch(row -> row.productId().equals(autofillNullCost.getId())));
        assertTrue(response.warnings().stream().anyMatch(w ->
                w.contains("Unknown Cost") && w.contains("chưa có giá vốn")));
        assertEquals(0, response.suggestedPool().stream()
                .filter(row -> row.productId().equals(wishlistNullCost.getId()))
                .findFirst()
                .orElseThrow()
                .unitCost()
                .compareTo(BigDecimal.ZERO));
    }

    @Test
    void suggestPoolWarnsWhenDistinctCandidateCountInsufficient() {
        // Plenty of stock on each SKU, but only 2 distinct candidates for 10 bags.
        Product a = product("Blush", 100, BigDecimal.valueOf(30_000));
        Product b = product("Lipstick", 100, BigDecimal.valueOf(40_000));

        when(productRepository.findByStockQuantityGreaterThanAndAverageCostPriceIsNotNull(0))
                .thenReturn(List.of(a, b));

        CampaignDtos.SuggestPoolResponse response = campaignService.suggestPool(
                new CampaignDtos.SuggestPoolRequest(
                        10,
                        BigDecimal.valueOf(100_000),
                        BigDecimal.valueOf(300_000),
                        BigDecimal.valueOf(50_000),
                        List.of()
                )
        );

        assertEquals(2, response.suggestedPool().size());
        assertTrue(response.suggestedPool().stream().allMatch(row -> row.quantity() == 1));
        assertTrue(response.warnings().contains(
                "Chỉ tìm được 2/10 sản phẩm khác nhau còn hàng — không đủ để lấp đầy 10 túi theo quy tắc mỗi sản phẩm 1 lần"
        ));
    }

    @Test
    void suggestPoolKeepsWishlistQuantityAndAutofillsQtyOne() {
        Product wishlist = product("Must Have", 50, BigDecimal.valueOf(20_000));
        Product a = product("A", 10, BigDecimal.valueOf(30_000));
        Product b = product("B", 10, BigDecimal.valueOf(40_000));
        Product c = product("C", 10, BigDecimal.valueOf(50_000));

        when(productRepository.findById(wishlist.getId())).thenReturn(Optional.of(wishlist));
        when(productRepository.findByStockQuantityGreaterThanAndAverageCostPriceIsNotNull(0))
                .thenReturn(List.of(a, b, c));

        CampaignDtos.SuggestPoolResponse response = campaignService.suggestPool(
                new CampaignDtos.SuggestPoolRequest(
                        5,
                        BigDecimal.valueOf(100_000),
                        BigDecimal.valueOf(160_000),
                        BigDecimal.valueOf(30_000),
                        List.of(new CampaignDtos.WishlistItemRequest(wishlist.getId(), 2))
                )
        );

        assertEquals(4, response.suggestedPool().size());
        assertEquals(2, response.suggestedPool().stream()
                .filter(row -> row.productId().equals(wishlist.getId()))
                .findFirst()
                .orElseThrow()
                .quantity());
        assertTrue(response.suggestedPool().stream()
                .filter(row -> !row.productId().equals(wishlist.getId()))
                .allMatch(row -> row.quantity() == 1));
        assertEquals(5, response.suggestedPool().stream()
                .mapToInt(CampaignDtos.SuggestedPoolItemResponse::quantity)
                .sum());
    }

    @Test
    void suggestPoolReturnsBestEffortWhenOutsideTolerance() {
        Product p1 = product("P1", 10, BigDecimal.valueOf(10_000));
        Product p2 = product("P2", 10, BigDecimal.valueOf(12_000));
        Product p3 = product("P3", 10, BigDecimal.valueOf(15_000));
        Product p4 = product("P4", 10, BigDecimal.valueOf(18_000));

        when(productRepository.findByStockQuantityGreaterThanAndAverageCostPriceIsNotNull(0))
                .thenReturn(List.of(p1, p2, p3, p4));

        // Target far above what four cheap products can reach within a tight tolerance.
        CampaignDtos.SuggestPoolResponse response = campaignService.suggestPool(
                new CampaignDtos.SuggestPoolRequest(
                        4,
                        BigDecimal.valueOf(100_000),
                        BigDecimal.valueOf(1_000_000),
                        BigDecimal.valueOf(1_000),
                        List.of()
                )
        );

        assertEquals(4, response.suggestedPool().size());
        assertTrue(response.suggestedPool().stream().allMatch(row -> row.quantity() == 1));
        assertFalse(response.withinTolerance());
        assertEquals(
                response.totalSuggestedCost().subtract(BigDecimal.valueOf(1_000_000)),
                response.deviation()
        );
        assertFalse(response.suggestedPool().isEmpty());
    }

    private Product product(String name, int stock, BigDecimal averageCost) {
        Product product = new Product(name, BigDecimal.valueOf(250_000), stock);
        product.setAverageCostPrice(averageCost);
        setId(product, UUID.randomUUID());
        return product;
    }

    private static void setId(Object entity, UUID id) {
        try {
            var idField = entity.getClass().getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(entity, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
