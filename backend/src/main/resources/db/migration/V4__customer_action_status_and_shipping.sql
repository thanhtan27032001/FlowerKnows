-- US-18: customer action status + order shipping status rename + carrier order id

ALTER TABLE customer
    ADD COLUMN action_status VARCHAR(30) NOT NULL DEFAULT 'UNDETERMINED';

ALTER TABLE "order"
    ADD COLUMN carrier_order_id VARCHAR(100) NULL;

UPDATE "order" SET shipping_status = 'ORDER_CREATED' WHERE shipping_status = 'PENDING';
UPDATE "order" SET shipping_status = 'SHIPPED' WHERE shipping_status = 'SHIPPING';
