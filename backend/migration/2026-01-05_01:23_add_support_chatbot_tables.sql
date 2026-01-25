-- Support Chatbot Tables Migration
-- Creates all necessary tables for the AI after-sales support chatbot

-- Support sessions
CREATE TABLE IF NOT EXISTS support_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INT REFERENCES app_user(id),
  user_email VARCHAR(255),
  summary TEXT,
  last_intent VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW()
);

-- Support messages
CREATE TABLE IF NOT EXISTS support_messages (
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
CREATE TABLE IF NOT EXISTS support_requests (
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
CREATE TABLE IF NOT EXISTS support_otp (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  code VARCHAR(10) NOT NULL,
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMP NOT NULL,
  support_request_id INT REFERENCES support_requests(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_support_sessions_session_id ON support_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_support_sessions_user_email ON support_sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_support_messages_session_id ON support_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_support_requests_session_id ON support_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_support_requests_intent_type ON support_requests(intent_type);
CREATE INDEX IF NOT EXISTS idx_support_otp_email_purpose ON support_otp(email, purpose);
CREATE INDEX IF NOT EXISTS idx_support_otp_expires_at ON support_otp(expires_at);







