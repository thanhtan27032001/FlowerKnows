package com.gaden.flowerknows.account;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class OwnerAccountSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(OwnerAccountSeeder.class);

    private final StaffAccountRepository staffAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final String seedUsername;
    private final String seedPassword;
    private final String seedFullName;

    public OwnerAccountSeeder(
            StaffAccountRepository staffAccountRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.seed.owner-username:}") String seedUsername,
            @Value("${app.seed.owner-password:}") String seedPassword,
            @Value("${app.seed.owner-full-name:}") String seedFullName
    ) {
        this.staffAccountRepository = staffAccountRepository;
        this.passwordEncoder = passwordEncoder;
        this.seedUsername = seedUsername;
        this.seedPassword = seedPassword;
        this.seedFullName = seedFullName;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (staffAccountRepository.count() > 0) {
            return;
        }

        if (isBlank(seedUsername) || isBlank(seedPassword) || isBlank(seedFullName)) {
            log.warn(
                    "staff_account table is empty and SEED_OWNER_USERNAME / SEED_OWNER_PASSWORD / "
                            + "SEED_OWNER_FULL_NAME are not all set — no Owner account was seeded. "
                            + "Set these environment variables and restart to bootstrap the first Owner (US-23)."
            );
            return;
        }

        StaffAccount owner = new StaffAccount(
                seedUsername.trim(),
                passwordEncoder.encode(seedPassword),
                seedFullName.trim(),
                AccountRole.OWNER
        );
        staffAccountRepository.save(owner);
        log.info("Seeded initial Owner account '{}'", owner.getUsername());
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
