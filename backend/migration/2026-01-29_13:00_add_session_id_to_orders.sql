-- Add session_id to orders table for direct, indexed lookups by the success page
ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);

-- Index session_id for high-performance success page verification
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);

-- Optional: If attendees table has session_id, we can keep it for legacy or remove it later.
-- For now, let's focus on making orders the anchor.
