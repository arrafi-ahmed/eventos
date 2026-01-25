-- Migration: Refactor payment gateway storage to use JSONB
-- Date: 2026-01-24
-- Description: Replace gateway-specific columns with a scalable JSONB approach

-- Step 1: Add new generic columns for any payment gateway
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50),
ADD COLUMN IF NOT EXISTS gateway_transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS gateway_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS gateway_response JSONB DEFAULT '{}';

-- Step 2: Update payment_method constraint to include orange_money
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE orders 
ADD CONSTRAINT orders_payment_method_check 
CHECK (payment_method IN ('cash', 'card', 'free', 'orange_money'));

-- Step 3: Migrate existing Stripe data to new structure
UPDATE orders
SET 
    payment_gateway = 'stripe',
    gateway_transaction_id = stripe_payment_intent_id,
    gateway_metadata = jsonb_build_object(
        'payment_intent_id', stripe_payment_intent_id
    )
WHERE stripe_payment_intent_id IS NOT NULL
AND payment_gateway IS NULL;