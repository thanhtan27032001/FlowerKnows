package com.gaden.flowerknows.config;

import jakarta.persistence.EntityManagerFactory;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Logs Hibernate prepareStatement count per API request.
 * Requires {@code hibernate.generate_statistics: true} (enabled in local profile).
 * Not concurrency-safe for overlapping requests — diagnosis only.
 */
@Component
@ConditionalOnBean(EntityManagerFactory.class)
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class HibernateQueryCountFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(HibernateQueryCountFilter.class);

    private final EntityManagerFactory entityManagerFactory;

    public HibernateQueryCountFilter(EntityManagerFactory entityManagerFactory) {
        this.entityManagerFactory = entityManagerFactory;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path == null || !path.startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        if (!stats.isStatisticsEnabled()) {
            stats.setStatisticsEnabled(true);
        }
        long before = stats.getPrepareStatementCount();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long queries = stats.getPrepareStatementCount() - before;
            log.info(
                    "Hibernate query count={} method={} uri={}",
                    queries,
                    request.getMethod(),
                    request.getRequestURI()
            );
        }
    }
}
