-- Speeds up campaign detail token aggregation (count + top-N names by participant).
CREATE INDEX IF NOT EXISTS idx_item_token_source_created
    ON item_token (source_type, source_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_participant_campaign
    ON campaign_participant (campaign_id);
