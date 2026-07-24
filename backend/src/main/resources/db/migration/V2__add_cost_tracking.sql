ALTER TABLE product
    ADD COLUMN average_cost_price NUMERIC(12,2) NULL;

ALTER TABLE stock_transaction
    ADD COLUMN cost_price NUMERIC(12,2) NULL;

ALTER TABLE item_token
    ADD COLUMN cost_basis NUMERIC(12,2) NULL;

ALTER TABLE "order"
    ADD COLUMN total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN gross_margin NUMERIC(12,2) NOT NULL DEFAULT 0;
