-- Allow users to be deleted even if they have audit/reference records
-- Change linked fields to ON DELETE SET NULL and remove NOT NULL where necessary

-- app_user.verified_by
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_verified_by_fkey;
ALTER TABLE app_user ADD CONSTRAINT app_user_verified_by_fkey 
    FOREIGN KEY (verified_by) REFERENCES app_user(id) ON DELETE SET NULL;

-- event.created_by
ALTER TABLE event ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE event DROP CONSTRAINT IF EXISTS event_created_by_fkey;
ALTER TABLE event ADD CONSTRAINT event_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE SET NULL;

-- cash_session.cashier_id
ALTER TABLE cash_session ALTER COLUMN cashier_id DROP NOT NULL;
ALTER TABLE cash_session DROP CONSTRAINT IF EXISTS cash_session_cashier_id_fkey;
ALTER TABLE cash_session ADD CONSTRAINT cash_session_cashier_id_fkey 
    FOREIGN KEY (cashier_id) REFERENCES app_user(id) ON DELETE SET NULL;

-- product.created_by
ALTER TABLE product ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE product DROP CONSTRAINT IF EXISTS product_created_by_fkey;
ALTER TABLE product ADD CONSTRAINT product_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE SET NULL;

-- checkin.checked_in_by
ALTER TABLE checkin DROP CONSTRAINT IF EXISTS checkin_checked_in_by_fkey;
ALTER TABLE checkin ADD CONSTRAINT checkin_checked_in_by_fkey 
    FOREIGN KEY (checked_in_by) REFERENCES app_user(id) ON DELETE SET NULL;

-- orders.cashier_id
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_cashier_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_cashier_id_fkey 
    FOREIGN KEY (cashier_id) REFERENCES app_user(id) ON DELETE SET NULL;

-- homepage_section.created_by
ALTER TABLE homepage_section DROP CONSTRAINT IF EXISTS homepage_section_created_by_fkey;
ALTER TABLE homepage_section ADD CONSTRAINT homepage_section_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE SET NULL;

-- support_sessions.user_id
ALTER TABLE support_sessions DROP CONSTRAINT IF EXISTS support_sessions_user_id_fkey;
ALTER TABLE support_sessions ADD CONSTRAINT support_sessions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE SET NULL;
