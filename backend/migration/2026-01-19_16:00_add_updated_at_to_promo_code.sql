-- Add updated_at column to promo_code table
ALTER TABLE promo_code ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
