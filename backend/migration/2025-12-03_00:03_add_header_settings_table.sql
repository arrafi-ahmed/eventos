-- Create table to store system-wide header settings
CREATE TABLE IF NOT EXISTS header_settings (
    id SERIAL PRIMARY KEY,
    logo_image VARCHAR(255), -- Path to uploaded logo image
    logo_position VARCHAR(20) NOT NULL DEFAULT 'left' CHECK (logo_position IN ('left', 'center', 'right')),
    menu_position VARCHAR(20) NOT NULL DEFAULT 'right' CHECK (menu_position IN ('left', 'center', 'right')),
    logo_width_left INT DEFAULT 300, -- Logo width when positioned left/right
    logo_width_center INT DEFAULT 180, -- Logo width when positioned center
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: Application logic ensures only one row exists (upsert pattern)

