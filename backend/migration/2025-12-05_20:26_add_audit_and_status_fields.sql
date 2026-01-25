ALTER TABLE club
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

ALTER TABLE event
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published'));

ALTER TABLE attendees
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255) REFERENCES temp_registration (session_id);

ALTER TABLE registration
ADD COLUMN IF NOT EXISTS primary_attendee_id INT REFERENCES attendees (id)

