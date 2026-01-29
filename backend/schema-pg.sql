CREATE TABLE organization
(
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(100) NOT NULL,
    location TEXT,
    logo     VARCHAR(255),
    verification_status VARCHAR(20) DEFAULT 'unverified',
    verified_by INT,
    verified_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE app_user
(
    id         SERIAL PRIMARY KEY,
    full_name  VARCHAR(255),
    email      VARCHAR(255) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,  -- 20=admin, 30=organizer, 40=attendee
    role       SMALLINT CHECK (role IN (20, 30, 40, 50, 60)), -- updated
    organization_id    INT REFERENCES organization (id) ON DELETE CASCADE,
    id_document VARCHAR(255), -- added
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),  -- added
    verified_by INT REFERENCES app_user (id) ON DELETE SET NULL, -- added
    verified_at TIMESTAMP, -- added
    rejection_reason TEXT, -- added
    timezone VARCHAR(100) DEFAULT 'UTC', -- User timezone preference (IANA format)
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE event
(
    id                 SERIAL PRIMARY KEY,
    name               VARCHAR(100) NOT NULL,
    description        TEXT,
    location           VARCHAR(255),
    registration_count INT,
    start_datetime     TIMESTAMPTZ   NOT NULL,
    end_datetime       TIMESTAMPTZ,
    banner             VARCHAR(255),
    landing_config     JSONB,
    config             JSONB,
    slug               VARCHAR(255) UNIQUE,
    currency           VARCHAR(3)   NOT NULL DEFAULT 'USD',
    tax_amount INT,
    tax_type   VARCHAR(20),
    status     VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    organization_id    INT NOT NULL REFERENCES organization (id) ON DELETE CASCADE,
    created_by INT REFERENCES app_user (id) ON DELETE SET NULL
);

CREATE TABLE ticket
(
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(100) NOT NULL,
    description   TEXT,
    price         INT          NOT NULL DEFAULT 0,
    current_stock INT          NOT NULL DEFAULT 0,
    max_stock            INT,
    on_site_quota       INT                   DEFAULT 0,
    low_stock_threshold  INT                   DEFAULT 5,
    low_stock_alert_sent BOOLEAN               DEFAULT FALSE,
    event_id             INT          NOT NULL REFERENCES event (id) ON DELETE CASCADE,
    sale_start_date      TIMESTAMP,
    sale_end_date        TIMESTAMP,
    original_price       DECIMAL(20, 2) DEFAULT NULL,
    created_at           TIMESTAMP             DEFAULT NOW()
);

CREATE TABLE registration
(
    id                SERIAL PRIMARY KEY,
    event_id          INT NOT NULL REFERENCES event (id) ON DELETE CASCADE,
    additional_fields JSONB,
    user_timezone     VARCHAR(100) DEFAULT 'UTC', 
    timezone_offset   INT          DEFAULT 0,     
    status            BOOLEAN      DEFAULT false,
    created_at        TIMESTAMPTZ  DEFAULT NOW(), 
    updated_at        TIMESTAMP    DEFAULT NOW()    
);

CREATE TABLE temp_registration
(
    session_id        VARCHAR(255) PRIMARY KEY,
    attendees         JSONB     NOT NULL,
    registration      JSONB     NOT NULL,
    selected_tickets  JSONB     NOT NULL,
    selected_products JSONB,
    orders            JSONB     NOT NULL,
    event_id          INT       NOT NULL REFERENCES event (id) ON DELETE CASCADE,
    created_at        TIMESTAMP DEFAULT NOW(),
    expires_at        TIMESTAMP NOT NULL,
    reminder_email_sent_at TIMESTAMPTZ
);

CREATE TABLE attendees
(
    id              SERIAL PRIMARY KEY,
    registration_id INT                 NOT NULL REFERENCES registration (id) ON DELETE CASCADE,
    is_primary      BOOLEAN   DEFAULT false,
    first_name      VARCHAR(255)        NOT NULL,
    last_name       VARCHAR(255)        NOT NULL,
    email           VARCHAR(255)        NOT NULL,
    phone           VARCHAR(50),
    ticket          JSONB,
    qr_uuid         VARCHAR(255) UNIQUE NOT NULL,
    order_id        INT                 REFERENCES orders(id) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE checkin
(
    id              SERIAL PRIMARY KEY,
    attendee_id     INT NOT NULL REFERENCES attendees (id) ON DELETE CASCADE,
    registration_id INT NOT NULL REFERENCES registration (id) ON DELETE CASCADE,
    checked_in_by   INT REFERENCES app_user (id) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

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
    cashier_id INT REFERENCES app_user(id) ON DELETE SET NULL,
    ticket_counter_id INT NOT NULL REFERENCES ticket_counter(id),
    event_id INT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    organization_id INT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    opening_time TIMESTAMP NOT NULL DEFAULT NOW(),
    closing_time TIMESTAMP,
    opening_cash INT NOT NULL DEFAULT 0, -- cents
    closing_cash INT, -- cents
    expected_total INT, -- cents
    discrepancy INT, -- cents
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    timezone VARCHAR(100) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders
(
    id                       SERIAL PRIMARY KEY,
    order_number             VARCHAR(50) UNIQUE NOT NULL,
    total_amount             INT                NOT NULL,
    currency                 VARCHAR(3)         NOT NULL DEFAULT 'USD',
    payment_status           VARCHAR(20)        NOT NULL DEFAULT 'pending', -- pending, paid, failed, refunded
    payment_gateway          VARCHAR(50),                                   -- stripe, orange_money, paypal, etc.
    gateway_transaction_id   VARCHAR(255),                                  -- Transaction ID from gateway
    gateway_metadata         JSONB              DEFAULT '{}',               -- Gateway-specific data (tokens, URLs, etc.)
    gateway_response         JSONB              DEFAULT '{}',               -- Raw gateway response for debugging
    stripe_payment_intent_id VARCHAR(255),                                  -- DEPRECATED: Use gateway_transaction_id
    items_ticket             JSONB              NOT NULL,
    items_product            JSONB              NOT NULL,
    product_status           VARCHAR(20)        NOT NULL DEFAULT 'pending',
    shipping_cost            INT                         DEFAULT 0,
    shipping_address         JSONB,
    shipping_type            VARCHAR(20)        NOT NULL DEFAULT 'pickup',  -- pickup, delivery 
    tax_amount               INT                         DEFAULT 0,
    promo_code               VARCHAR(50),
    discount_amount          INT                         DEFAULT 0,
    registration_id          INT                NOT NULL REFERENCES registration (id) ON DELETE CASCADE,
    event_id                 INT                NOT NULL REFERENCES event (id) ON DELETE CASCADE,
    sales_channel            VARCHAR(20)        DEFAULT 'online' CHECK (sales_channel IN ('online', 'counter')),
    cashier_id               INT                REFERENCES app_user(id) ON DELETE SET NULL,
    ticket_counter_id        INT                REFERENCES ticket_counter(id),
    cash_session_id          INT                REFERENCES cash_session(id),
    payment_method           VARCHAR(20)        DEFAULT 'card' CHECK (payment_method IN ('cash', 'card', 'free', 'orange_money')),
    session_id               VARCHAR(255),
    created_at               TIMESTAMP                   DEFAULT NOW(),
    updated_at               TIMESTAMP                   DEFAULT NOW()
);

CREATE TABLE extras
(
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    price       INT,
    currency    VARCHAR(3) NOT NULL DEFAULT 'USD',
    content     JSONB, -- [{name, quantity}]
    event_id    INT          NOT NULL REFERENCES event (id) ON DELETE CASCADE
);

CREATE TABLE extras_purchase
(
    id              SERIAL PRIMARY KEY,
    extras_data     JSONB,                       -- [{name, price, content:[{name, quantity}]}]
    status          BOOLEAN,                     
    qr_uuid         VARCHAR(255) UNIQUE NOT NULL,
    scanned_at      TIMESTAMP DEFAULT NULL,     
    registration_id INT                 NOT NULL REFERENCES registration (id) ON DELETE CASCADE
);

CREATE TABLE form_question
(
    id          SERIAL PRIMARY KEY,
    type        VARCHAR(50) NOT NULL,
    text        TEXT        NOT NULL,
    required    BOOLEAN     NOT NULL,
    options     JSONB,
    order_index INT         DEFAULT 0,
    event_id    INTEGER     REFERENCES event ON DELETE CASCADE
);

CREATE TABLE sponsorship
(
    id                       SERIAL PRIMARY KEY,
    sponsor_data             JSONB       NOT NULL,                                        -- Store all sponsor information as JSONB
    package_type             VARCHAR(50) NOT NULL,                                        -- elite, premier, diamond, etc.
    amount                   INT         NOT NULL,
    currency                 VARCHAR(3)  NOT NULL DEFAULT 'USD',
    payment_status           VARCHAR(20) NOT NULL DEFAULT 'pending',                      -- pending, paid, failed, refunded
    payment_gateway          VARCHAR(50),
    gateway_transaction_id   VARCHAR(255),
    gateway_response         JSONB,
    stripe_payment_intent_id VARCHAR(255),
    event_id                 INT         NOT NULL REFERENCES event (id) ON DELETE CASCADE,
    organization_id          INT         NOT NULL REFERENCES organization (id) ON DELETE CASCADE,
    registration_id          INT         REFERENCES registration (id) ON DELETE SET NULL, -- Optional link to registration
    created_at               TIMESTAMP            DEFAULT NOW(),
    updated_at               TIMESTAMP            DEFAULT NOW()
);

CREATE TABLE sponsorship_package
(
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    price           INT          NOT NULL,
    currency        VARCHAR(3)   NOT NULL DEFAULT 'USD',
    available_count INT                   DEFAULT -1, -- -1 means unlimited
    features        JSONB        NOT NULL,            -- Array of features with included boolean
    is_active       BOOLEAN               DEFAULT true,
    event_id        INT          NOT NULL REFERENCES event (id) ON DELETE CASCADE,
    organization_id INT          NOT NULL REFERENCES organization (id) ON DELETE CASCADE,
    created_at      TIMESTAMP             DEFAULT NOW(),
    updated_at      TIMESTAMP             DEFAULT NOW()
);

CREATE TABLE product
(
    id          SERIAL PRIMARY KEY,
    organization_id     INT          NOT NULL REFERENCES organization (id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    price       INT          NOT NULL, -- Price in cents (Stripe format)
    stock       INT          NOT NULL DEFAULT 0,
    image       VARCHAR(255),
    sku         VARCHAR(100),          -- Optional SKU for inventory tracking
    is_active   BOOLEAN               DEFAULT true,
    created_by  INT          REFERENCES app_user (id) ON DELETE SET NULL,
    created_at  TIMESTAMP             DEFAULT NOW(),
    updated_at  TIMESTAMP             DEFAULT NOW()
);

CREATE TABLE event_product
(
    id            SERIAL PRIMARY KEY,
    event_id      INT NOT NULL REFERENCES event (id) ON DELETE CASCADE,
    product_id    INT NOT NULL REFERENCES product (id) ON DELETE CASCADE,
    is_featured   BOOLEAN   DEFAULT false,
    display_order INT       DEFAULT 0,
    created_at    TIMESTAMP DEFAULT NOW(),
    UNIQUE (event_id, product_id)
);

CREATE TABLE user_settings
(
    id         SERIAL PRIMARY KEY,
    user_id    INT NOT NULL UNIQUE REFERENCES app_user (id) ON DELETE CASCADE,
    theme      VARCHAR(20) NOT NULL DEFAULT 'dark',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_visitor 
(
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    visited_at TIMESTAMPTZ DEFAULT NOW(),
    converted BOOLEAN DEFAULT false, -- True if visitor completed purchase
    converted_at TIMESTAMPTZ, -- When purchase was completed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE footer_settings 
(
    id SERIAL PRIMARY KEY,
    style VARCHAR(20) NOT NULL DEFAULT 'expanded' CHECK (style IN ('oneline', 'expanded')),
    company_name VARCHAR(255),
    company_address TEXT,
    company_email VARCHAR(255),
    company_phone VARCHAR(50),
    quick_links JSONB DEFAULT '[]',
    social_links JSONB DEFAULT '{}',
    copyright_text VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE header_settings 
(
    id SERIAL PRIMARY KEY,
    logo_image VARCHAR(255),
    logo_image_dark VARCHAR(255),
    logo_position VARCHAR(20) NOT NULL DEFAULT 'left' CHECK (logo_position IN ('left', 'center', 'right')),
    menu_position VARCHAR(20) NOT NULL DEFAULT 'right' CHECK (menu_position IN ('left', 'center', 'right')),
    logo_width_left INT DEFAULT 300,
    logo_width_center INT DEFAULT 180,
    logo_width_mobile INT DEFAULT 120,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE password_reset_requests
(
    id         SERIAL PRIMARY KEY,
    email      VARCHAR(255) NOT NULL,
    token      VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP    NOT NULL,
    used       BOOLEAN      DEFAULT false,
    created_at TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE appearance_settings
(
    id              SERIAL PRIMARY KEY,
    default_theme   VARCHAR(20) NOT NULL DEFAULT 'dark' CHECK (default_theme IN ('dark', 'light')),
    light_colors    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    light_variables JSONB       NOT NULL DEFAULT '{}'::jsonb,
    dark_colors     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    dark_variables  JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE homepage_section
(
    id                SERIAL PRIMARY KEY,
    section_type      VARCHAR(50) NOT NULL CHECK (section_type IN (
        'hero', 'rich_text', 'image_only', 'image_text', 'event_grid',
        'video_grid', 'blog_posts', 'card_grid', 'instagram_feed',
        'contact_form', 'sponsors', 'banner'
    )),
    display_order     INT          NOT NULL DEFAULT 0,
    is_active         BOOLEAN      DEFAULT true,
    is_published      BOOLEAN      DEFAULT false,
    config            JSONB        NOT NULL DEFAULT '{}',
    style_config      JSONB        DEFAULT '{}',
    responsive_config JSONB        DEFAULT '{}',
    created_by        INT          REFERENCES app_user (id) ON DELETE SET NULL,
    created_at        TIMESTAMP    DEFAULT NOW(),
    updated_at        TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE homepage_form_submission
(
    id         SERIAL PRIMARY KEY,
    section_id INT REFERENCES homepage_section (id) ON DELETE CASCADE,
    form_data  JSONB NOT NULL, -- Stores all form field values
    ip_address VARCHAR(45),
    user_agent TEXT,
    spam_score DECIMAL(3, 2) DEFAULT 0, -- 0-1, higher = more likely spam
    is_spam    BOOLEAN       DEFAULT false,
    created_at TIMESTAMP     DEFAULT NOW()
);

CREATE TABLE organizer_dashboard_banner
(
    id              SERIAL PRIMARY KEY,
    is_enabled      BOOLEAN      NOT NULL DEFAULT false,
    icon            VARCHAR(100) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    cta_button_text VARCHAR(100) NOT NULL,
    cta_button_url  VARCHAR(500) NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
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
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
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

-- Support sessions
CREATE TABLE support_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INT REFERENCES app_user(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  summary TEXT,
  last_intent VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  message_count INT DEFAULT 0 NOT NULL,
  last_summarized_message_count INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW()
);

-- Support messages
CREATE TABLE support_messages (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL REFERENCES support_sessions(session_id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  intent VARCHAR(50),
  confidence DECIMAL(3,2),
  slots JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Support requests
CREATE TABLE support_requests (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) REFERENCES support_sessions(session_id),
  registration_id INT REFERENCES registration(id),
  order_id INT REFERENCES orders(id),
  intent_type VARCHAR(50) NOT NULL,
  user_email VARCHAR(255),
  user_input JSONB,
  llm_parsed JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  action_result JSONB,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- OTP verification
CREATE TABLE support_otp (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  code VARCHAR(10) NOT NULL,
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMP NOT NULL,
  support_request_id INT REFERENCES support_requests(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Circular Reference / Late Dependency Handling
ALTER TABLE organization
    ADD CONSTRAINT organization_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES app_user (id) ON DELETE SET NULL;

ALTER TABLE registration
    ADD COLUMN primary_attendee_id INT REFERENCES attendees (id);

ALTER TABLE attendees
    ADD COLUMN session_id VARCHAR(255) REFERENCES temp_registration (session_id);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings (user_id);
CREATE INDEX idx_product_organization_id ON product (organization_id);
CREATE INDEX idx_product_is_active ON product (is_active);
CREATE INDEX idx_event_product_event_id ON event_product (event_id);
CREATE INDEX idx_event_product_product_id ON event_product (product_id);
CREATE INDEX idx_event_product_display_order ON event_product (event_id, display_order);
CREATE INDEX idx_event_status ON event (status);
CREATE INDEX idx_event_organization_status ON event (organization_id, status);

CREATE INDEX idx_attendees_qr_uuid ON attendees (qr_uuid);
CREATE INDEX idx_attendees_registration_id ON attendees (registration_id);
CREATE INDEX idx_attendees_email ON attendees (email);
CREATE INDEX idx_registration_event_id ON registration (event_id);
CREATE INDEX idx_registration_status ON registration (status);
CREATE INDEX idx_checkin_attendee_id ON checkin (attendee_id);
CREATE INDEX idx_checkin_registration_id ON checkin (registration_id);

CREATE INDEX idx_temp_registration_expires ON temp_registration (expires_at);
CREATE INDEX idx_temp_registration_session ON temp_registration (session_id);
CREATE INDEX idx_temp_registration_reminder_email_sent ON temp_registration (reminder_email_sent_at) WHERE reminder_email_sent_at IS NULL;

CREATE INDEX idx_password_reset_requests_token ON password_reset_requests (token);
CREATE INDEX idx_password_reset_requests_email ON password_reset_requests (email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_appearance_settings_singleton ON appearance_settings ((1));
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizer_dashboard_banner_singleton ON organizer_dashboard_banner ((1));

CREATE INDEX idx_orders_sales_channel ON orders (sales_channel);
CREATE INDEX idx_orders_cashier_id ON orders (cashier_id);
CREATE INDEX idx_orders_ticket_counter_id ON orders (ticket_counter_id);
    CREATE INDEX idx_orders_cash_session_id ON orders (cash_session_id);
    CREATE INDEX idx_orders_gateway_transaction_id ON orders (gateway_transaction_id);
    CREATE INDEX idx_sponsorship_gateway_transaction_id ON sponsorship (gateway_transaction_id);

CREATE INDEX idx_ticket_counter_organization_id ON ticket_counter (organization_id);
CREATE INDEX idx_cash_session_organization_id ON cash_session (organization_id);
CREATE INDEX idx_cash_session_event_id ON cash_session (event_id);
CREATE INDEX idx_promo_code_event_id ON promo_code (event_id);
CREATE INDEX idx_event_staff_event_id ON event_staff (event_id);
CREATE INDEX idx_event_staff_user_id ON event_staff (user_id);
CREATE INDEX IF NOT EXISTS idx_attendees_order_id ON attendees(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);

CREATE INDEX idx_event_visitor_event_id ON event_visitor(event_id);
CREATE INDEX idx_event_visitor_email ON event_visitor(email);
CREATE INDEX idx_event_visitor_visited_at ON event_visitor(visited_at);
CREATE INDEX idx_event_visitor_converted ON event_visitor(converted);
CREATE INDEX idx_event_visitor_event_visited ON event_visitor(event_id, visited_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_header_settings_singleton ON header_settings ((1));
CREATE UNIQUE INDEX IF NOT EXISTS idx_footer_settings_singleton ON footer_settings ((1));

CREATE INDEX IF NOT EXISTS idx_support_sessions_session_id ON support_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_support_sessions_user_email ON support_sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_support_messages_session_id ON support_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_support_requests_session_id ON support_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_support_requests_intent_type ON support_requests(intent_type);
CREATE INDEX IF NOT EXISTS idx_support_otp_email_purpose ON support_otp(email, purpose);
CREATE INDEX IF NOT EXISTS idx_support_otp_expires_at ON support_otp(expires_at);

-- Comments
COMMENT ON COLUMN support_sessions.message_count IS 'Total number of messages in this session (incremented on each message)';
COMMENT ON COLUMN support_sessions.last_summarized_message_count IS 'Message count when summary was last generated (for efficient summarization checks)';