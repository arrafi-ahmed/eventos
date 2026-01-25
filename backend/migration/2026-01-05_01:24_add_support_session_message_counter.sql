-- Add message counter columns to support_sessions for efficient summarization checks
-- This avoids expensive COUNT(*) queries and scales to millions of messages

ALTER TABLE support_sessions 
ADD COLUMN IF NOT EXISTS message_count INT DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS last_summarized_message_count INT DEFAULT 0 NOT NULL;

-- Initialize message_count for existing sessions based on actual counts
-- This is a one-time migration for existing data
UPDATE support_sessions ss
SET message_count = COALESCE((
    SELECT COUNT(*) 
    FROM support_messages sm 
    WHERE sm.session_id = ss.session_id
), 0);

-- Add comment for documentation
COMMENT ON COLUMN support_sessions.message_count IS 'Total number of messages in this session (incremented on each message)';
COMMENT ON COLUMN support_sessions.last_summarized_message_count IS 'Message count when summary was last generated (for efficient summarization checks)';








