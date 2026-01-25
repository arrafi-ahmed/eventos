-- Homepage Page Builder Schema
-- Future-proof design for flexible homepage sections
--
-- NOTE: Banners are now stored in `homepage_section` table with `section_type = 'banner'`.
-- Banner configuration is stored in the `config` JSONB field with structure:
-- {
--   "image": "path/to/banner.jpg",
--   "link": "https://example.com",
--   "startDate": "2024-01-01T00:00:00Z",
--   "endDate": "2024-12-31T23:59:59Z"
-- }

-- Main sections table - stores all homepage sections
CREATE TABLE homepage_section (
    id SERIAL PRIMARY KEY,
    section_type VARCHAR(50) NOT NULL CHECK (section_type IN (
        'hero',
        'rich_text',
        'image_only',
        'image_text',
        'event_grid',
        'video_grid',
        'blog_posts',
        'card_grid',
        'instagram_feed',
        'contact_form',
        'sponsors',
        'banner' -- For the simple banner feature
    )),
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_published BOOLEAN DEFAULT false, -- Draft vs Published state
    -- Flexible configuration stored as JSONB
    -- Each section type has its own config structure
    config JSONB NOT NULL DEFAULT '{}',
    -- Styling options (optional, can be per-section)
    style_config JSONB DEFAULT '{}', -- { backgroundColor, padding, margin, etc. }
    -- Responsive settings
    responsive_config JSONB DEFAULT '{}', -- { mobile: {...}, tablet: {...}, desktop: {...} }
    -- Metadata
    created_by INT REFERENCES app_user(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Note: Indexes can be added later based on query patterns
-- Note: updated_at timestamp should be handled programmatically in application code

-- Example config structures for each section type:
-- 
-- HERO:
-- {
--   "title": "Welcome",
--   "subtitle": "Subtitle text",
--   "backgroundType": "image|video",
--   "backgroundImage": "path/to/image.jpg",
--   "backgroundVideo": "path/to/video.mp4|youtube_url",
--   "ctaButton": {
--     "text": "Get Started",
--     "link": "/register",
--     "variant": "primary|secondary",
--     "show": true
--   },
--   "overlay": {
--     "enabled": true,
--     "opacity": 0.5,
--     "color": "#000000"
--   }
-- }
--
-- RICH_TEXT:
-- {
--   "content": "<p>HTML content</p>",
--   "textAlign": "left|center|right",
--   "maxWidth": "1200px",
--   "backgroundColor": "#ffffff",
--   "textColor": "#000000"
-- }
--
-- IMAGE_ONLY:
-- {
--   "image": "path/to/image.jpg",
--   "caption": "Optional caption",
--   "altText": "Alt text for accessibility",
--   "width": "full|contained",
--   "link": "optional-link-url"
-- }
--
-- IMAGE_TEXT:
-- {
--   "image": "path/to/image.jpg",
--   "imagePosition": "left|right",
--   "layout": "1-column|2-column",
--   "title": "Section Title",
--   "content": "<p>Paragraph content</p>",
--   "ctaButton": {
--     "text": "Learn More",
--     "link": "/about"
--   }
-- }
--
-- EVENT_GRID:
-- {
--   "title": "Upcoming Events",
--   "columns": 3,
--   "eventType": "upcoming|featured|all",
--   "limit": 6,
--   "clubId": 1,
--   "showDate": true,
--   "showLocation": true
-- }
--
-- VIDEO_GRID:
-- {
--   "title": "Videos",
--   "columns": 2,
--   "videos": [
--     {
--       "type": "youtube|vimeo",
--       "url": "https://youtube.com/watch?v=...",
--       "thumbnail": "optional-thumbnail.jpg",
--       "title": "Video Title"
--     }
--   ]
-- }
--
-- BLOG_POSTS:
-- {
--   "title": "Latest Blog Posts",
--   "columns": 3,
--   "limit": 6,
--   "source": "internal|external",
--   "externalRssUrl": "optional-rss-url",
--   "showExcerpt": true,
--   "showDate": true
-- }
--
-- CARD_GRID:
-- {
--   "title": "Features",
--   "columns": 3,
--   "cards": [
--     {
--       "backgroundImage": "path/to/image.jpg",
--       "title": "Card Title",
--       "subtitle": "Card subtitle",
--       "button": {
--         "text": "Learn More",
--         "link": "/feature"
--       },
--       "overlay": {
--         "enabled": true,
--         "opacity": 0.6
--       }
--     }
--   ]
-- }
--
-- INSTAGRAM_FEED:
-- {
--   "title": "Follow Us",
--   "account": "@username",
--   "accessToken": "encrypted-token",
--   "displayType": "grid|carousel",
--   "columns": 4,
--   "limit": 8,
--   "autoRefresh": true
-- }
--
-- CONTACT_FORM:
-- {
--   "title": "Get in Touch",
--   "fields": [
--     {
--       "name": "name",
--       "label": "Name",
--       "type": "text",
--       "required": true
--     },
--     {
--       "name": "email",
--       "label": "Email",
--       "type": "email",
--       "required": true
--     },
--     {
--       "name": "message",
--       "label": "Message",
--       "type": "textarea",
--       "required": true
--     }
--   ],
--   "submitButton": {
--     "text": "Send Message",
--     "variant": "primary"
--   },
--   "thankYouMessage": "Thank you for your message!",
--   "emailTo": "admin@example.com",
--   "spamProtection": {
--     "enabled": true,
--     "type": "recaptcha|honeypot"
--   }
-- }
--
-- SPONSORS:
-- {
--   "title": "Our Sponsors",
--   "columns": 4,
--   "sponsors": [
--     {
--       "logo": "path/to/logo.jpg",
--       "name": "Company Name",
--       "link": "https://company.com",
--       "tier": "platinum|gold|silver"
--     }
--   ]
-- }
--
-- BANNER (simple rotating banner):
-- {
--   "banners": [
--     {
--       "image": "path/to/banner.jpg",
--       "link": "https://example.com",
--       "startDate": "2024-01-01T00:00:00Z",
--       "endDate": "2024-12-31T23:59:59Z"
--     }
--   ],
--   "autoRotate": true,
--   "rotationInterval": 5000,
--   "showNavigation": true,
--   "showIndicators": true
-- }

-- For storing form submissions (if contact form is used)
CREATE TABLE homepage_form_submission (
    id SERIAL PRIMARY KEY,
    section_id INT REFERENCES homepage_section(id) ON DELETE CASCADE,
    form_data JSONB NOT NULL, -- Stores all form field values
    ip_address VARCHAR(45),
    user_agent TEXT,
    spam_score DECIMAL(3,2) DEFAULT 0, -- 0-1, higher = more likely spam
    is_spam BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Note: Indexes can be added later based on query patterns
-- Note: updated_at timestamp should be handled programmatically in application code