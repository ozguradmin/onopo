DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user', -- 'admin' or 'user'
  full_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  original_price REAL,
  stock INTEGER DEFAULT 0,
  images TEXT, -- stored as JSON array of R2 URLs
  category TEXT,
  is_featured BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, -- nullable for guest checkout if needed, or link to users
  guest_email TEXT, -- if guest checkout
  status TEXT DEFAULT 'pending', -- pending, processing, shipped, delivered, cancelled
  total_amount REAL NOT NULL,
  shipping_address TEXT, -- JSON structure: { city, district, full_address, phone }
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  product_id INTEGER,
  quantity INTEGER NOT NULL,
  price_at_purchase REAL NOT NULL, -- price snapshot
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Initial Admin User (Will change password later via API)
-- Password 'admin123' hashed (simulated for now, backend will handle hatching properly)
-- For now just a placeholder, we'll implement auth endpoint to create users.
