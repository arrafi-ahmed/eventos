-- Create event_visitor table to track visitors who fill out the landing page form
CREATE TABLE event_visitor (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    
    -- Visitor details from form
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    
    -- Tracking metadata
    visited_at TIMESTAMPTZ DEFAULT NOW(),
    converted BOOLEAN DEFAULT false, -- True if visitor completed purchase
    converted_at TIMESTAMPTZ, -- When purchase was completed
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_event_visitor_event_id ON event_visitor(event_id);
CREATE INDEX idx_event_visitor_email ON event_visitor(email);
CREATE INDEX idx_event_visitor_visited_at ON event_visitor(visited_at);
CREATE INDEX idx_event_visitor_converted ON event_visitor(converted);
CREATE INDEX idx_event_visitor_event_visited ON event_visitor(event_id, visited_at);