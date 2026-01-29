-- Add order_id to attendees table for high-fidelity mapping and faster scanner lookups
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS order_id INT REFERENCES orders(id) ON DELETE SET NULL;

-- Initial index to speed up scanning by order_id if needed in the future
CREATE INDEX IF NOT EXISTS idx_attendees_order_id ON attendees(order_id);
