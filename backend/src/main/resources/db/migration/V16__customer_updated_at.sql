-- v4.7: customer.updated_at for US-19 AC#8a default sort.
-- created_at already exists from V1; only add updated_at.
ALTER TABLE customer
    ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT now();

CREATE INDEX idx_customer_updated_at ON customer (updated_at);
