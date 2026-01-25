BEGIN;

-- With admins now operating at the system level, ensure they are not tied to a club
UPDATE app_user
SET club_id = NULL
WHERE role = 20;

COMMIT;
