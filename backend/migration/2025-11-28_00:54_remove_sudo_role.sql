BEGIN;

-- Promote all sudo (role 10) users to system-level admins (role 20)
UPDATE app_user
SET role = 20
WHERE role = 10;

-- Ensure the role constraint no longer references the removed sudo role
ALTER TABLE app_user
    DROP CONSTRAINT IF EXISTS app_user_role_check;

ALTER TABLE app_user
    ADD CONSTRAINT app_user_role_check CHECK (role IN (20, 30, 40));

COMMIT;


