package com.gaden.flowerknows.customer;

import com.gaden.flowerknows.campaign.CampaignParticipantRepository;
import com.gaden.flowerknows.directsale.DirectSaleRepository;
import com.gaden.flowerknows.exchange.ExchangeTransactionRepository;
import com.gaden.flowerknows.order.OrderRepository;
import com.gaden.flowerknows.order.ShippingStatus;
import com.gaden.flowerknows.token.ItemTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomerServiceTests {

    @Mock
    private CustomerRepository customerRepository;
    @Mock
    private ItemTokenRepository itemTokenRepository;
    @Mock
    private CampaignParticipantRepository participantRepository;
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private ExchangeTransactionRepository exchangeRepository;
    @Mock
    private DirectSaleRepository directSaleRepository;

    private CustomerService customerService;

    @BeforeEach
    void setUp() {
        customerService = new CustomerService(
                customerRepository,
                itemTokenRepository,
                participantRepository,
                orderRepository,
                exchangeRepository,
                directSaleRepository
        );
    }

    @Test
    void searchSortsActionStatusByBusinessOrdinalNotAlphabetical() {
        // Alphabetical enum names would be:
        // CONSOLIDATING, NEEDS_IMMEDIATE_ORDER, NEEDS_NEGOTIATE, NEGOTIATING, UNDETERMINED
        // Business sequence (US-19 AC#9):
        // UNDETERMINED → NEEDS_NEGOTIATE → NEGOTIATING → CONSOLIDATING → NEEDS_IMMEDIATE_ORDER
        Customer consolidating = customer("Zebra", CustomerActionStatus.CONSOLIDATING);
        Customer needsImmediate = customer("Alpha", CustomerActionStatus.NEEDS_IMMEDIATE_ORDER);
        Customer needsNegotiate = customer("Mike", CustomerActionStatus.NEEDS_NEGOTIATE);
        Customer negotiating = customer("Beta", CustomerActionStatus.NEGOTIATING);
        Customer undetermined = customer("Charlie", CustomerActionStatus.UNDETERMINED);

        when(customerRepository.findAll()).thenReturn(List.of(
                consolidating, needsImmediate, needsNegotiate, negotiating, undetermined
        ));
        when(orderRepository.findLatestShippingStatusByCustomer()).thenReturn(List.of());

        List<CustomerDtos.CustomerResponse> asc = customerService.search(
                null, null, null, "actionStatus", "asc"
        );
        assertEquals(
                List.of(
                        CustomerActionStatus.UNDETERMINED,
                        CustomerActionStatus.NEEDS_NEGOTIATE,
                        CustomerActionStatus.NEGOTIATING,
                        CustomerActionStatus.CONSOLIDATING,
                        CustomerActionStatus.NEEDS_IMMEDIATE_ORDER
                ),
                asc.stream().map(CustomerDtos.CustomerResponse::actionStatus).toList()
        );

        List<CustomerDtos.CustomerResponse> desc = customerService.search(
                null, null, null, "actionStatus", "desc"
        );
        assertEquals(
                List.of(
                        CustomerActionStatus.NEEDS_IMMEDIATE_ORDER,
                        CustomerActionStatus.CONSOLIDATING,
                        CustomerActionStatus.NEGOTIATING,
                        CustomerActionStatus.NEEDS_NEGOTIATE,
                        CustomerActionStatus.UNDETERMINED
                ),
                desc.stream().map(CustomerDtos.CustomerResponse::actionStatus).toList()
        );
    }

    @Test
    void searchSortsShippingStatusWithNullsAlwaysLast() {
        Customer noOrder = customer("NoOrder", CustomerActionStatus.UNDETERMINED);
        Customer created = customer("Created", CustomerActionStatus.UNDETERMINED);
        Customer shipped = customer("Shipped", CustomerActionStatus.UNDETERMINED);
        Customer completed = customer("Completed", CustomerActionStatus.UNDETERMINED);

        when(customerRepository.findAll()).thenReturn(List.of(noOrder, completed, created, shipped));
        when(orderRepository.findLatestShippingStatusByCustomer()).thenReturn(List.of(
                new Object[]{created.getId(), ShippingStatus.ORDER_CREATED.name()},
                new Object[]{shipped.getId(), ShippingStatus.SHIPPED.name()},
                new Object[]{completed.getId(), ShippingStatus.COMPLETED.name()}
        ));

        List<String> ascNames = customerService.search(null, null, null, "shippingStatus", "asc")
                .stream()
                .map(CustomerDtos.CustomerResponse::name)
                .toList();
        assertEquals(List.of("Created", "Shipped", "Completed", "NoOrder"), ascNames);

        List<String> descNames = customerService.search(null, null, null, "shippingStatus", "desc")
                .stream()
                .map(CustomerDtos.CustomerResponse::name)
                .toList();
        assertEquals(List.of("Completed", "Shipped", "Created", "NoOrder"), descNames);
    }

    @Test
    void searchDefaultsToUpdatedAtDescending() {
        Instant older = Instant.parse("2026-01-01T00:00:00Z");
        Instant newer = Instant.parse("2026-06-01T00:00:00Z");
        Customer oldCustomer = customer("Old", CustomerActionStatus.UNDETERMINED, older);
        Customer newCustomer = customer("New", CustomerActionStatus.UNDETERMINED, newer);

        when(customerRepository.findAll()).thenReturn(List.of(oldCustomer, newCustomer));
        when(orderRepository.findLatestShippingStatusByCustomer()).thenReturn(List.of());

        List<String> names = customerService.search(null, null, null, null, null)
                .stream()
                .map(CustomerDtos.CustomerResponse::name)
                .toList();
        assertEquals(List.of("New", "Old"), names);
    }

    @Test
    void actionStatusOrdinalMatchesBusinessSequence() {
        assertEquals(0, CustomerService.actionStatusOrdinal(CustomerActionStatus.UNDETERMINED));
        assertEquals(1, CustomerService.actionStatusOrdinal(CustomerActionStatus.NEEDS_NEGOTIATE));
        assertEquals(2, CustomerService.actionStatusOrdinal(CustomerActionStatus.NEGOTIATING));
        assertEquals(3, CustomerService.actionStatusOrdinal(CustomerActionStatus.CONSOLIDATING));
        assertEquals(4, CustomerService.actionStatusOrdinal(CustomerActionStatus.NEEDS_IMMEDIATE_ORDER));
    }

    @Test
    void resolveSortRejectsInvalidSortBy() {
        assertThrows(
                IllegalArgumentException.class,
                () -> CustomerService.resolveSortComparator("bogus", "asc", Map.of())
        );
    }

    @Test
    void resolveSortRejectsInvalidSortDir() {
        assertThrows(
                IllegalArgumentException.class,
                () -> CustomerService.resolveAscending("up")
        );
    }

    private static Customer customer(String name, CustomerActionStatus actionStatus) {
        return customer(name, actionStatus, Instant.parse("2026-01-01T00:00:00Z"));
    }

    private static Customer customer(
            String name,
            CustomerActionStatus actionStatus,
            Instant updatedAt
    ) {
        Customer c = new Customer(name, null, null);
        c.setActionStatus(actionStatus);
        setId(c, UUID.randomUUID());
        setField(c, "createdAt", updatedAt);
        setField(c, "updatedAt", updatedAt);
        return c;
    }

    private static void setId(Object entity, UUID id) {
        setField(entity, "id", id);
    }

    private static void setField(Object entity, String fieldName, Object value) {
        try {
            Field field = entity.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(entity, value);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
