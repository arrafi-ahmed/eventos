-- Add timezone column to app_user table
-- This enables per-user timezone preferences for displaying dates/times

ALTER TABLE app_user 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC';

-- Add comment for documentation
COMMENT ON COLUMN app_user.timezone IS 'User timezone preference in IANA format (e.g., America/Phoenix, Asia/Bangkok)';
