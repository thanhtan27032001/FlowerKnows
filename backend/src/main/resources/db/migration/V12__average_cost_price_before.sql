ALTER TABLE stock_transaction
    ADD COLUMN average_cost_price_before NUMERIC(12,2);

-- Backfill note: existing STOCK_IN rows created before this migration will
-- have average_cost_price_before = NULL, meaning they simply won't be
-- eligible for Undo (US-33 AC#1 only shows Undo for the MOST RECENT stock_in
-- per product anyway — this is a soft limitation, not a data integrity issue).
-- Scale matches product.average_cost_price (NUMERIC(12,2)).
