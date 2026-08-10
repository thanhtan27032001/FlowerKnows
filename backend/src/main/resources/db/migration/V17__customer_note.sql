-- v4.8: optional free-text internal note on customer (US-03 AC#6, US-20)
ALTER TABLE customer
    ADD COLUMN note TEXT;
