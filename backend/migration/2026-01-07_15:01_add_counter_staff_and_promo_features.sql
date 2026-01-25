-- Update role check for app_user (add 50=Cashier, 60=Check-in Agent)
ALTER TABLE app_user DROP CONSTRAINT app_user_role_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_role_check CHECK (role IN (10, 20, 30, 40, 50, 60));

-- New Tables for Counter & Staff
CREATE TABLE ticket_counter (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    organization_id INT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cash_session (
    id SERIAL PRIMARY KEY,
    cashier_id INT NOT NULL REFERENCES app_user(id),
    ticket_counter_id INT NOT NULL REFERENCES ticket_counter(id),
    event_id INT NOT NULL REFERENCES event(id),
    organization_id INT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    opening_time TIMESTAMP NOT NULL DEFAULT NOW(),
    closing_time TIMESTAMP,
    opening_cash INT NOT NULL DEFAULT 0, -- cents
    closing_cash INT, -- cents
    expected_total INT, -- cents
    discrepancy INT, -- cents
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE promo_code (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    event_id INT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    organization_id INT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free')),
    discount_value INT NOT NULL, -- percentage or cents
    usage_limit INT, -- NULL = unlimited
    usage_count INT DEFAULT 0,
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE event_staff (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    role SMALLINT NOT NULL, -- 50=Cashier, 60=Check-in Agent
    organization_id INT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

-- Update orders table
ALTER TABLE orders ADD COLUMN sales_channel VARCHAR(20) DEFAULT 'online' CHECK (sales_channel IN ('online', 'counter'));
ALTER TABLE orders ADD COLUMN cashier_id INT REFERENCES app_user(id);
ALTER TABLE orders ADD COLUMN ticket_counter_id INT REFERENCES ticket_counter(id);
ALTER TABLE orders ADD COLUMN cash_session_id INT REFERENCES cash_session(id);
ALTER TABLE orders ADD COLUMN payment_method VARCHAR(20) DEFAULT 'card' CHECK (payment_method IN ('cash', 'card', 'free'));

-- Update indexes for new columns in orders
CREATE INDEX idx_orders_sales_channel ON orders (sales_channel);
CREATE INDEX idx_orders_cashier_id ON orders (cashier_id);
CREATE INDEX idx_orders_ticket_counter_id ON orders (ticket_counter_id);
CREATE INDEX idx_orders_cash_session_id ON orders (cash_session_id);

-- Indexes for new tables
CREATE INDEX idx_ticket_counter_organization_id ON ticket_counter (organization_id);
CREATE INDEX idx_cash_session_organization_id ON cash_session (organization_id);
CREATE INDEX idx_cash_session_event_id ON cash_session (event_id);
CREATE INDEX idx_promo_code_event_id ON promo_code (event_id);
CREATE INDEX idx_event_staff_event_id ON event_staff (event_id);
CREATE INDEX idx_event_staff_user_id ON event_staff (user_id);
