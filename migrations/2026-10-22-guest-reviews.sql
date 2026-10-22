-- Guest reviews and review-request e-mails (lib/order-reviews.ts, lib/review-link.ts).
--
-- What it does:
--   * reviews: user_id becomes nullable (a guest who got the review e-mail has no account) and gains
--       order_id       INTEGER NULL  -- the order whose review link was used (no foreign key: deleting an order
--                                    -- must keep working and keeps the review)
--       reviewer_name  TEXT NULL     -- display name only ("Ayşe K."), never the full name
--       verified       INTEGER NOT NULL DEFAULT 0  -- 1 = written through a real order's link
--     plus UNIQUE(order_id, product_id): one review per product per order. SQLite treats NULLs as distinct, so
--     reviews without an order (account reviews) are not limited by it.
--     SQLite cannot drop NOT NULL with ALTER TABLE, so the table is rebuilt: CREATE new / INSERT SELECT /
--     DROP / RENAME. Every existing row keeps its id, and the AUTOINCREMENT counter follows the copied ids.
--   * review_requests: one row per order that got the e-mail (order_id, sent_at, status, error). No e-mail
--     address is stored.
--
-- Run once, from the main checkout, after a backup:
--   wrangler d1 export onopo-db --remote --output=backups/backup-<date>.sql
--   wrangler d1 execute onopo-db --remote --file=migrations/2026-10-22-guest-reviews.sql
-- A remote --file run is atomic: if a statement fails, the database returns to its original state.
-- Running it a second time stops at the guard below ("CHECK constraint failed: guest_reviews_already_applied")
-- before anything changes, so it can never copy the table again and lose the new columns.
-- Until it has run, the site keeps working: the review link page says reviews are temporarily unavailable and
-- the daily cron logs a warning and skips the e-mails.

PRAGMA defer_foreign_keys = true;

-- Guard: fails (and rolls everything back) when reviews already has order_id
CREATE TABLE IF NOT EXISTS _guard_guest_reviews (
    ok INTEGER NOT NULL CONSTRAINT guest_reviews_already_applied CHECK (ok = 1)
);
INSERT INTO _guard_guest_reviews (ok)
    SELECT COUNT(*) = 0 FROM pragma_table_info('reviews') WHERE name = 'order_id';

DROP TABLE IF EXISTS reviews_new;
CREATE TABLE reviews_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    order_id INTEGER,
    reviewer_name TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (order_id, product_id)
);

INSERT INTO reviews_new (id, product_id, user_id, rating, comment, created_at, order_id, reviewer_name, verified)
    SELECT id, product_id, user_id, rating, comment, created_at, NULL, NULL, 0 FROM reviews;

DROP TABLE reviews;
ALTER TABLE reviews_new RENAME TO reviews;

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id);

CREATE TABLE IF NOT EXISTS review_requests (
    order_id INTEGER PRIMARY KEY,
    sent_at TEXT NOT NULL,                   -- ISO time (UTC) of the claim / the send
    status TEXT NOT NULL,                    -- sending | sent | failed
    error TEXT                               -- short reason for failed (no e-mail address)
);
CREATE INDEX IF NOT EXISTS idx_review_requests_status ON review_requests(status, sent_at);

DROP TABLE _guard_guest_reviews;

-- Check afterwards (counts only):
--   SELECT COUNT(*), MAX(id) FROM reviews;      -- same as before the run
--   SELECT name FROM pragma_table_info('reviews');
