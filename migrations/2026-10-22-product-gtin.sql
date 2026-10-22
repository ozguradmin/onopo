-- Product barcode (GTIN-8/12/13/14 = EAN/UPC) for the Google Merchant feed, the Akakçe feed and the Product JSON-LD.
-- Edited in Admin › Ürünler ("Barkod (GTIN/EAN)"); validated with lib/gtin.ts (GS1 check digit), empty allowed.
-- The code works without the column until this has run (lib/gtin.ts hasGtinColumn; product saves skip it).
--
-- Run once:  wrangler d1 execute onopo-db --remote --file=migrations/2026-10-22-product-gtin.sql
-- SQLite has no ADD COLUMN IF NOT EXISTS: a second run fails with "duplicate column name: gtin" and changes nothing.
ALTER TABLE products ADD COLUMN gtin TEXT;
