-- Create table to store system-wide footer settings
CREATE TABLE IF NOT EXISTS footer_settings (
    id SERIAL PRIMARY KEY,
    style VARCHAR(20) NOT NULL DEFAULT 'expanded' CHECK (style IN ('oneline', 'expanded')),
    -- Company information
    company_name VARCHAR(255),
    company_address TEXT,
    company_email VARCHAR(255),
    company_phone VARCHAR(50),
    -- Quick links (stored as JSONB array of {title, route_name})
    quick_links JSONB DEFAULT '[]',
    -- Social media links (stored as JSONB object)
    social_links JSONB DEFAULT '{}',
    -- Copyright text (optional, defaults to company name)
    copyright_text VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default footer settings (only one row should exist)
-- INSERT INTO footer_settings (style, company_name, company_address, company_email, company_phone, quick_links, social_links, copyright_text)
-- VALUES (
--     'expanded',
--     'Recto Sarl-s',
--     '34, rue de Sanem, L- 4485 Soleuvre',
--     'contact@luxticket.com',
--     '+1 (555) 123-4567',
--     '[
--         {"title": "Home", "route_name": "homepage"},
--         {"title": "Events", "route_name": "events-browse"},
--         {"title": "Terms & Conditions", "route_name": "terms"},
--         {"title": "Privacy Policy", "route_name": "privacy"}
--     ]'::jsonb,
--     '{
--         "facebook": "https://facebook.com/demo",
--         "instagram": "https://instagram.com/demo",
--         "tiktok": "https://tiktok.com/@demo"
--     }'::jsonb,
--     NULL
-- )
-- ON CONFLICT DO NOTHING;

-- Note: Application logic ensures only one row exists (upsert pattern)

