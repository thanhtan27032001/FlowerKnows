package com.gaden.flowerknows.campaign;

import com.gaden.flowerknows.common.BusinessException;
import com.gaden.flowerknows.customer.Customer;
import com.gaden.flowerknows.customer.CustomerService;
import com.gaden.flowerknows.exchange.ExchangeTransactionRepository;
import com.gaden.flowerknows.order.OrderRepository;
import com.gaden.flowerknows.product.Product;
import com.gaden.flowerknows.product.ProductRepository;
import com.gaden.flowerknows.stock.StockService;
import com.gaden.flowerknows.stock.StockTransaction;
import com.gaden.flowerknows.stock.StockTransactionRepository;
import com.gaden.flowerknows.token.ItemTokenRepository;
import com.gaden.flowerknows.token.SourceType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecordItemsServiceTests {

    @Mock private CampaignRepository campaignRepository;
    @Mock private CampaignParticipantRepository participantRepository;
    @Mock private ProductRepository productRepository;
    @Mock private StockTransactionRepository stockTransactionRepository;
    @Mock private ItemTokenRepository itemTokenRepository;
    @Mock private CustomerService customerService;
    @Mock private ExchangeTransactionRepository exchangeRepository;
    @Mock private OrderRepository orderRepository;

    private ParticipantService participantService;

    @BeforeEach
    void setUp() {
        StockService stockService = new StockService(stockTransactionRepository);
        CampaignService campaignService = new CampaignService(
                campaignRepository, participantRepository, productRepository,
                stockService, itemTokenRepository
        );
        participantService = new ParticipantService(
                campaignService, participantRepository, customerService,
                itemTokenRepository, exchangeRepository, orderRepository
        );
        lenient().when(stockTransactionRepository.save(any(StockTransaction.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        lenient().when(itemTokenRepository.saveAll(any()))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void recordSingleLineCreatesTokensAndDecrementsPool() {
        UUID campaignId = UUID.randomUUID();
        Product product = product("Lipstick", 100);
        Campaign campaign = openCampaign(campaignId, 5, product, 5);
        Customer customer = customer("Lan");
        CampaignParticipant participant = confirmedParticipant(campaign, customer, 5);
        setId(participant, UUID.randomUUID());

        when(campaignRepository.findByIdWithPool(campaignId)).thenReturn(Optional.of(campaign));
        when(participantRepository.findByCampaignIdAndCustomerId(campaignId, customer.getId()))
                .thenReturn(Optional.of(participant));
        when(itemTokenRepository.countBySourceTypeAndSourceId(SourceType.CAMPAIGN, participant.getId()))
                .thenReturn(0L);

        List<ParticipantService.TokenRecordResponse> result = participantService.recordItems(
                campaignId,
                new ParticipantService.RecordItemsRequest(
                        customer.getId(),
                        List.of(new ParticipantService.RecordItemLine(product.getId(), 2))
                )
        );

        assertEquals(2, result.size());
        assertEquals(3, campaign.getPoolItems().getFirst().getRemainingQuantity());
    }

    @Test
    void recordMultiLineCreatesTokensForEachLineAndDecrementsEachPool() {
        UUID campaignId = UUID.randomUUID();
        Product productA = product("Lipstick", 100);
        Product productB = product("Mascara", 50);
        Campaign campaign = openCampaignMultiPool(campaignId, 10, productA, 5, productB, 5);
        Customer customer = customer("Lan");
        CampaignParticipant participant = confirmedParticipant(campaign, customer, 10);
        setId(participant, UUID.randomUUID());

        when(campaignRepository.findByIdWithPool(campaignId)).thenReturn(Optional.of(campaign));
        when(participantRepository.findByCampaignIdAndCustomerId(campaignId, customer.getId()))
                .thenReturn(Optional.of(participant));
        when(itemTokenRepository.countBySourceTypeAndSourceId(SourceType.CAMPAIGN, participant.getId()))
                .thenReturn(0L);

        List<ParticipantService.TokenRecordResponse> result = participantService.recordItems(
                campaignId,
                new ParticipantService.RecordItemsRequest(
                        customer.getId(),
                        List.of(
                                new ParticipantService.RecordItemLine(productA.getId(), 2),
                                new ParticipantService.RecordItemLine(productB.getId(), 1)
                        )
                )
        );

        assertEquals(3, result.size());
        assertEquals(3, campaign.getPoolItems().get(0).getRemainingQuantity()); // 5 - 2
        assertEquals(4, campaign.getPoolItems().get(1).getRemainingQuantity()); // 5 - 1
    }

    @Test
    void rejectEntireBatchWhenTotalExceedsBagsPurchased() {
        UUID campaignId = UUID.randomUUID();
        Product productA = product("Lipstick", 100);
        Product productB = product("Mascara", 50);
        Campaign campaign = openCampaignMultiPool(campaignId, 3, productA, 5, productB, 5);
        Customer customer = customer("Lan");
        CampaignParticipant participant = confirmedParticipant(campaign, customer, 3);
        setId(participant, UUID.randomUUID());

        when(campaignRepository.findByIdWithPool(campaignId)).thenReturn(Optional.of(campaign));
        when(participantRepository.findByCampaignIdAndCustomerId(campaignId, customer.getId()))
                .thenReturn(Optional.of(participant));
        when(itemTokenRepository.countBySourceTypeAndSourceId(SourceType.CAMPAIGN, participant.getId()))
                .thenReturn(2L); // already recorded 2 of 3

        BusinessException ex = assertThrows(
                BusinessException.class,
                () -> participantService.recordItems(
                        campaignId,
                        new ParticipantService.RecordItemsRequest(
                                customer.getId(),
                                List.of(
                                        new ParticipantService.RecordItemLine(productA.getId(), 1),
                                        new ParticipantService.RecordItemLine(productB.getId(), 1)
                                )
                        )
                )
        );

        assertTrue(ex.getMessage().contains("exceeding"));
        // Pool must not have been modified
        assertEquals(5, campaign.getPoolItems().get(0).getRemainingQuantity());
        assertEquals(5, campaign.getPoolItems().get(1).getRemainingQuantity());
        verify(itemTokenRepository, never()).saveAll(any());
    }

    @Test
    void rejectEntireBatchWhenOneLineExceedsPoolReturningFaultyLines() {
        UUID campaignId = UUID.randomUUID();
        Product productA = product("Lipstick", 100);
        Product productB = product("Mascara", 50);
        Campaign campaign = openCampaignMultiPool(campaignId, 10, productA, 5, productB, 1);
        Customer customer = customer("Lan");
        CampaignParticipant participant = confirmedParticipant(campaign, customer, 10);
        setId(participant, UUID.randomUUID());

        when(campaignRepository.findByIdWithPool(campaignId)).thenReturn(Optional.of(campaign));
        when(participantRepository.findByCampaignIdAndCustomerId(campaignId, customer.getId()))
                .thenReturn(Optional.of(participant));
        when(itemTokenRepository.countBySourceTypeAndSourceId(SourceType.CAMPAIGN, participant.getId()))
                .thenReturn(0L);

        // productA: request 2 of 5 remaining — OK
        // productB: request 3 of 1 remaining — FAIL
        ParticipantService.BatchLineException ex = assertThrows(
                ParticipantService.BatchLineException.class,
                () -> participantService.recordItems(
                        campaignId,
                        new ParticipantService.RecordItemsRequest(
                                customer.getId(),
                                List.of(
                                        new ParticipantService.RecordItemLine(productA.getId(), 2),
                                        new ParticipantService.RecordItemLine(productB.getId(), 3)
                                )
                        )
                )
        );

        assertEquals(1, ex.getLineErrors().size());
        assertEquals(1, ex.getLineErrors().getFirst().lineIndex());
        assertEquals(productB.getId(), ex.getLineErrors().getFirst().productId());
        assertTrue(ex.getLineErrors().getFirst().message().contains("1"));
        // Neither pool should have changed
        assertEquals(5, campaign.getPoolItems().get(0).getRemainingQuantity());
        assertEquals(1, campaign.getPoolItems().get(1).getRemainingQuantity());
        verify(itemTokenRepository, never()).saveAll(any());
    }

    @Test
    void rejectEntireBatchWhenProductNotInPool() {
        UUID campaignId = UUID.randomUUID();
        Product product = product("Lipstick", 100);
        Campaign campaign = openCampaign(campaignId, 5, product, 5);
        Customer customer = customer("Lan");
        CampaignParticipant participant = confirmedParticipant(campaign, customer, 5);
        setId(participant, UUID.randomUUID());

        when(campaignRepository.findByIdWithPool(campaignId)).thenReturn(Optional.of(campaign));
        when(participantRepository.findByCampaignIdAndCustomerId(campaignId, customer.getId()))
                .thenReturn(Optional.of(participant));
        when(itemTokenRepository.countBySourceTypeAndSourceId(SourceType.CAMPAIGN, participant.getId()))
                .thenReturn(0L);

        UUID unknownProductId = UUID.randomUUID();
        ParticipantService.BatchLineException ex = assertThrows(
                ParticipantService.BatchLineException.class,
                () -> participantService.recordItems(
                        campaignId,
                        new ParticipantService.RecordItemsRequest(
                                customer.getId(),
                                List.of(new ParticipantService.RecordItemLine(unknownProductId, 1))
                        )
                )
        );

        assertEquals(1, ex.getLineErrors().size());
        assertTrue(ex.getLineErrors().getFirst().message().contains("not in this campaign pool"));
    }

    // --- helpers ---

    private Campaign openCampaign(UUID id, int totalBags, Product product, int loaded) {
        Campaign campaign = new Campaign("Test", LocalDate.of(2026, 7, 1), BigDecimal.valueOf(100_000), totalBags);
        setId(campaign, id);
        CampaignPool pool = new CampaignPool(product, loaded);
        campaign.addPoolItem(pool);
        setId(pool, UUID.randomUUID());
        return campaign;
    }

    private Campaign openCampaignMultiPool(UUID id, int totalBags,
                                           Product pA, int loadedA,
                                           Product pB, int loadedB) {
        Campaign campaign = new Campaign("Test", LocalDate.of(2026, 7, 1), BigDecimal.valueOf(100_000), totalBags);
        setId(campaign, id);
        CampaignPool poolA = new CampaignPool(pA, loadedA);
        campaign.addPoolItem(poolA);
        setId(poolA, UUID.randomUUID());
        CampaignPool poolB = new CampaignPool(pB, loadedB);
        campaign.addPoolItem(poolB);
        setId(poolB, UUID.randomUUID());
        return campaign;
    }

    private static CampaignParticipant confirmedParticipant(Campaign campaign, Customer customer, int bags) {
        BigDecimal prepaid = campaign.getBagPrice().multiply(BigDecimal.valueOf(bags));
        CampaignParticipant p = new CampaignParticipant(campaign, customer, bags, prepaid, ParticipantStatus.CONFIRMED);
        campaign.getParticipants().add(p);
        return p;
    }

    private Product product(String name, int stock) {
        Product p = new Product(name, BigDecimal.valueOf(250_000), stock);
        setId(p, UUID.randomUUID());
        return p;
    }

    private Customer customer(String name) {
        Customer c = new Customer(name, "0900000000", null);
        setId(c, UUID.randomUUID());
        return c;
    }

    private static void setId(Object entity, UUID id) {
        try {
            var f = entity.getClass().getDeclaredField("id");
            f.setAccessible(true);
            f.set(entity, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
