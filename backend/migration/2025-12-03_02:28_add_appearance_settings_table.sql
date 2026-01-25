-- Create table to store system-wide appearance settings
CREATE TABLE IF NOT EXISTS appearance_settings (
    id SERIAL PRIMARY KEY,
    default_theme VARCHAR(20) NOT NULL DEFAULT 'dark' CHECK (default_theme IN ('dark', 'light')),
    -- Light theme colors (stored as JSONB object)
    light_colors JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Light theme variables (stored as JSONB object)
    light_variables JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Dark theme colors (stored as JSONB object)
    dark_colors JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Dark theme variables (stored as JSONB object)
    dark_variables JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one row exists for global settings
CREATE UNIQUE INDEX IF NOT EXISTS idx_appearance_settings_singleton ON appearance_settings ((1));

-- Note: Application logic ensures only one row exists (upsert pattern)

