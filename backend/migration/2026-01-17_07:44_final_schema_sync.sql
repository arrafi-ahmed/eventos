-- Migration: Final Schema Sync
-- Date: 2026-01-17
-- Description: Ensures all columns from recent features are present in the database.

-- 1. Ticket Stock Features (Ticket Table)
ALTER TABLE ticket 
ADD COLUMN IF NOT EXISTS on_site_quota INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 5,
ADD COLUMN IF NOT EXISTS low_stock_alert_sent BOOLEAN DEFAULT FALSE;

-- 2. Counter & POS Features (Orders Table)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS sales_channel VARCHAR(20) DEFAULT 'online' CHECK (sales_channel IN ('online', 'counter')),
ADD COLUMN IF NOT EXISTS cashier_id INT REFERENCES app_user(id),
ADD COLUMN IF NOT EXISTS ticket_counter_id INT REFERENCES ticket_counter(id),
ADD COLUMN IF NOT EXISTS cash_session_id INT REFERENCES cash_session(id),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'card' CHECK (payment_method IN ('cash', 'card', 'free'));

-- 3. Tax Features (Event Table)
ALTER TABLE event
ADD COLUMN IF NOT EXISTS tax_amount INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_type VARCHAR(20);

-- 4. Organization/Club Renaming and Verification (Organization Table)
-- Ensure verification columns exist in the renamed table
ALTER TABLE organization
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'unverified',
ADD COLUMN IF NOT EXISTS verified_by INT REFERENCES app_user (id),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
