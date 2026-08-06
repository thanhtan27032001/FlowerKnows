-- Case-insensitive uniqueness for staff_account.username (US-21 / US-22 v4.4).
-- Fail fast if existing rows would violate LOWER(username) uniqueness.

DO $$
DECLARE
    duplicate_usernames TEXT;
BEGIN
    SELECT string_agg(lowered, ', ' ORDER BY lowered)
    INTO duplicate_usernames
    FROM (
        SELECT LOWER(username) AS lowered
        FROM staff_account
        GROUP BY LOWER(username)
        HAVING COUNT(*) > 1
    ) d;

    IF duplicate_usernames IS NOT NULL THEN
        RAISE EXCEPTION
            'Cannot apply case-insensitive username unique index: conflicting usernames exist for: %',
            duplicate_usernames;
    END IF;
END $$;

ALTER TABLE staff_account DROP CONSTRAINT IF EXISTS staff_account_username_key;

DROP INDEX IF EXISTS idx_staff_account_username;

CREATE UNIQUE INDEX uq_staff_account_username_lower ON staff_account (LOWER(username));
