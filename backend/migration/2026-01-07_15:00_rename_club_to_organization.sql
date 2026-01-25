-- Rename club to organization
ALTER TABLE club RENAME TO organization;

-- Rename foreign key columns in all tables
ALTER TABLE app_user RENAME COLUMN club_id TO organization_id;
ALTER TABLE event RENAME COLUMN club_id TO organization_id;
ALTER TABLE sponsorship RENAME COLUMN club_id TO organization_id;
ALTER TABLE sponsorship_package RENAME COLUMN club_id TO organization_id;
ALTER TABLE product RENAME COLUMN club_id TO organization_id;
