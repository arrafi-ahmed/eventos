-- Create table to store organizer dashboard banner settings
CREATE TABLE IF NOT EXISTS organizer_dashboard_banner (
    id SERIAL PRIMARY KEY,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    icon VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cta_button_text VARCHAR(100) NOT NULL,
    cta_button_url VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one row exists for global settings
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizer_dashboard_banner_singleton ON organizer_dashboard_banner ((1));


