-- Migration: Replace ticket_id with ticket JSONB
-- Drop the foreign key relationship and the column
ALTER TABLE attendees DROP COLUMN IF EXISTS ticket_id;

-- Ensure the ticket column exists (it might already exist from half-complete previous tasks)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendees' AND column_name='ticket') THEN
        ALTER TABLE attendees ADD COLUMN ticket JSONB;
    END IF;
END $$;
