-- Indexes for filter/join columns introduced in V4–V6 that were missing covering indexes.
-- idx_item_token_source is covered by V8 idx_item_token_source_created.
CREATE INDEX IF NOT EXISTS idx_campaign_participant_campaign_status
    ON campaign_participant (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_campaign_participant_customer
    ON campaign_participant (customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_action_status
    ON customer (action_status);

CREATE INDEX IF NOT EXISTS idx_exchange_token_in_token
    ON exchange_token_in (item_token_id);

CREATE INDEX IF NOT EXISTS idx_exchange_token_out_transaction
    ON exchange_token_out (exchange_transaction_id);
