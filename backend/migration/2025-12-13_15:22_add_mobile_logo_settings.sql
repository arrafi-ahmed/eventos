-- Add logo_width_mobile column to header_settings table
ALTER TABLE header_settings 
ADD COLUMN IF NOT EXISTS logo_width_mobile INT DEFAULT 120;

-- Update existing rows to have default mobile width
UPDATE header_settings 
SET logo_width_mobile = 120 
WHERE logo_width_mobile IS NULL;

