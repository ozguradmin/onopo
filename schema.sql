-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

-- Initial categories
INSERT OR IGNORE INTO categories (name, slug) VALUES ('Teknoloji', 'tech');
INSERT OR IGNORE INTO categories (name, slug) VALUES ('Kozmetik & Bakım', 'beauty');
INSERT OR IGNORE INTO categories (name, slug) VALUES ('Oyun & Eğlence', 'gaming');
INSERT OR IGNORE INTO categories (name, slug) VALUES ('Yeni Gelenler', 'new');

-- Initial site settings
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_name', 'Onopo');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('logo_url', '');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('footer_text', '© 2024 Onopo. Tüm hakları saklıdır.');

-- Initial pages
INSERT OR IGNORE INTO pages (slug, title, content) VALUES ('help', 'Yardım Merkezi', '# Yardım Merkezi\n\nSorularınız için bize ulaşın.');
INSERT OR IGNORE INTO pages (slug, title, content) VALUES ('shipping', 'Kargo ve İade', '# Kargo ve İade\n\nKargo ve iade politikamız.');
INSERT OR IGNORE INTO pages (slug, title, content) VALUES ('policy', 'Gizlilik Politikası', '# Gizlilik Politikası\n\nGizlilik politikamız.');
INSERT OR IGNORE INTO pages (slug, title, content) VALUES ('terms', 'Kullanım Koşulları', '# Kullanım Koşulları\n\nKullanım koşullarımız.');

-- Default homepage sections
INSERT OR IGNORE INTO homepage_sections (id, type, title, config, display_order, is_active) 
VALUES (1, 'hero', 'Hero Slider', '{}', 1, 1);

INSERT OR IGNORE INTO homepage_sections (id, type, title, config, display_order, is_active) 
VALUES (2, 'products', 'Trend Ürünler', '{"selection_type": "all", "limit": 8}', 2, 1);

INSERT OR IGNORE INTO homepage_sections (id, type, title, config, display_order, is_active) 
VALUES (3, 'features', 'Neden Onopo', '{"items": [{"icon": "truck", "title": "Hızlı Teslimat", "description": "Aynı gün kargo"}, {"icon": "shield", "title": "Güvenli Ödeme", "description": "256-bit SSL"}, {"icon": "headphones", "title": "7/24 Destek", "description": "Her zaman yanınızda"}]}', 3, 1);
