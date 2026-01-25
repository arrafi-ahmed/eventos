-- Add promo code and discount amount columns to orders table
ALTER TABLE orders ADD COLUMN promo_code VARCHAR(50);
ALTER TABLE orders ADD COLUMN discount_amount INT DEFAULT 0;

-- Optional: Update existing orders to have 0 discount if they are NULL
UPDATE orders SET discount_amount = 0 WHERE discount_amount IS NULL;
