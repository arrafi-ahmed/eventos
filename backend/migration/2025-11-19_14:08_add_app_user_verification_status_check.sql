BEGIN;

-- 1. Update the enum check on role
ALTER TABLE app_user
    DROP CONSTRAINT IF EXISTS app_user_role_check;

ALTER TABLE app_user
    ADD CONSTRAINT app_user_role_check CHECK (role IN (10, 20, 30, 40));

-- 2. Add new verification fields (if not already exist)
ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS id_document VARCHAR(255);

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) 
        DEFAULT 'pending';

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS verified_by INT REFERENCES app_user(id);

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3. Add check constraint for verification_status
ALTER TABLE app_user
    DROP CONSTRAINT IF EXISTS app_user_verification_status_check;

ALTER TABLE app_user
    ADD CONSTRAINT app_user_verification_status_check
        CHECK (verification_status IN ('pending', 'approved', 'rejected'));

COMMIT;
