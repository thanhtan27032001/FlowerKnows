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
import com.gaden.flowerknows.token.ItemTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CampaignParticipantTurnServiceTests {

    @Mock private CampaignRepository campaignRepository;
    @Mock private CampaignParticipantRepository participantRepository;
    @Mock private ProductRepository productRepository;
    @Mock private StockTransactionRepository stockTransactionRepository;
    @Mock private ItemTokenRepository itemTokenRepository;
    @Mock private CustomerService customerService;
    @Mock private ExchangeTransactionRepository exchangeRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private CampaignParticipantTurnRepository turnRepository;

    private ParticipantService participantService;
    private CampaignParticipantTurnService turnService;

    private final Map<UUID, CampaignParticipant> participantsById = new HashMap<>();
    private final List<CampaignParticipantTurn> turns = new ArrayList<>();

    @BeforeEach
    void setUp() {
        StockService stockService = new StockService(stockTransactionRepository);
        CampaignService campaignService = new CampaignService(
                campaignRepository,
                participantRepository,
                productRepository,
                stockService,
                itemTokenRepository
        );
        turnService = new CampaignParticipantTurnService(
                campaignRepository,
                participantRepository,
                turnRepository
        );
        participantService = new ParticipantService(
                campaignService,
                participantRepository,
                customerService,
                itemTokenRepository,
                exchangeRepository,
                orderRepository,
                turnService
        );

        lenient().when(stockTransactionRepository.save(any(StockTransaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(itemTokenRepository.countBySourceTypeAndSourceId(any(), any()))
                .thenReturn(0L);

        lenient().when(participantRepository.save(any(CampaignParticipant.class))).thenAnswer(inv -> {
            CampaignParticipant participant = inv.getArgument(0);
            if (participant.getId() == null) {
                setId(participant, UUID.randomUUID());
            }
            participantsById.put(participant.getId(), participant);
            return participant;
        });
        lenient().when(participantRepository.findByIdWithCampaign(any())).thenAnswer(inv ->
                Optional.ofNullable(participantsById.get(inv.getArgument(0)))
        );
        lenient().when(participantRepository.findByCampaignIdAndCustomerId(any(), any())).thenAnswer(inv -> {
            UUID campaignId = inv.getArgument(0);
            UUID customerId = inv.getArgument(1);
            return participantsById.values().stream()
                    .filter(p -> p.getCampaign().getId().equals(campaignId)
                            && p.getCustomer().getId().equals(customerId))
                    .findFirst();
        });
        lenient().when(participantRepository.sumBagsPurchasedByCampaign(any())).thenAnswer(inv -> {
            UUID campaignId = inv.getArgument(0);
            return participantsById.values().stream()
                    .filter(p -> p.getCampaign().getId().equals(campaignId)
                            && p.getStatus() == ParticipantStatus.CONFIRMED)
                    .mapToLong(CampaignParticipant::getTotalBagsPurchased)
                    .sum();
        });

        lenient().when(turnRepository.findFirstByCampaignIdOrderByTurnNumberDesc(any())).thenAnswer(inv -> {
            UUID campaignId = inv.getArgument(0);
            return turns.stream()
                    .filter(t -> t.getCampaign().getId().equals(campaignId))
                    .max(Comparator.comparingInt(CampaignParticipantTurn::getTurnNumber));
        });
        lenient().when(turnRepository.save(any(CampaignParticipantTurn.class))).thenAnswer(inv -> {
            CampaignParticipantTurn turn = inv.getArgument(0);
            if (turn.getId() == null) {
                setId(turn, UUID.randomUUID());
            }
            if (!turns.contains(turn)) {
                turns.add(turn);
            }
            return turn;
        });
        lenient().when(turnRepository.findByCampaignParticipantIdOrderByTurnNumberDesc(any())).thenAnswer(inv -> {
            UUID participantId = inv.getArgument(0);
            return turns.stream()
                    .filter(t -> t.getCampaignParticipant().getId().equals(participantId))
                    .sorted(Comparator.comparingInt(CampaignParticipantTurn::getTurnNumber).reversed())
                    .toList();
        });
        lenient().doAnswer(inv -> {
            UUID participantId = inv.getArgument(0);
            turns.removeIf(t -> t.getCampaignParticipant().getId().equals(participantId));
            return null;
        }).when(turnRepository).deleteByCampaignParticipantId(any());
        lenient().doAnswer(inv -> {
            turns.remove((CampaignParticipantTurn) inv.getArgument(0));
            return null;
        }).when(turnRepository).delete(any(CampaignParticipantTurn.class));
    }

    @Test
    void consecutiveBagsForSameCustomerMergeIntoLastTurn() {
        UUID campaignId = UUID.randomUUID();
        Campaign campaign = openCampaign(campaignId, 20);
        Customer lan = customer("Lan");

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));
        when(customerService.requireCustomer(lan.getId())).thenReturn(lan);

        participantService.recordParticipant(
                campaignId, new ParticipantService.RecordParticipantRequest(lan.getId(), null, 3)
        );
        participantService.recordParticipant(
                campaignId, new ParticipantService.RecordParticipantRequest(lan.getId(), null, 2)
        );

        assertEquals(1, turns.size());
        assertEquals(1, turns.getFirst().getTurnNumber());
        assertEquals(5, turns.getFirst().getBagCount());
        assertEquals(5, participantsById.values().iterator().next().getTotalBagsPurchased());
    }

    @Test
    void differentCustomerInterveningCreatesNewTurn() {
        UUID campaignId = UUID.randomUUID();
        Campaign campaign = openCampaign(campaignId, 20);
        Customer lan = customer("Lan");
        Customer mai = customer("Mai");

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));
        when(customerService.requireCustomer(lan.getId())).thenReturn(lan);
        when(customerService.requireCustomer(mai.getId())).thenReturn(mai);

        participantService.recordParticipant(
                campaignId, new ParticipantService.RecordParticipantRequest(lan.getId(), null, 4)
        );
        participantService.recordParticipant(
                campaignId, new ParticipantService.RecordParticipantRequest(mai.getId(), null, 2)
        );
        participantService.recordParticipant(
                campaignId, new ParticipantService.RecordParticipantRequest(lan.getId(), null, 3)
        );

        assertEquals(3, turns.size());
        List<CampaignParticipantTurn> ordered = turns.stream()
                .sorted(Comparator.comparingInt(CampaignParticipantTurn::getTurnNumber))
                .toList();
        assertEquals(1, ordered.get(0).getTurnNumber());
        assertEquals(4, ordered.get(0).getBagCount());
        assertEquals(lan.getId(), ordered.get(0).getCampaignParticipant().getCustomer().getId());
        assertEquals(2, ordered.get(1).getTurnNumber());
        assertEquals(2, ordered.get(1).getBagCount());
        assertEquals(mai.getId(), ordered.get(1).getCampaignParticipant().getCustomer().getId());
        assertEquals(3, ordered.get(2).getTurnNumber());
        assertEquals(3, ordered.get(2).getBagCount());
        assertEquals(lan.getId(), ordered.get(2).getCampaignParticipant().getCustomer().getId());
    }

    @Test
    void lifoDecreaseDeletesEmptiedTurnsAndContinuesToPrior() {
        UUID campaignId = UUID.randomUUID();
        Campaign campaign = openCampaign(campaignId, 20);
        Customer lan = customer("Lan");
        Customer mai = customer("Mai");

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));
        when(customerService.requireCustomer(lan.getId())).thenReturn(lan);
        when(customerService.requireCustomer(mai.getId())).thenReturn(mai);

        participantService.recordParticipant(
                campaignId, new ParticipantService.RecordParticipantRequest(lan.getId(), null, 5)
        );
        participantService.recordParticipant(
                campaignId, new ParticipantService.RecordParticipantRequest(mai.getId(), null, 2)
        );
        participantService.recordParticipant(
                campaignId, new ParticipantService.RecordParticipantRequest(lan.getId(), null, 3)
        );

        UUID lanParticipantId = participantsById.values().stream()
                .filter(p -> p.getCustomer().getId().equals(lan.getId()))
                .findFirst()
                .orElseThrow()
                .getId();

        participantService.updateParticipant(
                campaignId,
                lanParticipantId,
                new CampaignDtos.UpdateParticipantRequest(4)
        );

        List<CampaignParticipantTurn> remaining = turns.stream()
                .sorted(Comparator.comparingInt(CampaignParticipantTurn::getTurnNumber))
                .toList();
        assertEquals(2, remaining.size());
        assertEquals(1, remaining.get(0).getTurnNumber());
        assertEquals(4, remaining.get(0).getBagCount());
        assertEquals(lan.getId(), remaining.get(0).getCampaignParticipant().getCustomer().getId());
        assertEquals(2, remaining.get(1).getTurnNumber());
        assertEquals(2, remaining.get(1).getBagCount());
        assertEquals(mai.getId(), remaining.get(1).getCampaignParticipant().getCustomer().getId());
    }

    @Test
    void cancellingDraftCascadeDeletesItsTurns() {
        UUID campaignId = UUID.randomUUID();
        Campaign campaign = openCampaign(campaignId, 20);
        Customer lan = customer("Lan");

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));
        when(customerService.requireCustomer(lan.getId())).thenReturn(lan);

        CampaignDtos.ParticipantSummaryResponse draft = participantService.createDraft(
                campaignId, new ParticipantService.RecordParticipantRequest(lan.getId(), null, 6)
        );
        assertTrue(turns.isEmpty());

        CampaignParticipant participant = participantsById.get(draft.id());
        CampaignParticipantTurn stray = new CampaignParticipantTurn(campaign, participant, 1, 6);
        setId(stray, UUID.randomUUID());
        turns.add(stray);

        participantService.deleteParticipant(campaignId, draft.id());

        assertTrue(turns.isEmpty());
    }

    private Campaign openCampaign(UUID campaignId, int totalBags) {
        Product product = new Product("Lipstick", BigDecimal.valueOf(250_000), 100);
        setId(product, UUID.randomUUID());
        Campaign campaign = new Campaign(
                "Spring", LocalDate.of(2026, 7, 1), BigDecimal.valueOf(100_000), totalBags
        );
        setId(campaign, campaignId);
        campaign.addPoolItem(new CampaignPool(product, totalBags));
        return campaign;
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
