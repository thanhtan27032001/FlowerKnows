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
import com.gaden.flowerknows.stock.StockTransactionType;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CampaignLifecycleServiceTests {

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
    @Mock
    private CustomerService customerService;
    @Mock
    private ExchangeTransactionRepository exchangeRepository;
    @Mock
    private OrderRepository orderRepository;

    private StockService stockService;
    private CampaignService campaignService;
    private ParticipantService participantService;

    @BeforeEach
    void setUp() {
        stockService = new StockService(stockTransactionRepository);
        campaignService = new CampaignService(
                campaignRepository,
                participantRepository,
                productRepository,
                stockService,
                itemTokenRepository
        );
        participantService = new ParticipantService(
                campaignService,
                participantRepository,
                customerService,
                itemTokenRepository,
                exchangeRepository,
                orderRepository
        );
        lenient().when(stockTransactionRepository.save(any(StockTransaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void updatePoolIsBlockedOnceAnyItemHasBeenRecorded() {
        UUID campaignId = UUID.randomUUID();
        Product product = product("Lipstick", 100);
        Campaign campaign = openCampaign(campaignId, "Spring", 10, product, 10);
        campaign.getPoolItems().getFirst().setRemainingQuantity(9);

        when(campaignRepository.findByIdWithPool(campaignId)).thenReturn(Optional.of(campaign));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> campaignService.updatePool(
                        campaignId,
                        new CampaignDtos.UpdatePoolRequest(
                                List.of(new CampaignDtos.PoolItemRequest(product.getId(), 12))
                        )
                )
        );

        assertTrue(ex.getMessage().contains("đã bị khóa"));
        verify(stockTransactionRepository, never()).save(any(StockTransaction.class));
    }

    @Test
    void deleteCampaignIsBlockedWhenAnyParticipantExists() {
        UUID campaignId = UUID.randomUUID();
        Product product = product("Lipstick", 100);
        Campaign campaign = openCampaign(campaignId, "Spring", 10, product, 10);

        when(campaignRepository.findByIdWithPool(campaignId)).thenReturn(Optional.of(campaign));
        when(participantRepository.countByCampaignId(campaignId)).thenReturn(1L);

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> campaignService.deleteCampaign(campaignId)
        );

        assertTrue(ex.getMessage().contains("Không thể xóa"));
        verify(campaignRepository, never()).delete(any());
        verify(stockTransactionRepository, never()).save(any(StockTransaction.class));
    }

    @Test
    void editParticipantCannotShrinkBelowRecordedTokenCount() {
        UUID campaignId = UUID.randomUUID();
        UUID participantId = UUID.randomUUID();
        Product product = product("Lipstick", 100);
        Campaign campaign = openCampaign(campaignId, "Spring", 10, product, 10);
        Customer customer = customer("Lan");
        CampaignParticipant participant = confirmedParticipant(campaign, customer, 5);
        setId(participant, participantId);

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));
        when(participantRepository.findById(participantId)).thenReturn(Optional.of(participant));
        when(itemTokenRepository.countBySourceTypeAndSourceId(SourceType.CAMPAIGN, participantId))
                .thenReturn(3L);

        BusinessException ex = assertThrows(
                BusinessException.class,
                () -> participantService.updateParticipant(
                        campaignId,
                        participantId,
                        new CampaignDtos.UpdateParticipantRequest(2)
                )
        );

        assertTrue(ex.getMessage().contains("3 túi"));
        assertEquals(5, participant.getTotalBagsPurchased());
    }

    @Test
    void draftParticipantDoesNotCountTowardRemainingBags() {
        UUID campaignId = UUID.randomUUID();
        Product product = product("Lipstick", 100);
        Campaign campaign = openCampaign(campaignId, "Spring", 10, product, 10);
        Customer draftCustomer = customer("Draft");
        Customer buyer = customer("Buyer");

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));
        when(participantRepository.sumBagsPurchasedByCampaign(campaignId)).thenReturn(0L);
        when(customerService.requireCustomer(buyer.getId())).thenReturn(buyer);
        when(participantRepository.findByCampaignIdAndCustomerId(campaignId, buyer.getId()))
                .thenReturn(Optional.empty());
        when(participantRepository.save(any(CampaignParticipant.class)))
                .thenAnswer(invocation -> {
                    CampaignParticipant p = invocation.getArgument(0);
                    if (p.getId() == null) {
                        setId(p, UUID.randomUUID());
                    }
                    return p;
                });

        // Draft for 8 bags exists in DB but confirmed sum is still 0 — buyer can still take 10.
        CampaignParticipant ignoredDraft = new CampaignParticipant(
                campaign, draftCustomer, 8, BigDecimal.ZERO, ParticipantStatus.DRAFT
        );
        campaign.getParticipants().add(ignoredDraft);

        CampaignDtos.ParticipantSummaryResponse response = participantService.recordParticipant(
                campaignId,
                new ParticipantService.RecordParticipantRequest(buyer.getId(), null, 10)
        );

        assertEquals(ParticipantStatus.CONFIRMED, response.status());
        assertEquals(10, response.totalBagsPurchased());
    }

    @Test
    void confirmDraftRevalidatesRemainingBagsAtConfirmTime() {
        UUID campaignId = UUID.randomUUID();
        UUID draftId = UUID.randomUUID();
        Product product = product("Lipstick", 100);
        Campaign campaign = openCampaign(campaignId, "Spring", 10, product, 10);
        Customer customer = customer("Lan");
        CampaignParticipant draft = new CampaignParticipant(
                campaign, customer, 6, BigDecimal.ZERO, ParticipantStatus.DRAFT
        );
        setId(draft, draftId);
        campaign.getParticipants().add(draft);

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));
        when(participantRepository.findById(draftId)).thenReturn(Optional.of(draft));
        // Another confirmed sale took 5 bags after the draft was created — only 5 remain.
        when(participantRepository.sumBagsPurchasedByCampaign(campaignId)).thenReturn(5L);

        BusinessException ex = assertThrows(
                BusinessException.class,
                () -> participantService.confirmDraft(campaignId, draftId)
        );

        assertEquals("Only 5 bags remaining", ex.getMessage());
        assertEquals(ParticipantStatus.DRAFT, draft.getStatus());
        assertEquals(BigDecimal.ZERO, draft.getPrepaidAmount());
    }

    @Test
    void updatePoolAppliesStockDeltasWhenStillEditable() {
        UUID campaignId = UUID.randomUUID();
        Product product = product("Lipstick", 50);
        Campaign campaign = openCampaign(campaignId, "Spring", 10, product, 10);

        when(campaignRepository.findByIdWithPool(campaignId)).thenReturn(Optional.of(campaign));
        when(participantRepository.sumBagsPurchasedByCampaign(campaignId)).thenReturn(0L);

        campaignService.updatePool(
                campaignId,
                new CampaignDtos.UpdatePoolRequest(
                        List.of(new CampaignDtos.PoolItemRequest(product.getId(), 15))
                )
        );

        assertEquals(15, campaign.getPoolItems().getFirst().getLoadedQuantity());
        assertEquals(15, campaign.getPoolItems().getFirst().getRemainingQuantity());
        assertEquals(45, product.getStockQuantity());
    }

    @Test
    void recordItemsRejectsDraftParticipant() {
        UUID campaignId = UUID.randomUUID();
        Product product = product("Lipstick", 100);
        Campaign campaign = openCampaign(campaignId, "Spring", 10, product, 10);
        Customer customer = customer("Lan");
        CampaignParticipant draft = new CampaignParticipant(
                campaign, customer, 3, BigDecimal.ZERO, ParticipantStatus.DRAFT
        );
        setId(draft, UUID.randomUUID());
        campaign.getParticipants().add(draft);

        when(campaignRepository.findByIdWithPool(campaignId)).thenReturn(Optional.of(campaign));
        when(participantRepository.findByCampaignIdAndCustomerId(campaignId, customer.getId()))
                .thenReturn(Optional.of(draft));

        BusinessException ex = assertThrows(
                BusinessException.class,
                () -> participantService.recordItems(
                        campaignId,
                        new ParticipantService.RecordItemsRequest(
                                customer.getId(),
                                product.getId(),
                                1
                        )
                )
        );

        assertTrue(ex.getMessage().contains("confirmed"));
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
