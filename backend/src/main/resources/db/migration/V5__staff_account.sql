CREATE TABLE staff_account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_account_username ON staff_account (username);

-- NOTE: The first Owner account is intentionally NOT seeded here.
-- See business-spec.md US-23 — it must be created by an ApplicationRunner
-- reading credentials from environment variables, so no password is ever
-- committed to version control.
