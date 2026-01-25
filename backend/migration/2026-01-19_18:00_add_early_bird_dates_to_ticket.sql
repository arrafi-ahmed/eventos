-- Migration: Add Early Bird Pricing Dates to Ticket Table
-- Date: 2026-01-19
-- Description: Adds sale_start_date and sale_end_date to support Limited Time/Early Bird pricing.

ALTER TABLE ticket 
ADD COLUMN IF NOT EXISTS sale_start_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS sale_end_date TIMESTAMP;
