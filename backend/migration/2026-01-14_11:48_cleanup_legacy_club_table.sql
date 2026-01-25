-- 1. Drop old foreign key constraints that point to the legacy 'club' table
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_club_id_fkey;
ALTER TABLE event DROP CONSTRAINT IF EXISTS event_club_id_fkey;
ALTER TABLE sponsorship DROP CONSTRAINT IF EXISTS sponsorship_club_id_fkey;
ALTER TABLE sponsorship_package DROP CONSTRAINT IF EXISTS sponsorship_package_club_id_fkey;
ALTER TABLE product DROP CONSTRAINT IF EXISTS product_club_id_fkey;

-- 2. Add new foreign key constraints pointing to the 'organization' table
-- Note: This ensures data integrity now that the columns are renamed to organization_id
ALTER TABLE app_user 
    ADD CONSTRAINT app_user_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;

ALTER TABLE event 
    ADD CONSTRAINT event_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;

ALTER TABLE sponsorship 
    ADD CONSTRAINT sponsorship_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;

ALTER TABLE sponsorship_package 
    ADD CONSTRAINT sponsorship_package_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;

ALTER TABLE product 
    ADD CONSTRAINT product_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;

-- 3. Finally, drop the legacy table
DROP TABLE IF EXISTS club;
