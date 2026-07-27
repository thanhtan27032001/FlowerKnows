package com.gaden.flowerknows.token;

import com.gaden.flowerknows.campaign.Campaign;
import com.gaden.flowerknows.campaign.CampaignParticipant;
import com.gaden.flowerknows.campaign.CampaignParticipantRepository;
import com.gaden.flowerknows.campaign.CampaignPool;
import com.gaden.flowerknows.campaign.CampaignRepository;
import com.gaden.flowerknows.campaign.ParticipantStatus;
import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.customer.Customer;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransaction;
import com.gaden.flowerknows.stock.StockTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TokenServiceDeleteRecordedTests {

    @Mock
    private ItemTokenRepository itemTokenRepository;
    @Mock
    private CampaignParticipantRepository participantRepository;
    @Mock
    private CampaignRepository campaignRepository;
    @Mock
    private StockTransactionRepository stockTransactionRepository;

    private TokenService tokenService;

    @BeforeEach
    void setUp() {
        StockService stockService = new StockService(stockTransactionRepository);
        tokenService = new TokenService(
                itemTokenRepository,
                participantRepository,
                campaignRepository,
                stockService
        );
        lenient().when(stockTransactionRepository.save(any(StockTransaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void deleteHoldingCampaignTokenIncrementsPoolAndRemovesToken() {
        UUID tokenId = UUID.randomUUID();
        UUID campaignId = UUID.randomUUID();
        UUID participantId = UUID.randomUUID();

        Product product = product("Lipstick", 50);
        Customer customer = customer("Lan");
        Campaign campaign = openCampaign(campaignId, "Spring", 10, product, 10);
        campaign.getPoolItems().getFirst().setRemainingQuantity(7);
        CampaignParticipant participant = confirmedParticipant(campaign, customer, 3);
        setId(participant, participantId);

        ItemToken token = new ItemToken(
                product,
                customer,
                BigDecimal.valueOf(100_000),
                BigDecimal.valueOf(50_000),
                SourceType.CAMPAIGN,
                participantId
        );
        setId(token, tokenId);

        when(itemTokenRepository.findById(tokenId)).thenReturn(Optional.of(token));
        when(participantRepository.findById(participantId)).thenReturn(Optional.of(participant));
        when(campaignRepository.findByIdWithPool(campaignId)).thenReturn(Optional.of(campaign));

        tokenService.deleteRecordedCampaignToken(tokenId);

        assertEquals(8, campaign.getPoolItems().getFirst().getRemainingQuantity());
        assertEquals(50, product.getStockQuantity());
        verify(itemTokenRepository).delete(token);
        verify(stockTransactionRepository, never()).save(any(StockTransaction.class));
    }

    @Test
    void deleteRejectsExchangedToken() {
        UUID tokenId = UUID.randomUUID();
        Product product = product("Lipstick", 50);
        Customer customer = customer("Lan");
        ItemToken token = new ItemToken(
                product,
                customer,
                BigDecimal.valueOf(100_000),
                BigDecimal.valueOf(50_000),
                SourceType.CAMPAIGN,
                UUID.randomUUID()
        );
        setId(token, tokenId);
        token.setStatus(TokenStatus.EXCHANGED);

        when(itemTokenRepository.findById(tokenId)).thenReturn(Optional.of(token));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> tokenService.deleteRecordedCampaignToken(tokenId)
        );
        assertTrue(ex.getMessage().contains("HOLDING"));
        verify(itemTokenRepository, never()).delete(any());
        verify(stockTransactionRepository, never()).save(any(StockTransaction.class));
    }

    @Test
    void deleteRejectsOrderedToken() {
        UUID tokenId = UUID.randomUUID();
        Product product = product("Lipstick", 50);
        Customer customer = customer("Lan");
        ItemToken token = new ItemToken(
                product,
                customer,
                BigDecimal.valueOf(100_000),
                BigDecimal.valueOf(50_000),
                SourceType.CAMPAIGN,
                UUID.randomUUID()
        );
        setId(token, tokenId);
        token.setStatus(TokenStatus.ORDERED);

        when(itemTokenRepository.findById(tokenId)).thenReturn(Optional.of(token));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> tokenService.deleteRecordedCampaignToken(tokenId)
        );
        assertTrue(ex.getMessage().contains("ORDERED"));
        verify(itemTokenRepository, never()).delete(any());
    }

    @Test
    void deleteRejectsExchangeSourceToken() {
        UUID tokenId = UUID.randomUUID();
        Product product = product("Lipstick", 50);
        Customer customer = customer("Lan");
        ItemToken token = new ItemToken(
                product,
                customer,
                BigDecimal.valueOf(100_000),
                BigDecimal.valueOf(50_000),
                SourceType.EXCHANGE,
                UUID.randomUUID()
        );
        setId(token, tokenId);

        when(itemTokenRepository.findById(tokenId)).thenReturn(Optional.of(token));

        BusinessException ex = assertThrows(
                BusinessException.class,
                () -> tokenService.deleteRecordedCampaignToken(tokenId)
        );
        assertTrue(ex.getMessage().toLowerCase().contains("exchange"));
        verify(itemTokenRepository, never()).delete(any());
        verify(stockTransactionRepository, never()).save(any(StockTransaction.class));
    }

    private Campaign openCampaign(
            UUID campaignId,
            String name,
            int totalBags,
            Product product,
            int loaded
    ) {
        Campaign campaign = new Campaign(name, LocalDate.of(2026, 7, 1), BigDecimal.valueOf(100_000), totalBags);
        setId(campaign, campaignId);
        campaign.addPoolItem(new CampaignPool(product, loaded));
        setId(campaign.getPoolItems().getFirst(), UUID.randomUUID());
        return campaign;
    }

    private static CampaignParticipant confirmedParticipant(Campaign campaign, Customer customer, int bags) {
        BigDecimal prepaid = campaign.getBagPrice().multiply(BigDecimal.valueOf(bags));
        CampaignParticipant participant = new CampaignParticipant(
                campaign, customer, bags, prepaid, ParticipantStatus.CONFIRMED
        );
        campaign.getParticipants().add(participant);
        return participant;
    }

    private Product product(String name, int stock) {
        Product product = new Product(name, BigDecimal.valueOf(250_000), stock);
        setId(product, UUID.randomUUID());
        return product;
    }

    private Customer customer(String name) {
        Customer customer = new Customer(name, "0900000000", null);
        setId(customer, UUID.randomUUID());
        return customer;
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
