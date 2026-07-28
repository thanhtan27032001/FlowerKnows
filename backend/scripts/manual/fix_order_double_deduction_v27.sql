-- =============================================================================
-- MANUAL DATA FIX — v2.7 order double-deduction correction
-- =============================================================================
--
-- DO NOT place this under Flyway `db/migration` and DO NOT run on app startup.
-- Run only after Owner reviews the PREVIEW results and explicitly confirms.
--
-- Context:
--   Pre-v2.7 Create Order wrongly deducted product.stock_quantity again
--   (writing stock_transaction type = ORDER_FULFILLMENT) even though stock had
--   already left inventory at campaign_lock or exchange_out. This script restores
--   +1 stock per order_token for each affected product.
--
-- How to use (Railway / psql):
--   1. Run Section A (PREVIEW) and share the result before applying.
--   2. Optionally cross-check Section B (ledger of ORDER_FULFILLMENT rows).
--   3. After confirmation, run Section C (APPLY) inside a transaction.
--
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Section A — PREVIEW: stock that would be restored (+1 per order_token)
-- -----------------------------------------------------------------------------
SELECT
    p.id              AS product_id,
    p.name            AS product_name,
    p.stock_quantity  AS stock_quantity_before,
    COUNT(*)::int     AS qty_to_restore,
    (p.stock_quantity + COUNT(*))::int AS stock_quantity_after
FROM order_token ot
JOIN item_token it ON it.id = ot.item_token_id
JOIN product p     ON p.id = it.product_id
GROUP BY p.id, p.name, p.stock_quantity
ORDER BY p.name;

-- Totals
SELECT
    COUNT(*)::int                         AS order_token_rows,
    COUNT(DISTINCT ot.order_id)::int      AS orders_affected,
    COUNT(DISTINCT it.product_id)::int    AS products_affected
FROM order_token ot
JOIN item_token it ON it.id = ot.item_token_id;

-- -----------------------------------------------------------------------------
-- Section B — CROSS-CHECK: historical ORDER_FULFILLMENT ledger (should match A)
-- -----------------------------------------------------------------------------
SELECT
    p.id             AS product_id,
    p.name           AS product_name,
    SUM(-st.quantity_change)::int AS qty_deducted_by_order_fulfillment,
    COUNT(*)::int    AS fulfillment_tx_count
FROM stock_transaction st
JOIN product p ON p.id = st.product_id
WHERE st.type = 'ORDER_FULFILLMENT'
GROUP BY p.id, p.name
ORDER BY p.name;

-- Diff: order_token counts vs ORDER_FULFILLMENT sums (ideally all zeros)
SELECT
    COALESCE(a.product_id, b.product_id) AS product_id,
    COALESCE(a.product_name, b.product_name) AS product_name,
    COALESCE(a.qty_to_restore, 0) AS from_order_tokens,
    COALESCE(b.qty_deducted, 0) AS from_fulfillment_txs,
    COALESCE(a.qty_to_restore, 0) - COALESCE(b.qty_deducted, 0) AS diff
FROM (
    SELECT p.id AS product_id, p.name AS product_name, COUNT(*)::int AS qty_to_restore
    FROM order_token ot
    JOIN item_token it ON it.id = ot.item_token_id
    JOIN product p ON p.id = it.product_id
    GROUP BY p.id, p.name
) a
FULL OUTER JOIN (
    SELECT p.id AS product_id, p.name AS product_name, SUM(-st.quantity_change)::int AS qty_deducted
    FROM stock_transaction st
    JOIN product p ON p.id = st.product_id
    WHERE st.type = 'ORDER_FULFILLMENT'
    GROUP BY p.id, p.name
) b ON a.product_id = b.product_id
ORDER BY product_name;

-- STOP HERE for review. Replace the ROLLBACK below with COMMIT only after
-- Owner confirms the preview numbers. Then uncomment Section C and re-run,
-- or run Section C in a follow-up session after review.
ROLLBACK;

-- =============================================================================
-- Section C — APPLY (uncomment only after confirmed preview)
-- =============================================================================
-- BEGIN;
--
-- -- Restore stock_quantity (+1 per order_token)
-- UPDATE product p
-- SET stock_quantity = p.stock_quantity + fix.qty_to_restore
-- FROM (
--     SELECT it.product_id, COUNT(*)::int AS qty_to_restore
--     FROM order_token ot
--     JOIN item_token it ON it.id = ot.item_token_id
--     GROUP BY it.product_id
-- ) fix
-- WHERE p.id = fix.product_id;
--
-- -- Audit ledger: compensating STOCK_ADJUSTMENT rows (do not re-use ORDER_FULFILLMENT)
-- INSERT INTO stock_transaction (id, product_id, type, quantity_change, note, created_at)
-- SELECT
--     gen_random_uuid(),
--     it.product_id,
--     'STOCK_ADJUSTMENT',
--     COUNT(*)::int,
--     'v2.7 fix: reverse double-deduction from Create Order (US-09)',
--     now()
-- FROM order_token ot
-- JOIN item_token it ON it.id = ot.item_token_id
-- GROUP BY it.product_id;
--
-- -- Verify
-- SELECT p.id, p.name, p.stock_quantity
-- FROM product p
-- WHERE p.id IN (
--     SELECT DISTINCT it.product_id
--     FROM order_token ot
--     JOIN item_token it ON it.id = ot.item_token_id
-- )
-- ORDER BY p.name;
--
-- COMMIT;
