package com.gaden.flowerknows.campaign;

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
import org.mockito.ArgumentCaptor;
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
class CampaignCloseReopenServiceTests {

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

    private CampaignService campaignService;
    private ParticipantService participantService;

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
        lenient().when(itemTokenRepository.saveAll(any()))
                .thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(participantRepository.sumBagsPurchasedByCampaign(any()))
                .thenReturn(0L);
    }

    @Test
    void closeCampaignReturnsStockButPreservesRemainingQuantity() {
        UUID campaignId = UUID.randomUUID();
        Product product = product("Lipstick", 40);
        Campaign campaign = openCampaign(campaignId, "Spring", 10, product, 10);
        campaign.getPoolItems().getFirst().setRemainingQuantity(4);

        when(campaignRepository.findByIdWithPool(campaignId)).thenReturn(Optional.of(campaign));

        campaignService.closeCampaign(campaignId);

        assertEquals(CampaignStatus.CLOSED, campaign.getStatus());
        assertEquals(4, campaign.getPoolItems().getFirst().getRemainingQuantity());
        assertEquals(44, product.getStockQuantity()); // 40 + 4

        ArgumentCaptor<StockTransaction> captor = ArgumentCaptor.forClass(StockTransaction.class);
        verify(stockTransactionRepository).save(captor.capture());
        assertEquals(StockTransactionType.CAMPAIGN_RETURN, captor.getValue().getType());
        assertEquals(4, captor.getValue().getQuantityChange());
    }

    @Test
    void reopenCampaignRelocksPreservedRemainingStock() {
        UUID campaignId = UUID.randomUUID();
        Product product = product("Lipstick", 50);
        Campaign campaign = openCampaign(campaignId, "Spring", 10, product, 10);
        campaign.getPoolItems().getFirst().setRemainingQuantity(4);
        campaign.setStatus(CampaignStatus.CLOSED);

        when(campaignRepository.findByIdWithPool(campaignId)).thenReturn(Optional.of(campaign));

        campaignService.reopenCampaign(campaignId);

        assertEquals(CampaignStatus.OPEN, campaign.getStatus());
        assertEquals(4, campaign.getPoolItems().getFirst().getRemainingQuantity());
        assertEquals(46, product.getStockQuantity()); // 50 - 4

        ArgumentCaptor<StockTransaction> captor = ArgumentCaptor.forClass(StockTransaction.class);
        verify(stockTransactionRepository).save(captor.capture());
        assertEquals(StockTransactionType.CAMPAIGN_LOCK, captor.getValue().getType());
        assertEquals(-4, captor.getValue().getQuantityChange());
    }

    @Test
    void reopenFailsAtomicallyWhenAnyProductLacksStock() {
        UUID campaignId = UUID.randomUUID();
        Product lipstick = product("Lipstick", 50);
        Product blush = product("Blush", 1);
        Campaign campaign = new Campaign("Spring", LocalDate.of(2026, 7, 1), BigDecimal.valueOf(100_000), 15);
        setId(campaign, campaignId);
        campaign.addPoolItem(new CampaignPool(lipstick, 10));
        campaign.addPoolItem(new CampaignPool(blush, 5));
        setId(campaign.getPoolItems().get(0), UUID.randomUUID());
        setId(campaign.getPoolItems().get(1), UUID.randomUUID());
        campaign.getPoolItems().get(0).setRemainingQuantity(4);
        campaign.getPoolItems().get(1).setRemainingQuantity(3); // needs 3, only 1 available
        campaign.setStatus(CampaignStatus.CLOSED);

        when(campaignRepository.findByIdWithPool(campaignId)).thenReturn(Optional.of(campaign));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> campaignService.reopenCampaign(campaignId)
        );
        assertTrue(ex.getMessage().contains("Không đủ hàng để mở lại"));
        assertTrue(ex.getMessage().contains("Blush"));

        assertEquals(CampaignStatus.CLOSED, campaign.getStatus());
        assertEquals(50, lipstick.getStockQuantity());
        assertEquals(1, blush.getStockQuantity());
        verify(stockTransactionRepository, never()).save(any());
    }

    @Test
    void recordItemsDoesNotAutoCloseWhenPoolFullyConsumed() {
        UUID campaignId = UUID.randomUUID();
        Product product = product("Lipstick", 100);
        Campaign campaign = openCampaign(campaignId, "Spring", 2, product, 2);
        campaign.getPoolItems().getFirst().setRemainingQuantity(1);

        Customer customer = customer("Lan");
        CampaignParticipant participant = confirmedParticipant(campaign, customer, 2);
        setId(participant, UUID.randomUUID());

        when(campaignRepository.findByIdWithPool(campaignId)).thenReturn(Optional.of(campaign));
        when(participantRepository.findByCampaignIdAndCustomerId(campaignId, customer.getId()))
                .thenReturn(Optional.of(participant));
        when(itemTokenRepository.countBySourceTypeAndSourceId(SourceType.CAMPAIGN, participant.getId()))
                .thenReturn(1L);

        participantService.recordItems(
                campaignId,
                new ParticipantService.RecordItemsRequest(customer.getId(), product.getId(), 1)
        );

        assertEquals(0, campaign.getPoolItems().getFirst().getRemainingQuantity());
        assertEquals(CampaignStatus.OPEN, campaign.getStatus());
        verify(stockTransactionRepository, never()).save(any());
    }

    @Test
    void reopenWithZeroRemainingJustFlipsStatus() {
        UUID campaignId = UUID.randomUUID();
        Product product = product("Lipstick", 50);
        Campaign campaign = openCampaign(campaignId, "Spring", 10, product, 10);
        campaign.getPoolItems().getFirst().setRemainingQuantity(0);
        campaign.setStatus(CampaignStatus.CLOSED);

        when(campaignRepository.findByIdWithPool(campaignId)).thenReturn(Optional.of(campaign));

        campaignService.reopenCampaign(campaignId);

        assertEquals(CampaignStatus.OPEN, campaign.getStatus());
        assertEquals(50, product.getStockQuantity());
        verify(stockTransactionRepository, never()).save(any());
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
