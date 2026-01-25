-- Add logo_image_dark column to header_settings
ALTER TABLE header_settings ADD COLUMN IF NOT EXISTS logo_image_dark VARCHAR(255);
