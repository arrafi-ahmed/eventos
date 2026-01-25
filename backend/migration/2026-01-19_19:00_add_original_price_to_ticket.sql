-- Migration: Add Original Price to Ticket Table
-- Date: 2026-01-19
-- Description: Adds original_price column to store the non-discounted price for strikethrough display.

ALTER TABLE ticket
ADD COLUMN IF NOT EXISTS original_price DECIMAL(20, 2) DEFAULT NULL;
