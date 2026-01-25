-- Migration: Fix Cash Session Event Cascade
-- Date: 2026-01-21
-- Description: Adds ON DELETE CASCADE to the event_id foreign key in cash_session table.

-- Drop the existing constraint
ALTER TABLE cash_session
DROP CONSTRAINT IF EXISTS cash_session_event_id_fkey;

-- Add it back with ON DELETE CASCADE
ALTER TABLE cash_session
ADD CONSTRAINT cash_session_event_id_fkey
    FOREIGN KEY (event_id)
    REFERENCES event(id)
    ON DELETE CASCADE;
