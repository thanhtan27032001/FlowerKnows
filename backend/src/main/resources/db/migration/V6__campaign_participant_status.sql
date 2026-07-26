ALTER TABLE campaign_participant
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED';

-- Existing rows are all real (paid) participants — default above already
-- backfills them correctly as CONFIRMED, no separate UPDATE needed.
