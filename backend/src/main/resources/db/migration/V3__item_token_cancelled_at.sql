-- Track when revenue from a cancelled token was recognized (US-08 / US-11)
ALTER TABLE item_token ADD COLUMN cancelled_at TIMESTAMP NULL;
