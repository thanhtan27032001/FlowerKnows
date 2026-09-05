CREATE TABLE stock_count (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    completed_at TIMESTAMP,
    note VARCHAR(500)
);

CREATE TABLE stock_count_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_count_id UUID NOT NULL REFERENCES stock_count(id),
    product_id UUID NOT NULL REFERENCES product(id),
    system_quantity_at_add INT NOT NULL,
    counted_quantity INT,
    cost_price NUMERIC(12,0),
    note VARCHAR(500)
);

ALTER TABLE stock_transaction
    ADD COLUMN stock_count_id UUID REFERENCES stock_count(id);

CREATE INDEX idx_stock_count_completed_at ON stock_count (completed_at);
CREATE INDEX idx_stock_count_line_session ON stock_count_line (stock_count_id);
CREATE INDEX idx_stock_count_line_product ON stock_count_line (product_id);
CREATE INDEX idx_stock_transaction_stock_count ON stock_transaction (stock_count_id);
