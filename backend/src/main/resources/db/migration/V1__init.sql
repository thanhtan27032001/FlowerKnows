CREATE TABLE customer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE product (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    list_price NUMERIC(12,0) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0
);

CREATE TABLE campaign (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    bag_price NUMERIC(12,0) NOT NULL,
    total_bags INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE campaign_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaign(id),
    product_id UUID NOT NULL REFERENCES product(id),
    loaded_quantity INT NOT NULL,
    remaining_quantity INT NOT NULL
);

CREATE TABLE campaign_participant (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaign(id),
    customer_id UUID NOT NULL REFERENCES customer(id),
    total_bags_purchased INT NOT NULL,
    prepaid_amount NUMERIC(12,0) NOT NULL,
    UNIQUE (campaign_id, customer_id)
);

CREATE TABLE item_token (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES product(id),
    customer_id UUID NOT NULL REFERENCES customer(id),
    token_value NUMERIC(12,0) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'HOLDING',
    source_type VARCHAR(20) NOT NULL,
    source_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE exchange_transaction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    additional_payment NUMERIC(12,0),
    suggested_refund_amount NUMERIC(12,0),
    actual_refund_amount NUMERIC(12,0)
);

CREATE TABLE exchange_token_in (
    exchange_transaction_id UUID NOT NULL REFERENCES exchange_transaction(id),
    item_token_id UUID NOT NULL REFERENCES item_token(id),
    PRIMARY KEY (exchange_transaction_id, item_token_id)
);

CREATE TABLE exchange_token_out (
    exchange_transaction_id UUID NOT NULL REFERENCES exchange_transaction(id),
    item_token_id UUID NOT NULL REFERENCES item_token(id),
    PRIMARY KEY (exchange_transaction_id, item_token_id)
);

CREATE TABLE "order" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    recognized_revenue NUMERIC(12,0) NOT NULL,
    shipping_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
);

CREATE TABLE order_token (
    order_id UUID NOT NULL REFERENCES "order"(id),
    item_token_id UUID NOT NULL REFERENCES item_token(id),
    PRIMARY KEY (order_id, item_token_id)
);

CREATE TABLE stock_transaction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES product(id),
    type VARCHAR(30) NOT NULL,
    quantity_change INT NOT NULL,
    note VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_item_token_customer_status ON item_token (customer_id, status);
CREATE INDEX idx_stock_transaction_product ON stock_transaction (product_id, created_at);
