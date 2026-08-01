CREATE TABLE direct_sale (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customer(id),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    recognized_revenue NUMERIC(12,0) NOT NULL,
    total_cost NUMERIC(12,0) NOT NULL,
    gross_margin NUMERIC(12,0) NOT NULL
);

CREATE TABLE direct_sale_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    direct_sale_id UUID NOT NULL REFERENCES direct_sale(id),
    product_id UUID NOT NULL REFERENCES product(id),
    quantity INT NOT NULL,
    unit_price NUMERIC(12,0) NOT NULL,
    cost_price_snapshot NUMERIC(12,0)
);

CREATE INDEX idx_direct_sale_customer ON direct_sale (customer_id);
CREATE INDEX idx_direct_sale_created_at ON direct_sale (created_at);
CREATE INDEX idx_direct_sale_line_sale ON direct_sale_line (direct_sale_id);
CREATE INDEX idx_direct_sale_line_product ON direct_sale_line (product_id);
