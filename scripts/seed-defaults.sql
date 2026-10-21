-- Default rows for a fresh, empty database (local development).
-- NOT run by deploy.yml. Run once by hand after schema.sql, e.g.:
--   npx wrangler d1 execute onopo-db --local --file=./scripts/seed-defaults.sql
-- Never run it against the live database: it would bring back rows deleted in the admin panel.

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
