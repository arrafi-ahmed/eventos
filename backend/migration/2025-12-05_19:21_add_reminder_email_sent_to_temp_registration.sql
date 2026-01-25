-- Add column to track when reminder email was sent
-- This prevents sending duplicate emails
ALTER TABLE temp_registration
ADD COLUMN IF NOT EXISTS reminder_email_sent_at TIMESTAMPTZ;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_temp_registration_reminder_email_sent 
ON temp_registration(reminder_email_sent_at) 
WHERE reminder_email_sent_at IS NULL;

