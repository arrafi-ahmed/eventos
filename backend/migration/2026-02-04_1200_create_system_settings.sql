-- Consolidated Migration: System Settings & Cleanup
-- Merges logic from:
-- - 2026-02-03_1800_consolidated_currency.sql
-- - 2026-02-04_1200_create_system_settings.sql

BEGIN;

-- 1. Remove obsolete features (Legacy cleanup)
DROP TABLE IF EXISTS extras_purchase CASCADE;
DROP TABLE IF EXISTS extras CASCADE;
DROP TABLE IF EXISTS sponsorship CASCADE;
DROP TABLE IF EXISTS sponsorship_package CASCADE;

-- 2. Standardize currency columns
ALTER TABLE event ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN currency DROP DEFAULT;

-- 3. Create system_settings table (Key-Value Structure)
CREATE TABLE IF NOT EXISTS system_settings
(
    key                      VARCHAR(100) PRIMARY KEY,
    value                    JSONB DEFAULT '{}'::jsonb,
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Migrate Data
DO $$
DECLARE
    loc_data JSONB := '{}'::jsonb;
    app_data JSONB := '{}'::jsonb;
    head_data JSONB := '{}'::jsonb;
    foot_data JSONB := '{}'::jsonb;
    banner_data JSONB := '{}'::jsonb;
    
    -- Temp vars for currency resolution
    found_currency TEXT;
    found_language TEXT;
BEGIN
    -------------------------------------------------------
    -- A. Resolve & Migrate Localization
    -------------------------------------------------------
    found_currency := NULL; -- Reset
    found_language := NULL; -- Reset
    
    -- Check if we need to migrate from localization_settings
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'localization_settings') THEN
        SELECT default_currency, default_language 
        INTO found_currency, found_language
        FROM localization_settings LIMIT 1;
        
        -- Prepare JSON
        loc_data := jsonb_build_object(
            'defaultCurrency', COALESCE(found_currency, 'USD'),
            'defaultLanguage', COALESCE(found_language, 'en')
        );
        
        -- Perform Insert/Update
        INSERT INTO system_settings (key, value) VALUES ('localization', loc_data)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
        
    -- Check legacy appearance_settings only if localization_settings didn't exist
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appearance_settings') THEN
         -- Attempt to find currency in appearance
         IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appearance_settings' AND column_name = 'default_currency') THEN
            EXECUTE 'SELECT default_currency FROM appearance_settings LIMIT 1' INTO found_currency;
            
            -- Only if we found a currency do we create the localization entry (or if we want to enforce defaults)
            if found_currency IS NOT NULL THEN
                 loc_data := jsonb_build_object(
                    'defaultCurrency', found_currency,
                    'defaultLanguage', 'en'
                );
                 INSERT INTO system_settings (key, value) VALUES ('localization', loc_data)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
            END IF;
         END IF;
    END IF;

    -------------------------------------------------------
    -- B. Resolve & Migrate Appearance
    -------------------------------------------------------
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appearance_settings') THEN
        SELECT jsonb_build_object(
            'defaultTheme', default_theme,
            'lightColors', light_colors,
            'lightVariables', light_variables,
            'darkColors', dark_colors,
            'darkVariables', dark_variables
        ) INTO app_data FROM appearance_settings LIMIT 1;
        
        INSERT INTO system_settings (key, value) VALUES ('appearance', app_data)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    END IF;

    -------------------------------------------------------
    -- C. Resolve & Migrate Header
    -------------------------------------------------------
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'header_settings') THEN
        SELECT jsonb_build_object(
            'logoImage', logo_image,
            'logoImageDark', logo_image_dark,
            'logoPosition', logo_position,
            'menuPosition', menu_position,
            'logoWidthLeft', logo_width_left,
            'logoWidthCenter', logo_width_center,
            'logoWidthMobile', logo_width_mobile
        ) INTO head_data FROM header_settings LIMIT 1;
        
        INSERT INTO system_settings (key, value) VALUES ('header', head_data)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    END IF;

    -------------------------------------------------------
    -- D. Resolve & Migrate Footer
    -------------------------------------------------------
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'footer_settings') THEN
         SELECT jsonb_build_object(
            'style', style,
            'companyName', company_name,
            'companyAddress', company_address,
            'companyEmail', company_email,
            'companyPhone', company_phone,
            'quickLinks', quick_links,
            'socialLinks', social_links,
            'copyrightText', copyright_text
        ) INTO foot_data FROM footer_settings LIMIT 1;
        
        INSERT INTO system_settings (key, value) VALUES ('footer', foot_data)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    END IF;
    
    -------------------------------------------------------
    -- E. Resolve & Migrate Banner
    -------------------------------------------------------
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizer_dashboard_banner') THEN
         SELECT jsonb_build_object(
            'isEnabled', is_enabled,
            'icon', icon,
            'title', title,
            'description', description,
            'ctaButtonText', cta_button_text,
            'ctaButtonUrl', cta_button_url
        ) INTO banner_data FROM organizer_dashboard_banner LIMIT 1;
        
        INSERT INTO system_settings (key, value) VALUES ('organizer_dashboard_banner', banner_data)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    END IF;
END $$;

-- 5. Drop old tables
DROP TABLE IF EXISTS localization_settings;
DROP TABLE IF EXISTS appearance_settings;
DROP TABLE IF EXISTS header_settings;
DROP TABLE IF EXISTS footer_settings;
DROP TABLE IF EXISTS organizer_dashboard_banner;

COMMIT;
