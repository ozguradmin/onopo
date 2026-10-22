// Unit tests for the store statistics (lib/analytics.ts, lib/analytics-db.ts) and the checkout phone check
// (lib/phone.ts). The D1 part runs its real SQL on node:sqlite through a tiny D1-shaped adapter.
// Run: node --test scripts/analytics.test.mjs   (Node 23.6+ strips the TypeScript types itself)
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

// The app imports '@/…' and extensionless relative paths ('./analytics'); resolve them to the .ts files.
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

const A = await import('../lib/analytics.ts')
const DB = await import('../lib/analytics-db.ts')
const { isValidTurkishPhone } = await import('../lib/phone.ts')

// ---- D1 adapter over node:sqlite -----------------------------------------------------------------

function d1(sqlite) {
    const stmt = (sql, values = []) => ({
        bind: (...v) => stmt(sql, v.map(x => (x === undefined ? null : x))),
        run: async () => sqlite.prepare(sql).run(...values),
        all: async () => ({ results: sqlite.prepare(sql).all(...values) }),
        first: async () => sqlite.prepare(sql).get(...values) ?? null,
    })
    return {
        prepare: sql => stmt(sql),
        batch: async list => Promise.all(list.map(s => s.all())),
    }
}

function freshDb() {
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec(`
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, slug TEXT, is_active INTEGER DEFAULT 1, stock INTEGER DEFAULT 1);
CREATE TABLE analytics (id INTEGER PRIMARY KEY AUTOINCREMENT, page TEXT, product_id INTEGER, user_agent TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT, payment_status TEXT, total_amount REAL, shipping_address TEXT, created_at DATETIME);
INSERT INTO products (id, name, slug) VALUES (1, 'Şarj Aleti 67W', 'onopo-67w-sarj'), (2, 'Kablo 2m', 'onopo-kablo-2m'), (3, 'Powerbank', 'onopo-powerbank');
`)
    DB.resetAnalyticsMemo()
    return { sqlite, db: d1(sqlite) }
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'

// ---- Days ----------------------------------------------------------------------------------------

test('Istanbul days: UTC+3 boundaries and the old table conversion', () => {
    assert.equal(A.istanbulDay(new Date('2026-10-21T20:59:59Z')), '2026-10-21')
    assert.equal(A.istanbulDay(new Date('2026-10-21T21:00:00Z')), '2026-10-22')
    assert.equal(A.istanbulDay(new Date('2026-10-22T10:00:00Z'), 1), '2026-10-21')
    assert.equal(A.istanbulDayStartUtc('2026-10-22'), '2026-10-21 21:00:00')
    assert.equal(A.addDays('2026-03-01', -1), '2026-02-28')
    assert.equal(A.addDays('2026-12-31', 1), '2027-01-01')
    assert.deepEqual(A.daysBetween('2026-01-30', '2026-02-02'), ['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'])
    assert.deepEqual(A.daysBetween('2026-02-02', '2026-02-01'), [])
})

test('dashboard ranges are inclusive and know when they cross a month', () => {
    const r = Object.fromEntries(A.dashboardRanges('2026-10-03').map(x => [x.key, x]))
    assert.deepEqual([r.today.from, r.today.to], ['2026-10-03', '2026-10-03'])
    assert.deepEqual([r.yesterday.from, r.yesterday.to], ['2026-10-02', '2026-10-02'])
    assert.deepEqual([r.d7.from, r.d7.to], ['2026-09-27', '2026-10-03'])
    assert.deepEqual([r.d30.from, r.d30.to], ['2026-09-04', '2026-10-03'])
    assert.deepEqual([r.month.from, r.month.to], ['2026-10-01', '2026-10-03'])
    assert.equal(A.crossesMonth(r.d7.from, r.d7.to), true)
    assert.equal(A.crossesMonth(r.month.from, r.month.to), false)
})

test('mergeDaily: old table before the first full day of page_views, page_views after, zeros for gaps', () => {
    const legacy = [{ day: '2026-10-01', views: 5 }, { day: '2026-10-02', views: 7 }, { day: '2026-10-03', views: 9 }]
    const current = [{ day: '2026-10-02', views: 3, visitors: 2 }, { day: '2026-10-03', views: 8, visitors: 4 }]
    const daily = A.mergeDaily('2026-09-30', '2026-10-04', legacy, current, '2026-10-03')
    assert.deepEqual(daily, [
        { day: '2026-09-30', views: 0, visitors: null },
        { day: '2026-10-01', views: 5, visitors: null },
        { day: '2026-10-02', views: 7, visitors: 2 }, // deploy day: complete in the old table
        { day: '2026-10-03', views: 8, visitors: 4 },
        { day: '2026-10-04', views: 0, visitors: 0 },
    ])
    assert.equal(A.sumViews(daily, '2026-10-01', '2026-10-03'), 20)
    // Nothing new yet: everything from the old table
    assert.equal(A.sumViews(A.mergeDaily('2026-10-01', '2026-10-03', legacy, [], null), '2026-10-01', '2026-10-03'), 21)
})

test('monthly visitor sums are flagged approximate only when two months have visitors', () => {
    assert.deepEqual(A.sumMonthlyVisitors([{ month: '2026-09', visitors: 4 }, { month: '2026-10', visitors: 6 }], '2026-09-27', '2026-10-03'), { visitors: 10, approx: true })
    assert.deepEqual(A.sumMonthlyVisitors([{ month: '2026-10', visitors: 6 }], '2026-09-27', '2026-10-03'), { visitors: 6, approx: false })
    assert.deepEqual(A.sumMonthlyVisitors([], '2026-10-01', '2026-10-03'), { visitors: 0, approx: false })
})

test('count maps add up and the top list is stable', () => {
    const m = A.addCounts(new Map([['/a/', 2], ['/b/', 5]]), new Map([['/a/', 3], ['/c/', 5]]))
    assert.deepEqual(A.topEntries(m, 2), [{ key: '/a/', views: 5 }, { key: '/b/', views: 5 }])
    assert.deepEqual(A.topEntries(new Map([[2, 0]]), 5), [])
})

// ---- Paths and request classification -----------------------------------------------------------

test('paths: normalised, product slugs recognised, static routes are not products', () => {
    assert.equal(A.normalizePath('/onopo-67w-sarj'), '/onopo-67w-sarj/')
    assert.equal(A.normalizePath('/products/?q=kablo#top'), '/products/')
    assert.equal(A.normalizePath(undefined), '/')
    assert.equal(A.productSlugOf('/onopo-67w-sarj/'), 'onopo-67w-sarj')
    assert.equal(A.productSlugOf('/'), null)
    assert.equal(A.productSlugOf('/products/'), null)
    assert.equal(A.productSlugOf('/odeme/'), null)
    assert.equal(A.productSlugOf('/kategori/kablolar/'), null)
    assert.equal(A.productSlugOf('/sitemap.xml/'), null)
})

test('device type from the user agent', () => {
    assert.equal(A.deviceTypeOf(IPHONE), 'phone')
    assert.equal(A.deviceTypeOf(ANDROID), 'phone')
    assert.equal(A.deviceTypeOf('Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'), 'tablet')
    assert.equal(A.deviceTypeOf('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)'), 'tablet')
    assert.equal(A.deviceTypeOf(DESKTOP), 'desktop')
    assert.equal(A.deviceTypeOf(''), 'desktop')
})

test('traffic source: only the landing view carries the referrer', () => {
    assert.equal(A.referrerTypeOf('https://www.google.com/', true), 'google')
    assert.equal(A.referrerTypeOf('https://www.google.com.tr/search?q=x', true), 'google')
    assert.equal(A.referrerTypeOf('https://l.instagram.com/?u=x', true), 'social')
    assert.equal(A.referrerTypeOf('https://t.co/abc', true), 'social')
    assert.equal(A.referrerTypeOf('https://www.akakce.com/x', true), 'other')
    assert.equal(A.referrerTypeOf('', true), 'direct')
    assert.equal(A.referrerTypeOf(null, true), 'direct')
    assert.equal(A.referrerTypeOf('https://onopostore.com/products/', true), 'internal')
    assert.equal(A.referrerTypeOf('https://www.onopostore.com/', true), 'internal')
    assert.equal(A.referrerTypeOf('https://www.google.com/', false), 'internal')
    assert.equal(A.referrerTypeOf('not a url', true), 'other')
})

test('visitor hash: 16 hex, same input same hash, another month (salt) another hash', async () => {
    const a = await A.visitorHash('salt-1', '203.0.113.7', IPHONE)
    assert.match(a, /^[0-9a-f]{16}$/)
    assert.equal(await A.visitorHash('salt-1', '203.0.113.7', IPHONE), a)
    assert.notEqual(await A.visitorHash('salt-2', '203.0.113.7', IPHONE), a)
    assert.notEqual(await A.visitorHash('salt-1', '203.0.113.8', IPHONE), a)
    assert.notEqual(await A.visitorHash('salt-1', '203.0.113.7', DESKTOP), a)
    assert.match(A.newSalt(), /^[0-9a-f]{64}$/)
    assert.notEqual(A.newSalt(), A.newSalt())
})

// ---- Home rows ------------------------------------------------------------------------------------

test('most viewed: viewed products first by views, then the pool order fills up; stable', () => {
    const pool = [{ id: 9 }, { id: 8 }, { id: 7 }, { id: 6 }, { id: 5 }]
    const views = new Map([[7, 10], [5, 10], [6, 30], [42, 99]]) // 42 is not in the pool (sold out)
    assert.deepEqual(A.rankMostViewed(pool, views, 4).map(p => p.id), [6, 7, 5, 9])
    assert.deepEqual(A.rankMostViewed(pool, new Map(), 3).map(p => p.id), [9, 8, 7])
    assert.deepEqual(A.rankMostViewed(pool, views, 4), A.rankMostViewed(pool, views, 4))
})

test('product sections keep a stable order; manual follows the admin, random only when chosen', () => {
    const list = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
    assert.deepEqual(A.orderSectionProducts(list, undefined, false).map(p => p.id), [1, 2, 3, 4])
    assert.deepEqual(A.orderSectionProducts(list, [3, '1', 99, 3], false).map(p => p.id), [3, 1])
    let seed = 0
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
    const shuffled = A.orderSectionProducts(list, undefined, true, rnd).map(p => p.id)
    assert.deepEqual([...shuffled].sort(), [1, 2, 3, 4])
})

// ---- Checkout phone -----------------------------------------------------------------------------

test('checkout phone: mobiles, landlines and 08xx business numbers', () => {
    for (const ok of ['0500 000 00 00', '05000000000', '+90 500 000 00 00', '0090 500 000 00 00', '(0212) 000 00 00',
        '0850 000 00 00', '+90 850 000 00 00', '0800-000-00-00', '8500000000', '‪0500 000 00 00‬']) {
        assert.equal(isValidTurkishPhone(ok), true, ok)
    }
    for (const bad of ['0600 000 00 00', '0900 000 00 00', '0100 000 00 00', '0500 000 00', '0500 000 00 000', 'abc', '']) {
        assert.equal(isValidTurkishPhone(bad), false, bad)
    }
})

// ---- D1: recording and the dashboard numbers -------------------------------------------------------

async function view(db, at, { path = '/', ip = '203.0.113.1', ua = IPHONE, landing = false, referrer = '', lang = 'tr-TR' } = {}) {
    await DB.recordPageView(db, { path, landing, referrer, userAgent: ua, ip, acceptLanguage: lang, now: new Date(at) })
}

test('recording: no IP stored, product id from the slug, salts rotate monthly', async () => {
    const { sqlite, db } = freshDb()
    await view(db, '2026-09-30T10:00:00Z', { path: '/onopo-67w-sarj/', landing: true, referrer: 'https://www.google.com/' })
    const rows = sqlite.prepare('SELECT * FROM page_views').all()
    assert.equal(rows.length, 1)
    assert.equal(rows[0].day, '2026-09-30')
    assert.equal(rows[0].product_id, 1)
    assert.equal(rows[0].device_type, 'phone')
    assert.equal(rows[0].referrer_type, 'google')
    assert.equal(rows[0].is_bot, 0)
    assert.ok(!JSON.stringify(rows).includes('203.0.113.1'), 'raw IP must never be stored')
    assert.deepEqual(sqlite.prepare('SELECT month FROM analytics_salts').all().map(r => r.month), ['2026-09'])

    // Same person next month: new salt, old salt deleted, different hash
    await view(db, '2026-10-01T10:00:00Z')
    assert.deepEqual(sqlite.prepare('SELECT month FROM analytics_salts').all().map(r => r.month), ['2026-10'])
    const hashes = sqlite.prepare('SELECT visitor FROM page_views ORDER BY id').all().map(r => r.visitor)
    assert.notEqual(hashes[0], hashes[1])

    // No Accept-Language (headless crawler): stored as a bot and never counted
    await view(db, '2026-10-01T11:00:00Z', { lang: null })
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM page_views WHERE is_bot = 1').get().n, 1)
})

test('dashboard: views, distinct visitors, old-table history, top products, devices, sources, AI and orders', async () => {
    const { sqlite, db } = freshDb()
    // Old table: Oct 1 and 2 (Istanbul). 2026-10-01 00:30 TR = 2026-09-30 21:30 UTC belongs to Oct 1.
    const old = sqlite.prepare('INSERT INTO analytics (page, created_at) VALUES (?, ?)')
    old.run('/', '2026-09-30 21:30:00')
    old.run('/onopo-kablo-2m/', '2026-10-01 10:00:00')
    old.run('/onopo-kablo-2m/', '2026-10-02 10:00:00')
    old.run('/onopo-67w-sarj/', '2026-10-02 11:00:00')
    old.run('/', '2026-09-30 20:59:00') // Sep 30 23:59 TR

    // page_views starts on Oct 2 (partial: the old table also has that day), so Oct 3 is the first full day
    await view(db, '2026-10-02T12:00:00Z', { path: '/', ip: '198.51.100.1', landing: true })
    // Oct 3: A (iPhone) 3 views, B (desktop) 2 views, C (Android) 1 bot-free view; Oct 4: A again
    await view(db, '2026-10-03T08:00:00Z', { ip: '198.51.100.1', landing: true, referrer: 'https://www.google.com.tr/' })
    await view(db, '2026-10-03T08:01:00Z', { ip: '198.51.100.1', path: '/onopo-67w-sarj/' })
    await view(db, '2026-10-03T08:02:00Z', { ip: '198.51.100.1', path: '/onopo-67w-sarj/' })
    await view(db, '2026-10-03T09:00:00Z', { ip: '198.51.100.2', ua: DESKTOP, landing: true, path: '/onopo-powerbank/' })
    await view(db, '2026-10-03T09:01:00Z', { ip: '198.51.100.2', ua: DESKTOP, path: '/products/' })
    await view(db, '2026-10-03T10:00:00Z', { ip: '198.51.100.3', ua: ANDROID, landing: true, referrer: 'https://l.instagram.com/' })
    await view(db, '2026-10-03T10:30:00Z', { ip: '198.51.100.9', lang: null, path: '/onopo-powerbank/' }) // bot
    await view(db, '2026-10-04T08:00:00Z', { ip: '198.51.100.1', landing: true, path: '/onopo-67w-sarj/' })

    sqlite.exec(`
CREATE TABLE ai_chat_events (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT, kind TEXT, conv_hash TEXT, turn INTEGER, outcome TEXT, handoff TEXT, products TEXT);
INSERT INTO ai_chat_events (day, kind, conv_hash, turn, outcome, handoff) VALUES
 ('2026-10-04', 'turn', 'c1', 1, 'ok', NULL), ('2026-10-04', 'turn', 'c1', 2, 'ok', 'order_status'),
 ('2026-10-03', 'turn', 'c2', 1, 'ok', NULL), ('2026-09-01', 'turn', 'c3', 1, 'ok', NULL);
INSERT INTO ai_chat_events (day, kind, conv_hash, outcome, handoff) VALUES ('2026-10-04', 'ui', 'c1', 'wa_click', 'order_status');
INSERT INTO orders (status, payment_status, total_amount, shipping_address, created_at) VALUES
 ('approved', 'paid', 100, '{"provider":"paytr"}', '2026-10-03 12:00:00'),
 ('pending', 'pending', 50, '{"provider":"paytr"}', '2026-10-03 12:00:00'),
 ('pending', 'pending', 70, '{"provider":"whatsapp"}', '2026-10-04 08:00:00'),
 ('cancelled', 'failed', 90, '{}', '2026-10-04 08:00:00');
`)

    const s = await DB.loadStats(db, { now: new Date('2026-10-04T15:00:00Z'), days: 7 })
    assert.equal(s.today, '2026-10-04')
    assert.equal(s.since, '2026-10-02')
    const r = Object.fromEntries(s.ranges.map(x => [x.key, x]))

    assert.equal(r.today.views, 1)
    assert.equal(r.today.visitors, 1)
    assert.equal(r.yesterday.views, 6) // bot row excluded
    assert.equal(r.yesterday.visitors, 3)
    // Oct 1: 2 (old), Oct 2: 2 (old, deploy day), Oct 3: 6, Oct 4: 1; Sep 30 from the old table: 1
    assert.equal(r.month.views, 11)
    assert.equal(r.month.visitors, 3) // A, B, C distinct across the month
    assert.equal(r.month.approx, false)
    assert.equal(r.month.partial, true) // counting began on Oct 2
    assert.equal(r.d7.views, 12)
    assert.equal(r.d7.approx, false) // only October had visitors
    assert.equal(r.today.orders, 1)
    assert.equal(r.today.revenue, 70)
    assert.equal(r.month.orders, 2) // the unpaid PayTR and the cancelled orders are left out
    assert.equal(r.month.revenue, 170)

    const daily = Object.fromEntries(s.daily.map(d => [d.day, d]))
    assert.equal(s.daily.length, 30)
    assert.deepEqual(daily['2026-10-01'], { day: '2026-10-01', views: 2, visitors: null })
    assert.deepEqual(daily['2026-10-03'], { day: '2026-10-03', views: 6, visitors: 3 })

    // Top products over 7 days: 67W = 1 (old, Oct 2) + 2 (Oct 3) + 1 (Oct 4); kablo = 2 (old); powerbank = 1 (bot left out)
    assert.deepEqual(s.topProducts.map(p => [p.id, p.views, p.name]), [[1, 4, 'Şarj Aleti 67W'], [2, 2, 'Kablo 2m'], [3, 1, 'Powerbank']])
    // '/' = 2 (old: Sep 30, Oct 1) + 2 landings on Oct 3; ties are ordered by path
    assert.deepEqual(s.topPages.slice(0, 2), [{ path: '/', views: 4 }, { path: '/onopo-67w-sarj/', views: 4 }])

    const dev = Object.fromEntries(s.devices.map(d => [d.type, d]))
    assert.deepEqual([dev.phone.visitors, dev.desktop.visitors, dev.tablet.views], [2, 1, 0])
    const src = Object.fromEntries(s.sources.map(x => [x.type, x.visits]))
    // landing views: Oct 2 direct, Oct 3 google + direct (B) + social (C), Oct 4 direct
    assert.deepEqual(src, { direct: 3, google: 1, social: 1, other: 0 })

    assert.deepEqual(s.assistant.today, { conversations: 1, turns: 2, handoffs: 1, waClicks: 1 })
    assert.deepEqual(s.assistant.d7, { conversations: 2, turns: 3, handoffs: 1, waClicks: 1 })
    assert.deepEqual(s.assistant.d30, { conversations: 2, turns: 3, handoffs: 1, waClicks: 1 })
})

test('dashboard: a range across a month boundary sums monthly visitors and says so', async () => {
    const { db } = freshDb()
    await view(db, '2026-09-29T10:00:00Z', { ip: '198.51.100.1' })
    await view(db, '2026-09-30T10:00:00Z', { ip: '198.51.100.1' })
    await view(db, '2026-10-01T10:00:00Z', { ip: '198.51.100.1' })
    const s = await DB.loadStats(db, { now: new Date('2026-10-01T15:00:00Z') })
    const r = Object.fromEntries(s.ranges.map(x => [x.key, x]))
    assert.equal(r.d7.visitors, 2) // the same person, counted once per month
    assert.equal(r.d7.approx, true)
    assert.equal(r.today.visitors, 1)
    assert.equal(r.today.approx, false)
})

test('dashboard and home work without the new tables, the AI tables or any data', async () => {
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec("CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, slug TEXT, is_active INTEGER); CREATE TABLE analytics (id INTEGER PRIMARY KEY, page TEXT, product_id INTEGER, user_agent TEXT, created_at DATETIME); INSERT INTO products VALUES (1, 'X', 'x-urun', 1); INSERT INTO analytics (page, created_at) VALUES ('/x-urun/', '2026-10-03 10:00:00')")
    DB.resetAnalyticsMemo()
    const db = d1(sqlite)
    const views = await DB.recentProductViews(db, 30, new Date('2026-10-04T10:00:00Z'))
    assert.deepEqual([...views], [[1, 1]])
    const s = await DB.loadStats(db, { now: new Date('2026-10-04T10:00:00Z') })
    assert.equal(s.since, null)
    assert.equal(s.ranges.find(x => x.key === 'd7').views, 1)
    assert.equal(s.ranges.find(x => x.key === 'd7').visitors, null)
    assert.deepEqual(s.assistant.today, { conversations: 0, turns: 0, handoffs: 0, waClicks: 0 })
})
