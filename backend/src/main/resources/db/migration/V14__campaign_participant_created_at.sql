ALTER TABLE campaign_participant
    ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT now();
