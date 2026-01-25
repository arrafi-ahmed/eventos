-- Migration to add generic payment columns to orders and sponsorship tables

-- Add columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50),
ADD COLUMN IF NOT EXISTS gateway_transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS gateway_response JSONB;

-- Add columns to sponsorship table
ALTER TABLE sponsorship
ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50),
ADD COLUMN IF NOT EXISTS gateway_transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS gateway_response JSONB;

-- Index for searching transaction IDs across providers
CREATE INDEX IF NOT EXISTS idx_orders_gateway_transaction_id ON orders (gateway_transaction_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_gateway_transaction_id ON sponsorship (gateway_transaction_id);
