package com.gaden.flowerknows.campaign;

import com.gaden.flowerknows.customer.CustomerService;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Manual/diagnostic IT: measures Hibernate prepareStatement counts for the
 * Campaign detail + participant tokens + customer search endpoints' service layer.
 *
 * Run: {@code ./mvnw -Dtest=NPlusOneQueryCountIT test -Dspring.profiles.active=local}
 */
@SpringBootTest
@ActiveProfiles("local")
class NPlusOneQueryCountIT {

    private static final String DIAG_CAMPAIGN = "N+1 Diagnostic Campaign";

    @Autowired
    private CampaignService campaignService;
    @Autowired
    private ParticipantService participantService;
    @Autowired
    private CustomerService customerService;
    @Autowired
    private EntityManagerFactory entityManagerFactory;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void reportQueryCountsForDiagnosticCampaign() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                        SELECT c.id AS campaign_id, p.id AS participant_id, cust.name AS customer_name,
                               (SELECT COUNT(*) FROM item_token t
                                  WHERE t.source_type = 'CAMPAIGN' AND t.source_id = p.id) AS token_count
                        FROM campaign c
                        JOIN campaign_participant p ON p.campaign_id = c.id
                        JOIN customer cust ON cust.id = p.customer_id
                        WHERE c.name = ?
                        ORDER BY cust.name
                        """,
                DIAG_CAMPAIGN
        );
        Assumptions.assumeFalse(rows.isEmpty(), "Seed '" + DIAG_CAMPAIGN + "' first");

        UUID campaignId = (UUID) rows.getFirst().get("campaign_id");
        UUID exchangedParticipantId = rows.stream()
                .filter(r -> "Diag Customer 1".equals(r.get("customer_name")))
                .map(r -> (UUID) r.get("participant_id"))
                .findFirst()
                .orElse((UUID) rows.getFirst().get("participant_id"));
        UUID holdingParticipantId = rows.stream()
                .filter(r -> "Diag Customer 10".equals(r.get("customer_name")))
                .map(r -> (UUID) r.get("participant_id"))
                .findFirst()
                .orElse((UUID) rows.getLast().get("participant_id"));

        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.setStatisticsEnabled(true);

        // Warmup
        campaignService.getCampaign(campaignId);
        participantService.listParticipantTokens(campaignId, exchangedParticipantId);
        customerService.search(null, null, null);

        long camp = measure(stats, () -> campaignService.getCampaign(campaignId));
        long tokensExchanged = measure(stats, () ->
                participantService.listParticipantTokens(campaignId, exchangedParticipantId));
        long tokensHolding = measure(stats, () ->
                participantService.listParticipantTokens(campaignId, holdingParticipantId));
        long customers = measure(stats, () -> customerService.search(null, null, null));

        System.out.printf(
                """
                        === N+1 query counts (%s, %d participants) ===
                        GET campaign detail:              %d
                        GET participant tokens (mixed):   %d
                        GET participant tokens (holding): %d
                        GET customers search:             %d
                        """,
                DIAG_CAMPAIGN,
                rows.size(),
                camp,
                tokensExchanged,
                tokensHolding,
                customers
        );
    }

    private static long measure(Statistics stats, Runnable action) {
        long before = stats.getPrepareStatementCount();
        action.run();
        return stats.getPrepareStatementCount() - before;
    }
}
