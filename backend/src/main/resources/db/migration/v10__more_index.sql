-- Customer detail endpoint: orders by customer, order_token reverse lookup
CREATE INDEX IF NOT EXISTS idx_order_customer_created
    ON "order" (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_token_item
    ON order_token (item_token_id);
