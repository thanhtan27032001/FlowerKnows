ALTER TABLE stock_count_line
    ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT now();
