// Unit tests for reviews from real orders: the signed review link (lib/review-link.ts), the review-request job and
// the link reviews (lib/order-reviews.ts), and the table rebuild migrations/2026-10-22-guest-reviews.sql.
// Run: node --test scripts/reviews.test.mjs   (Node 23.6+ strips the TypeScript types itself; node:sqlite stands in
// for D1, with foreign keys enforced like D1). No network: the mail sender, the clock and the log are fakes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

// The app imports '@/…' and extensionless relative paths; resolve them to the .ts files.
const ROOT = new URL('../', import.meta.url)
registerHooks({
    resolve(specifier, context, next) {
        let spec = specifier.startsWith('@/') ? new URL(specifier.slice(2), ROOT).href : specifier
        if ((spec.startsWith('.') || spec.startsWith('file:')) && !/\.[cm]?[jt]sx?$/.test(spec)) {
            for (const ext of ['.ts', '.tsx']) {
                const url = new URL(spec + ext, context.parentURL)
                if (existsSync(fileURLToPath(url))) return next(url.href, context)
            }
        }
        return next(spec, context)
    },
})
const link = await import('../lib/review-link.ts')
const or = await import('../lib/order-reviews.ts')

const MIGRATION = readFileSync(new URL('../migrations/2026-10-22-guest-reviews.sql', import.meta.url), 'utf8')
const SECRET = 'test-secret-for-review-links-0123456789'
const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-10-22T07:00:00Z')
const ago = days => or.sqlTime(new Date(NOW.getTime() - days * DAY))

// ---------------------------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------------------------

/** D1 on node:sqlite: prepare → bind → run/all/first, like the real binding (foreign keys on, as in D1). */
function fakeD1() {
    const raw = new DatabaseSync(':memory:')
    raw.exec('PRAGMA foreign_keys = ON')
    const norm = v => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v)
    const stmt = (sql, binds = []) => ({
        bind: (...values) => stmt(sql, values),
        async run() {
            const r = raw.prepare(sql).run(...binds.map(norm))
            return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
        },
        async all() {
            return { results: raw.prepare(sql).all(...binds.map(norm)).map(r => ({ ...r })) }
        },
        async first() {
            const r = raw.prepare(sql).get(...binds.map(norm))
            return r ? { ...r } : null
        },
    })
    return { prepare: sql => stmt(sql), raw }
}

/** The live schema before the migration (columns the code reads), with a few rows. */
function oldSchemaDb() {
    const db = fakeD1()
    db.raw.exec(`
        CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'user', full_name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, images TEXT, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, guest_email TEXT, status TEXT DEFAULT 'pending', total_amount REAL NOT NULL, shipping_address TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, payment_status TEXT DEFAULT 'pending', FOREIGN KEY (user_id) REFERENCES users(id));
        CREATE TABLE order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, product_id INTEGER, quantity INTEGER NOT NULL, price_at_purchase REAL NOT NULL, product_name TEXT, FOREIGN KEY (order_id) REFERENCES orders(id), FOREIGN KEY (product_id) REFERENCES products(id));
        CREATE TABLE site_settings (key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
            comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        INSERT INTO users (id, email, password_hash, full_name) VALUES (1, 'a@example.test', 'x', 'AYŞE KAYA'), (2, 'b@example.test', 'x', 'Mehmet Demir');
        INSERT INTO products (id, name, slug, images, is_active) VALUES
            (10, 'Onopo Kablo', 'kablo', '["/api/images/k.png","/api/images/k2.png"]', 1),
            (11, 'Onopo Şarj Aleti', 'sarj', '[]', 1),
            (12, 'Eski Ürün', 'eski', NULL, 0);
        INSERT INTO reviews (id, product_id, user_id, rating, comment, created_at) VALUES
            (1, 10, 1, 5, 'Harika', '2026-09-01 10:00:00'),
            (3, 11, 2, 4, NULL, '2026-09-02 10:00:00'),
            (5, 10, 2, 3, 'Fena değil', '2026-09-03 10:00:00');
    `)
    return db
}

function migrate(db) {
    db.raw.exec(MIGRATION)
    or.resetGuestReviewsMemo()
}

let nextOrderId = 100
/** One order with its items; returns the id. */
function addOrder(db, { status = 'completed', days = 10, email = 'guest@example.test', userId = null, items = [10], name = 'Ayşe Nur Yılmaz', payment = 'paid' } = {}) {
    const id = nextOrderId++
    db.raw.prepare('INSERT INTO orders (id, user_id, guest_email, status, total_amount, shipping_address, created_at, payment_status) VALUES (?, ?, ?, ?, 100, ?, ?, ?)')
        .run(id, userId, email, status, JSON.stringify({ fullName: name, phone: '0', city: 'X' }), ago(days), payment)
    for (const p of items) db.raw.prepare('INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, 1, 10)').run(id, p)
    return id
}

// ---------------------------------------------------------------------------------------------
// Signed link
// ---------------------------------------------------------------------------------------------

test('link: sign → verify gives the order id and the 60-day expiry', async () => {
    const token = await link.signReviewToken(123, SECRET, NOW)
    assert.match(token, /^123\.\d{10}\.[A-Za-z0-9_-]{43}$/)
    const r = await link.verifyReviewToken(token, SECRET, new Date(NOW.getTime() + 59 * DAY))
    assert.equal(r.ok, true)
    assert.equal(r.orderId, 123)
    assert.equal(r.expiresAt.getTime(), NOW.getTime() + 60 * DAY)
    assert.equal(link.reviewLinkUrl(token), `https://onopostore.com/degerlendir/?t=${token}`)
})

test('link: expired after 60 days', async () => {
    const token = await link.signReviewToken(5, SECRET, NOW)
    assert.deepEqual(await link.verifyReviewToken(token, SECRET, new Date(NOW.getTime() + 60 * DAY + 1000)), { ok: false, reason: 'expired' })
})

test('link: tampered order id, expiry or signature, another secret and garbage are invalid', async () => {
    const token = await link.signReviewToken(7, SECRET, NOW)
    const [id, exp, sig] = token.split('.')
    const invalid = { ok: false, reason: 'invalid' }
    assert.deepEqual(await link.verifyReviewToken(`8.${exp}.${sig}`, SECRET, NOW), invalid)
    assert.deepEqual(await link.verifyReviewToken(`${id}.${Number(exp) + 86400}.${sig}`, SECRET, NOW), invalid)
    const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A')
    assert.deepEqual(await link.verifyReviewToken(`${id}.${exp}.${flipped}`, SECRET, NOW), invalid)
    assert.deepEqual(await link.verifyReviewToken(token, `${SECRET}-other`, NOW), invalid)
    for (const bad of ['', 'abc', null, 42, `${token}.x`, `${id}.${exp}`]) {
        assert.deepEqual(await link.verifyReviewToken(bad, SECRET, NOW), invalid)
    }
    // An expired AND forged token never says "expired"
    assert.deepEqual(await link.verifyReviewToken(`8.${exp}.${sig}`, SECRET, new Date(NOW.getTime() + 90 * DAY)), invalid)
})

test('link: fails closed without a real secret (missing, short or the public fallback)', async () => {
    for (const s of [undefined, '', 'short', 'super-secret-key-change-this']) {
        await assert.rejects(link.signReviewToken(1, s, NOW))
        assert.deepEqual(await link.verifyReviewToken('1.1800000000.' + 'A'.repeat(43), s, NOW), { ok: false, reason: 'no_secret' })
    }
})

test('link: another purpose label cannot be replayed (a token from the same secret for other data fails)', async () => {
    // Same HMAC key, but data without the purpose label: must not verify
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`${SECRET}:review-link`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const exp = Math.floor(NOW.getTime() / 1000) + 1000
    const sig = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`9|${exp}`))).toString('base64url')
    assert.deepEqual(await link.verifyReviewToken(`9.${exp}.${sig}`, SECRET, NOW), { ok: false, reason: 'invalid' })
})

// ---------------------------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------------------------

test('migration: keeps every row and id, user_id becomes nullable, new columns and review_requests exist', () => {
    const db = oldSchemaDb()
    migrate(db)
    const rows = db.raw.prepare('SELECT id, product_id, user_id, rating, comment, created_at, order_id, reviewer_name, verified FROM reviews ORDER BY id').all().map(r => ({ ...r }))
    assert.deepEqual(rows, [
        { id: 1, product_id: 10, user_id: 1, rating: 5, comment: 'Harika', created_at: '2026-09-01 10:00:00', order_id: null, reviewer_name: null, verified: 0 },
        { id: 3, product_id: 11, user_id: 2, rating: 4, comment: null, created_at: '2026-09-02 10:00:00', order_id: null, reviewer_name: null, verified: 0 },
        { id: 5, product_id: 10, user_id: 2, rating: 3, comment: 'Fena değil', created_at: '2026-09-03 10:00:00', order_id: null, reviewer_name: null, verified: 0 },
    ])
    // AUTOINCREMENT continues after the highest copied id
    db.raw.prepare("INSERT INTO reviews (product_id, user_id, rating, order_id, reviewer_name, verified) VALUES (11, NULL, 5, 900, 'Ali V.', 1)").run()
    assert.equal(db.raw.prepare('SELECT MAX(id) AS m FROM reviews').get().m, 6)
    // One review per product per order; NULL order ids are not limited
    assert.throws(() => db.raw.prepare("INSERT INTO reviews (product_id, rating, order_id, verified) VALUES (11, 4, 900, 1)").run(), /UNIQUE/)
    db.raw.prepare('INSERT INTO reviews (product_id, user_id, rating) VALUES (11, 1, 2)').run()
    db.raw.prepare('INSERT INTO reviews (product_id, user_id, rating) VALUES (11, 1, 2)').run()
    // Foreign keys still hold
    assert.throws(() => db.raw.prepare('INSERT INTO reviews (product_id, user_id, rating) VALUES (999, NULL, 5)').run(), /FOREIGN KEY/)
    assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'review_requests'").get().n, 1)
    assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name IN ('reviews_new', '_guard_guest_reviews')").get().n, 0)
    // Cascade from users is kept
    db.raw.prepare('DELETE FROM reviews WHERE user_id = 2').run()
    db.raw.prepare('DELETE FROM users WHERE id = 2').run()
})

test('migration: a second run stops at the guard before touching anything', () => {
    const db = oldSchemaDb()
    migrate(db)
    db.raw.prepare("UPDATE reviews SET order_id = 77, reviewer_name = 'Ayşe K.', verified = 1 WHERE id = 3").run()
    // D1 runs a --file atomically; here a transaction stands in for that
    assert.throws(() => db.raw.exec(`BEGIN; ${MIGRATION}; COMMIT;`), /guest_reviews_already_applied/)
    db.raw.exec('ROLLBACK')
    const row = db.raw.prepare('SELECT order_id, reviewer_name, verified FROM reviews WHERE id = 3').get()
    assert.deepEqual({ ...row }, { order_id: 77, reviewer_name: 'Ayşe K.', verified: 1 })
    assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM reviews').get().n, 3)
})

// ---------------------------------------------------------------------------------------------
// Before the migration: nothing crashes
// ---------------------------------------------------------------------------------------------

test('before the migration: product reviews still load, the job logs and skips, stats say not ready', async () => {
    const db = oldSchemaDb()
    or.resetGuestReviewsMemo()
    const reviews = await or.listProductReviews(db, 10)
    assert.deepEqual(reviews.map(r => [r.id, r.author, r.verified]), [[5, 'Mehmet D.', false], [1, 'Ayşe K.', false]])
    assert.equal(await or.guestReviewsReady(db), false)
    const logs = []
    let sends = 0
    const r = await or.sendReviewRequests(db, { now: NOW, linkFor: async () => 'x', send: async () => { sends++; return { ok: true } }, log: async e => { logs.push(e) } })
    assert.equal(r.stopped, 'not_ready')
    assert.equal(sends, 0)
    assert.equal(logs.length, 1)
    assert.equal(logs[0].source, 'reviews')
    const stats = await or.reviewRequestStats(db, NOW)
    assert.equal(stats.ready, false)
})

// ---------------------------------------------------------------------------------------------
// Order selection for the request e-mail
// ---------------------------------------------------------------------------------------------

test('selection: completed or shipped ≥ 7 days, placed 5–45 days ago, e-mail, not asked, not failed, products exist', async () => {
    const db = oldSchemaDb()
    migrate(db)
    const yes = [
        addOrder(db, { status: 'completed', days: 5.5 }),
        addOrder(db, { status: 'completed', days: 44 }),
        addOrder(db, { status: 'shipped', days: 8 }),
        addOrder(db, { status: 'completed', days: 10, email: '', userId: 1 }), // account e-mail
    ]
    addOrder(db, { status: 'completed', days: 4 }) // too new
    addOrder(db, { status: 'completed', days: 46 }) // too old
    addOrder(db, { status: 'shipped', days: 6 }) // shipped but not 7 days yet
    addOrder(db, { status: 'approved', days: 20 })
    addOrder(db, { status: 'processing', days: 20 })
    addOrder(db, { status: 'cancelled', days: 20 })
    addOrder(db, { status: 'pending', days: 20 })
    addOrder(db, { status: 'completed', days: 20, payment: 'failed' })
    addOrder(db, { status: 'completed', days: 20, email: '  ' }) // no address at all
    addOrder(db, { status: 'completed', days: 20, items: [] }) // nothing to review
    const asked = addOrder(db, { status: 'completed', days: 20 })
    db.raw.prepare("INSERT INTO review_requests (order_id, sent_at, status) VALUES (?, ?, 'sent')").run(asked, NOW.toISOString())

    const c = await or.selectReviewRequestCandidates(db, NOW)
    assert.deepEqual(c.map(x => x.id).sort(), [...yes].sort())
    // Oldest first
    assert.equal(c[0].id, yes[1])
    assert.equal(c.find(x => x.id === yes[3]).email, 'a@example.test')
    assert.equal((await or.selectReviewRequestCandidates(db, NOW, 2)).length, 2)
})

test('job: one e-mail per order with the link and the products, recorded once, no address stored', async () => {
    const db = oldSchemaDb()
    migrate(db)
    const a = addOrder(db, { days: 10, items: [10, 11, 10, 12] })
    const b = addOrder(db, { days: 12, name: 'MEHMET' })
    const sent = []
    const deps = {
        now: NOW,
        sleep: async () => {},
        linkFor: async id => link.reviewLinkUrl(await link.signReviewToken(id, SECRET, NOW)),
        send: async (to, mail) => { sent.push({ to, mail }); return { ok: true } },
        log: async () => {},
    }
    const r = await or.sendReviewRequests(db, deps)
    assert.deepEqual({ stopped: r.stopped, sent: r.sent, failed: r.failed }, { stopped: 'done', sent: 2, failed: 0 })
    assert.deepEqual(sent.map(s => s.mail.orderId), [b, a])
    const mailA = sent.find(s => s.mail.orderId === a).mail
    assert.equal(mailA.firstName, 'Ayşe')
    assert.equal(sent.find(s => s.mail.orderId === b).mail.firstName, 'Mehmet')
    assert.deepEqual(mailA.items.map(i => i.name), ['Onopo Kablo', 'Onopo Şarj Aleti', 'Eski Ürün'])
    assert.equal(mailA.items[0].imageUrl, 'https://images.onopostore.com/k.png')
    assert.equal(mailA.items[0].url, 'https://onopostore.com/kablo/')
    assert.equal(mailA.items[2].url, null) // inactive product: no link
    const check = await link.verifyReviewToken(new URL(mailA.reviewUrl).searchParams.get('t'), SECRET, NOW)
    assert.equal(check.ok && check.orderId, a)

    const rows = db.raw.prepare('SELECT * FROM review_requests ORDER BY order_id').all().map(x => ({ ...x }))
    assert.deepEqual(rows.map(x => [x.order_id, x.status]), [[a, 'sent'], [b, 'sent']])
    assert.ok(!JSON.stringify(rows).includes('@'))

    // Next day: nothing again
    const again = await or.sendReviewRequests(db, deps)
    assert.equal(again.sent, 0)
    assert.equal(sent.length, 2)

    const stats = await or.reviewRequestStats(db, NOW)
    assert.deepEqual({ ready: stats.ready, enabled: stats.enabled, sent: stats.sent, failed: stats.failed, reviews: stats.reviews }, { ready: true, enabled: true, sent: 2, failed: 0, reviews: 0 })
})

test('job: a rejected address is recorded as failed; an outage releases the order and stops the run', async () => {
    const db = oldSchemaDb()
    migrate(db)
    const bad = addOrder(db, { days: 30, email: 'bad@example.test' })
    const later = addOrder(db, { days: 20 })
    const third = addOrder(db, { days: 10 })
    const logs = []
    let calls = 0
    const r = await or.sendReviewRequests(db, {
        now: NOW,
        sleep: async () => {},
        linkFor: async id => `https://onopostore.com/degerlendir/?t=${id}`,
        send: async (to, mail) => {
            calls++
            if (mail.orderId === bad) return { ok: false, permanent: true, error: `validation_error: Invalid to field ${to}` }
            return { ok: false, permanent: false, error: 'rate_limit_exceeded' }
        },
        log: async e => { logs.push(e) },
    })
    assert.equal(r.stopped, 'send_failed')
    assert.equal(r.failed, 1)
    assert.equal(calls, 2) // the third order was not tried
    const rows = db.raw.prepare('SELECT order_id, status, error FROM review_requests').all().map(x => ({ ...x }))
    assert.deepEqual(rows.map(x => [x.order_id, x.status]), [[bad, 'failed']])
    assert.ok(!rows[0].error.includes('@'), 'no address in the stored error')
    assert.ok(logs.every(l => !String(l.detail ?? '').includes('@')))
    // The released orders come back next time
    const c = await or.selectReviewRequestCandidates(db, NOW)
    assert.deepEqual(c.map(x => x.id), [later, third])
})

test('job: the admin switch turns it off; missing setting means on', async () => {
    const db = oldSchemaDb()
    migrate(db)
    addOrder(db, { days: 10 })
    assert.equal(await or.isReviewRequestsEnabled(db), true)
    db.raw.prepare("INSERT INTO site_settings (key, value) VALUES ('review_requests_enabled', '0')").run()
    let sends = 0
    const r = await or.sendReviewRequests(db, { now: NOW, linkFor: async () => 'x', send: async () => { sends++; return { ok: true } }, log: async () => {} })
    assert.equal(r.stopped, 'disabled')
    assert.equal(sends, 0)
    assert.equal((await or.reviewRequestStats(db, NOW)).enabled, false)
})

// ---------------------------------------------------------------------------------------------
// Reviews through the link
// ---------------------------------------------------------------------------------------------

test('link reviews: stored as verified guest reviews with the masked shipping name; duplicates rejected', async () => {
    const db = oldSchemaDb()
    migrate(db)
    const id = addOrder(db, { days: 10, items: [10, 11], name: 'ayşe nur yılmaz' })
    const order = await or.loadOrderForReview(db, id)
    assert.equal(order.reviewable, true)
    assert.equal(order.reviewerName, 'Ayşe Y.')
    assert.deepEqual(order.items.map(i => [i.product_id, i.reviewed]), [[10, false], [11, false]])

    const first = await or.submitOrderReviews(db, id, [{ productId: 10, rating: 5, comment: 'Çok iyi' }])
    assert.deepEqual(first, { ok: true, created: [10], duplicates: [] })
    const row = { ...db.raw.prepare('SELECT product_id, user_id, rating, comment, order_id, reviewer_name, verified FROM reviews WHERE order_id = ?').get(id) }
    assert.deepEqual(row, { product_id: 10, user_id: null, rating: 5, comment: 'Çok iyi', order_id: id, reviewer_name: 'Ayşe Y.', verified: 1 })

    // Same product again → 409; with a new one → only the new one
    const dup = await or.submitOrderReviews(db, id, [{ productId: 10, rating: 1, comment: '' }])
    assert.equal(dup.ok, false)
    assert.equal(dup.status, 409)
    const mixed = await or.submitOrderReviews(db, id, [{ productId: 10, rating: 1, comment: '' }, { productId: 11, rating: 4, comment: '' }])
    assert.deepEqual(mixed, { ok: true, created: [11], duplicates: [10] })
    assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM reviews WHERE order_id = ?').get(id).n, 2)
    assert.deepEqual((await or.loadOrderForReview(db, id)).items.map(i => i.reviewed), [true, true])

    // Public list: masked name, verified flag, nothing else
    const list = await or.listProductReviews(db, 10)
    const mine = list.find(r => r.verified)
    assert.equal(mine.author, 'Ayşe Y.')
    assert.deepEqual(Object.keys(mine).sort(), ['author', 'comment', 'created_at', 'id', 'product_id', 'rating', 'verified'])
    assert.equal((await or.reviewRequestStats(db, NOW)).reviews, 2)
})

test('link reviews: product not in the order, cancelled order, missing order, account duplicates', async () => {
    const db = oldSchemaDb()
    migrate(db)
    const id = addOrder(db, { days: 10, items: [10] })
    assert.deepEqual(await or.submitOrderReviews(db, id, [{ productId: 11, rating: 5, comment: '' }]), { ok: false, status: 400, error: 'Bu ürün siparişinde yok.' })
    const cancelled = addOrder(db, { status: 'cancelled', items: [10] })
    assert.equal((await or.submitOrderReviews(db, cancelled, [{ productId: 10, rating: 5, comment: '' }])).status, 403)
    assert.equal((await or.loadOrderForReview(db, cancelled)).reviewable, false)
    assert.equal((await or.submitOrderReviews(db, 999999, [{ productId: 10, rating: 5, comment: '' }])).status, 404)
    assert.equal(await or.loadOrderForReview(db, 999999), null)
    // Account order: the account (user 1) already reviewed product 10 through the normal form
    const acc = addOrder(db, { userId: 1, items: [10, 11] })
    const r = await or.submitOrderReviews(db, acc, [{ productId: 10, rating: 2, comment: '' }, { productId: 11, rating: 5, comment: '' }])
    assert.deepEqual(r, { ok: true, created: [11], duplicates: [10] })
    assert.equal(db.raw.prepare('SELECT user_id FROM reviews WHERE order_id = ? AND product_id = 11').get(acc).user_id, 1)
})

test('link reviews: input validation (ratings 1–5 whole numbers, comment length, each product once)', () => {
    const ok = or.parseReviewInputs({ reviews: [{ productId: 10, rating: 5, comment: '  güzel\r\n\r\n\r\n\r\nürün\u0000 ' }, { productId: '11', rating: 1 }] })
    assert.deepEqual(ok, { ok: true, reviews: [{ productId: 10, rating: 5, comment: 'güzel\n\nürün' }, { productId: 11, rating: 1, comment: '' }] })
    for (const body of [
        {},
        { reviews: [] },
        { reviews: [{ productId: 10, rating: 0 }] },
        { reviews: [{ productId: 10, rating: 6 }] },
        { reviews: [{ productId: 10, rating: 4.5 }] },
        { reviews: [{ productId: -1, rating: 4 }] },
        { reviews: [{ productId: 10, rating: 4 }, { productId: 10, rating: 3 }] },
        { reviews: [{ productId: 10, rating: 4, comment: 'x'.repeat(1001) }] },
        { reviews: [{ productId: 10, rating: 4, comment: { a: 1 } }] },
    ]) {
        assert.equal(or.parseReviewInputs(body).ok, false, JSON.stringify(body).slice(0, 80))
    }
    assert.equal(or.parseReviewInputs({ reviews: [{ productId: 10, rating: 4, comment: 'x'.repeat(1000) }] }).ok, true)
})

test('names: masked display name and e-mail errors without addresses', () => {
    assert.equal(or.maskReviewerName('ÜNAL MERT'), 'Ünal M.')
    assert.equal(or.maskReviewerName(''), 'Onopo müşterisi')
    assert.equal(or.maskReviewerName('ayşe'), 'Ayşe')
    assert.equal(or.maskReviewerName('McKenzie İnce'), 'McKenzie İ.')
    assert.equal(or.reviewerNameFromShipping('{"fullName":"Zeynep Ak Çelik"}'), 'Zeynep Ç.')
    assert.equal(or.reviewerNameFromShipping('not json'), 'Onopo müşterisi')
    assert.equal(or.firstNameFromShipping(null), '')
    assert.equal(or.sanitizeMailError('Invalid `to` field: someone@example.com is bad'), 'Invalid `to` field: <e-posta> is bad')
})
