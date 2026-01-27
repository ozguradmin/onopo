-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user',
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
    image TEXT, -- Main image
    images TEXT, -- JSON string for array of additional images
    features TEXT, -- JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Hero Slides table for dynamic homepage configuration
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

-- Initial seed for Hero Slides (if empty)
INSERT INTO hero_slides (title, subtitle, button_text, button_link, image_url, display_order)
SELECT 'Güzelliği Keşfet', 'Yeni Sezon Koleksiyonu', 'Alışverişe Başla', '/beauty', 'https://images.unsplash.com/photo-1596462502278-27bfdd403cc2?q=80&w=2000&auto=format&fit=crop', 1
WHERE NOT EXISTS (SELECT 1 FROM hero_slides);

INSERT INTO hero_slides (title, subtitle, button_text, button_link, image_url, display_order)
SELECT 'Teknoloji Dünyası', 'En Yeni Gadgetlar', 'İncele', '/tech', 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=2000&auto=format&fit=crop', 2
WHERE NOT EXISTS (SELECT 1 FROM hero_slides WHERE id > 1);
