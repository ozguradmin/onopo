-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT DEFAULT 'package',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    original_price REAL,
    stock INTEGER DEFAULT 0,
    category TEXT,
    image TEXT,
    images TEXT,
    features TEXT,
    warranty_info TEXT,
    delivery_info TEXT,
    installment_info TEXT,
    is_active INTEGER DEFAULT 1,
    product_code TEXT,
    whatsapp_order_enabled INTEGER DEFAULT 0,
    whatsapp_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Custom Menus
CREATE TABLE IF NOT EXISTS menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    items TEXT, -- JSON array
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Hero Slides table
CREATE TABLE IF NOT EXISTS hero_slides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    subtitle TEXT,
    button_text TEXT,
    button_link TEXT,
    image_url TEXT,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1
);

-- Site Settings (key-value store for site configuration)
CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Homepage Sections (dynamic sections with drag-drop ordering)
CREATE TABLE IF NOT EXISTS homepage_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'hero', 'products', 'features', 'image_card', 'banner'
    title TEXT,
    config TEXT, -- JSON configuration
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Featured Products (manual product selection for sections)
CREATE TABLE IF NOT EXISTS featured_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY (section_id) REFERENCES homepage_sections(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Pages (editable static pages)
CREATE TABLE IF NOT EXISTS pages (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Analytics (page view tracking)
CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page TEXT,
    product_id INTEGER,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Favorites (user liked products)
CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(user_id, product_id)
);

-- Admin 2FA challenges (app/api/auth/two-factor.ts): one row per admin login that sent a code. The random
-- id is also the value of the HttpOnly challenge cookie; wrong codes are counted per challenge (max 5).
-- The code itself stays in two_factor_codes. Additive only: older code simply never reads this table.
CREATE TABLE IF NOT EXISTS two_factor_challenges (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    code_id INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Password-login attempt limit (app/api/auth/login-limit.ts): one row per attempt that has not (yet) proven the
-- right password, keyed by SHA-256 hashes (with the JWT secret) of the account e-mail and the client IP (no
-- e-mails or IPs stored). attempted_at is Unix time in ms; rows older than the 15-minute window are deleted by the login route.
-- Additive only: older code simply never reads this table.
CREATE TABLE IF NOT EXISTS login_failures (
    id INTEGER PRIMARY KEY,
    email_hash TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    attempted_at INTEGER NOT NULL
);

-- No INSERT statements here: deploy.yml runs this file against the live database on every push,
-- so seed rows would come back after being deleted in the admin panel. Default rows for a fresh,
-- empty database are in scripts/seed-defaults.sql (run it once by hand).

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product_id ON favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_homepage_sections_is_active ON homepage_sections(is_active);
CREATE INDEX IF NOT EXISTS idx_two_factor_challenges_user_id ON two_factor_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_login_failures_email_ip ON login_failures(email_hash, ip_hash, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_failures_ip ON login_failures(ip_hash, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_failures_attempted_at ON login_failures(attempted_at);

-- AI assistant (Onopo Asistan). Additive only: older code simply never reads these tables.
-- These two hold no chat text: only daily counters and content-free events (transcripts: ai_messages below).
CREATE TABLE IF NOT EXISTS ai_usage_daily (
    day TEXT NOT NULL,                       -- 'YYYY-MM-DD', Europe/Istanbul
    bucket TEXT NOT NULL,                    -- 'global' or 'ip:<daily HMAC>' (ip rows deleted after 2 days)
    turns INTEGER NOT NULL DEFAULT 0,
    model_calls INTEGER NOT NULL DEFAULT 0,
    cost_micro_usd INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, bucket)
);

CREATE TABLE IF NOT EXISTS ai_chat_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    day TEXT NOT NULL,                       -- 'YYYY-MM-DD', Europe/Istanbul (pruned after 365 days)
    kind TEXT NOT NULL,                      -- 'turn' | 'ui'
    conv_hash TEXT,                          -- sha256(conversationId), 16 hex chars
    turn INTEGER,
    mode TEXT,                               -- llm | canned | fallback
    intent TEXT,
    flags TEXT,                              -- comma list, e.g. router_timeout,validator_drop,price_mismatch
    model TEXT,
    model_calls INTEGER,
    tools TEXT,                              -- comma list of tool names
    products TEXT,                           -- comma list of product ids shown / acted on
    handoff TEXT,                            -- HandoffReason or NULL
    in_tokens INTEGER,
    cached_tokens INTEGER,
    out_tokens INTEGER,
    cost_micro_usd INTEGER,
    first_text_ms INTEGER,
    total_ms INTEGER,
    outcome TEXT                             -- ok | canned | blocked | fallback | busy | error | timeout | aborted | <ui type>
);
CREATE INDEX IF NOT EXISTS idx_ai_chat_events_day ON ai_chat_events(day);

-- Onopo Asistan product facts: one short line per product, written by the chat model once per
-- (name + description) hash (lib/assistant/product-facts.ts). Product data only, no customer data.
CREATE TABLE IF NOT EXISTS ai_product_facts (
    product_id INTEGER PRIMARY KEY,
    desc_hash TEXT NOT NULL,                 -- sha256(name + description), 16 hex chars
    facts TEXT NOT NULL,
    model TEXT,
    created_at TEXT NOT NULL                 -- ISO time (UTC)
);

-- Onopo Asistan transcripts (owner decision, w7): kept 365 days for review and analysis, deletable from
-- /admin/assistant/sohbetler/. Only the MASKED user text (what the model saw), the validated answer and its
-- cards (WhatsApp card without the number). No IP, user agent or raw input (lib/assistant/transcripts.ts).
CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY,                     -- sha256(conversationId), 16 hex chars (= ai_chat_events.conv_hash)
    day TEXT NOT NULL,                       -- 'YYYY-MM-DD' of the first message, Europe/Istanbul
    started_at TEXT NOT NULL,                -- ISO time (UTC)
    last_at TEXT NOT NULL,
    turns INTEGER NOT NULL DEFAULT 0,
    first_message TEXT,                      -- masked
    device TEXT,                             -- phone model pill (masked)
    page TEXT,                               -- 'anasayfa', 'ürün: /slug/', 'arama: …'
    wa_shown INTEGER NOT NULL DEFAULT 0,     -- a full WhatsApp card was shown
    product_ids TEXT,                        -- comma list of products shown on cards
    n_ok INTEGER NOT NULL DEFAULT 0,
    n_error INTEGER NOT NULL DEFAULT 0,
    n_busy INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_last ON ai_conversations(last_at);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_day ON ai_conversations(day);

CREATE TABLE IF NOT EXISTS ai_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conv_id TEXT NOT NULL,                   -- ai_conversations.id
    turn INTEGER NOT NULL,
    role TEXT NOT NULL,                      -- 'user' | 'assistant'
    text TEXT NOT NULL,                      -- user: masked; assistant: the validated answer
    events TEXT,                             -- assistant: JSON card events (products, compare, links, store_info, whatsapp, suggestions)
    outcome TEXT,
    model TEXT,
    total_ms INTEGER,
    created_at TEXT NOT NULL                 -- ISO time (UTC)
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conv_id, id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created ON ai_messages(created_at);

-- Store statistics (lib/analytics.ts, lib/analytics-db.ts; also created lazily there). Additive only: the old
-- analytics table is still written, so older code keeps working. No IP and no user agent is stored: visitor is
-- HMAC-SHA256(salt of the month, IP + user agent), 16 hex chars; a month's salt is deleted once the month is over.
-- day is the Europe/Istanbul day. is_bot = 1 rows (no Accept-Language) are kept out of every count.
CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY,
    day TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    path TEXT NOT NULL,
    product_id INTEGER,
    visitor TEXT NOT NULL,
    device_type TEXT NOT NULL,               -- phone | tablet | desktop
    referrer_type TEXT NOT NULL,             -- internal | direct | google | social | other (first view of a visit)
    is_bot INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_page_views_day ON page_views(day, is_bot, visitor);
CREATE INDEX IF NOT EXISTS idx_page_views_product ON page_views(product_id, day);

CREATE TABLE IF NOT EXISTS analytics_salts (
    month TEXT PRIMARY KEY,                  -- 'YYYY-MM' (Istanbul)
    salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The admin statistics read the old table by date
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at);

-- System log, "Sistem kayıtları" in the admin (lib/system-log.ts; also created lazily there). What the automatic
-- jobs (assistant product facts, image variants, the daily cron) could not do. The same source + message + ref
-- within 24 h is one row (count, last_at). resolved_at = "Çözüldü" (cleared when it happens again). Rows whose
-- last_at is older than 90 days are deleted. No customer data.
CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    source TEXT NOT NULL,                    -- redirects | facts | images | cron | assistant | other
    level TEXT NOT NULL,                     -- error | warn | info
    message TEXT NOT NULL,
    detail TEXT,
    ref TEXT,
    count INTEGER NOT NULL DEFAULT 1,
    last_at TEXT NOT NULL,
    resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_system_logs_last ON system_logs(last_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_key ON system_logs(source, message, last_at);
