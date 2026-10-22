/**
 * Store statistics: the D1 part. Takes the database as a parameter (no Next or Cloudflare imports), so
 * scripts/analytics.test.mjs runs the real SQL on node:sqlite. Pure helpers and the privacy design are in
 * lib/analytics.ts.
 *
 * Tables (also in schema.sql, which the deploy runs; created here too because the first page views can
 * arrive before that):
 *   page_views       one row per counted store page view (no IP, no user agent; visitor = monthly hash)
 *   analytics_salts  the random salt of each calendar month; past months are deleted when a month starts
 * The old `analytics` table (page, product_id, user_agent, created_at) is still written by the track route,
 * so nothing that reads it breaks; the stats use it for the days before page_views existed.
 */
import {
    addCounts,
    addDays,
    dashboardRanges,
    deviceTypeOf,
    istanbulDay,
    istanbulDayStartUtc,
    mergeDaily,
    monthOf,
    newSalt,
    normalizePath,
    productSlugOf,
    referrerTypeOf,
    sumMonthlyVisitors,
    sumViews,
    topEntries,
    visitorHash,
    type DayCount,
    type DeviceType,
    type RangeKey,
    type ReferrerType,
} from './analytics'

export interface D1Stmt {
    bind(...values: unknown[]): D1Stmt
    run(): Promise<unknown>
    all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>
    first<T = Record<string, unknown>>(): Promise<T | null>
}
export interface D1Lite {
    prepare(sql: string): D1Stmt
    batch?(statements: D1Stmt[]): Promise<Array<{ results?: unknown[] }>>
}

export const ANALYTICS_TABLES = [
    `CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY,
    day TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    path TEXT NOT NULL,
    product_id INTEGER,
    visitor TEXT NOT NULL,
    device_type TEXT NOT NULL,
    referrer_type TEXT NOT NULL,
    is_bot INTEGER NOT NULL DEFAULT 0
)`,
    'CREATE INDEX IF NOT EXISTS idx_page_views_day ON page_views(day, is_bot, visitor)',
    'CREATE INDEX IF NOT EXISTS idx_page_views_product ON page_views(product_id, day)',
    `CREATE TABLE IF NOT EXISTS analytics_salts (
    month TEXT PRIMARY KEY,
    salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
    'CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at)',
]

let tablesReady: Promise<void> | null = null

/** Runs the CREATE … IF NOT EXISTS statements once per isolate (a failure is retried on the next call). */
export function ensureAnalyticsTables(db: D1Lite): Promise<void> {
    if (!tablesReady) {
        tablesReady = (async () => {
            for (const sql of ANALYTICS_TABLES) {
                try {
                    await db.prepare(sql).run()
                } catch (err) {
                    // The old analytics table may be missing on a fresh database: its index is optional
                    if (!sql.includes(' ON analytics(')) throw err
                }
            }
        })().catch(err => {
            tablesReady = null
            throw err
        })
    }
    return tablesReady
}

/** Days page_views rows are kept (older rows are pruned when a new month starts). */
export const PAGE_VIEWS_KEEP_DAYS = 400

let saltMemo: { month: string; salt: string } | null = null

/**
 * The salt of `month` ('YYYY-MM'): read from D1, created when missing (INSERT OR IGNORE, then read back,
 * so two isolates starting a month at once agree on one salt). When a new month's salt is created, the
 * salts of past months are deleted (their hashes can never be linked to an IP again) and page_views
 * older than PAGE_VIEWS_KEEP_DAYS are pruned.
 */
export async function monthSalt(db: D1Lite, month: string, today: string): Promise<string> {
    if (saltMemo?.month === month) return saltMemo.salt
    let row = await db.prepare('SELECT salt FROM analytics_salts WHERE month = ?').bind(month).first<{ salt: string }>()
    if (!row) {
        await db.prepare('INSERT OR IGNORE INTO analytics_salts (month, salt) VALUES (?, ?)').bind(month, newSalt()).run()
        row = await db.prepare('SELECT salt FROM analytics_salts WHERE month = ?').bind(month).first<{ salt: string }>()
        await db.prepare('DELETE FROM analytics_salts WHERE month < ?').bind(month).run()
        await db.prepare('DELETE FROM page_views WHERE day < ?').bind(addDays(today, -PAGE_VIEWS_KEEP_DAYS)).run()
    }
    if (!row?.salt) throw new Error('analytics salt unavailable')
    saltMemo = { month, salt: row.salt }
    return row.salt
}

let slugMemo: { at: number; map: Map<string, number> } | null = null
const SLUG_MEMO_MS = 10 * 60 * 1000

/** slug → product id of every product (active or not), kept per isolate for 10 minutes. */
export async function productSlugMap(db: D1Lite, nowMs = Date.now()): Promise<Map<string, number>> {
    if (slugMemo && nowMs - slugMemo.at < SLUG_MEMO_MS) return slugMemo.map
    const { results } = await db.prepare("SELECT id, slug FROM products WHERE slug IS NOT NULL AND slug <> ''").all<{ id: number; slug: string }>()
    const map = new Map<string, number>()
    for (const r of results ?? []) map.set(String(r.slug), Number(r.id))
    slugMemo = { at: nowMs, map }
    return map
}

/** Test hook: forget the per-isolate memos. */
export function resetAnalyticsMemo(): void {
    tablesReady = null
    saltMemo = null
    slugMemo = null
}

export interface PageViewInput {
    path: unknown
    /** the first page view of this page load (only that one carries document.referrer) */
    landing: boolean
    referrer: unknown
    userAgent: string
    ip: string
    /** real browsers always send Accept-Language with fetch(); headless crawlers that run JS often do not */
    acceptLanguage: string | null
    now?: Date
}

/** Writes one page view to page_views. The raw IP and user agent only go into the hash. */
export async function recordPageView(db: D1Lite, input: PageViewInput, ownHost?: string): Promise<void> {
    const now = input.now ?? new Date()
    await ensureAnalyticsTables(db)
    const day = istanbulDay(now)
    const salt = await monthSalt(db, monthOf(day), day)
    const path = normalizePath(input.path)
    const slug = productSlugOf(path)
    const productId = slug ? (await productSlugMap(db, now.getTime())).get(slug) ?? null : null
    const visitor = await visitorHash(salt, input.ip || '', input.userAgent || '')
    const device: DeviceType = deviceTypeOf(input.userAgent)
    const referrer: ReferrerType = referrerTypeOf(input.referrer, input.landing, ownHost)
    const isBot = input.acceptLanguage ? 0 : 1
    await db
        .prepare('INSERT INTO page_views (day, path, product_id, visitor, device_type, referrer_type, is_bot) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(day, path, productId, visitor, device, referrer, isBot)
        .run()
}

// ---- Reading -------------------------------------------------------------------------------------

async function rows<T>(db: D1Lite, sql: string, ...binds: unknown[]): Promise<T[]> {
    const stmt = db.prepare(sql)
    const { results } = await (binds.length ? stmt.bind(...binds) : stmt).all<T>()
    return results ?? []
}

/** Like rows(), but [] when the table does not exist (yet) or the query fails. */
async function rowsOrEmpty<T>(db: D1Lite, sql: string, ...binds: unknown[]): Promise<T[]> {
    try {
        return await rows<T>(db, sql, ...binds)
    } catch {
        return []
    }
}

/** First full day of page_views (the day after its first row), or null when it is empty. */
export async function newCountingFrom(db: D1Lite): Promise<{ firstDay: string | null; newFrom: string | null }> {
    const r = (await rowsOrEmpty<{ d: string | null }>(db, 'SELECT MIN(day) AS d FROM page_views'))[0]
    const firstDay = r?.d ? String(r.d) : null
    return { firstDay, newFrom: firstDay ? addDays(firstDay, 1) : null }
}

/** The part of [from, to] that the old table answers: [from, min(to, newFrom - 1)], or null. */
function legacyPart(from: string, to: string, newFrom: string | null): { from: string; to: string } | null {
    const end = newFrom == null ? to : addDays(newFrom, -1) < to ? addDays(newFrom, -1) : to
    return from <= end ? { from, to: end } : null
}

/** The part of [from, to] that page_views answers. */
function currentPart(from: string, to: string, newFrom: string | null): { from: string; to: string } | null {
    if (newFrom == null) return null
    const start = from > newFrom ? from : newFrom
    return start <= to ? { from: start, to } : null
}

/** Page views per path in [from, to] (old table before newFrom, page_views after). */
export async function pathCounts(db: D1Lite, from: string, to: string, newFrom: string | null): Promise<Map<string, number>> {
    const maps: Map<string, number>[] = []
    const old = legacyPart(from, to, newFrom)
    if (old) {
        const r = await rowsOrEmpty<{ page: string; n: number }>(db,
            'SELECT page, COUNT(*) AS n FROM analytics WHERE created_at >= ? AND created_at < ? GROUP BY page',
            istanbulDayStartUtc(old.from), istanbulDayStartUtc(addDays(old.to, 1)))
        maps.push(new Map(r.map(x => [normalizePath(x.page), Number(x.n) || 0])))
    }
    const cur = currentPart(from, to, newFrom)
    if (cur) {
        const r = await rowsOrEmpty<{ path: string; n: number }>(db,
            'SELECT path, COUNT(*) AS n FROM page_views WHERE day >= ? AND day <= ? AND is_bot = 0 GROUP BY path', cur.from, cur.to)
        maps.push(new Map(r.map(x => [String(x.path), Number(x.n) || 0])))
    }
    return addCounts(...maps)
}

/**
 * Product page views per product id in [from, to]. page_views has the id; the old table only has the
 * path, which is matched to today's product slugs (a renamed slug's old views are lost, which is fine).
 */
export async function productViewCounts(db: D1Lite, from: string, to: string, newFrom: string | null): Promise<Map<number, number>> {
    const maps: Map<number, number>[] = []
    const old = legacyPart(from, to, newFrom)
    if (old) {
        const slugs = await productSlugMap(db)
        const r = await rowsOrEmpty<{ page: string; n: number }>(db,
            'SELECT page, COUNT(*) AS n FROM analytics WHERE created_at >= ? AND created_at < ? GROUP BY page',
            istanbulDayStartUtc(old.from), istanbulDayStartUtc(addDays(old.to, 1)))
        const m = new Map<number, number>()
        for (const x of r) {
            const slug = productSlugOf(normalizePath(x.page))
            const id = slug ? slugs.get(slug) : undefined
            if (id != null) m.set(id, (m.get(id) ?? 0) + (Number(x.n) || 0))
        }
        maps.push(m)
    }
    const cur = currentPart(from, to, newFrom)
    if (cur) {
        const r = await rowsOrEmpty<{ id: number; n: number }>(db,
            'SELECT product_id AS id, COUNT(*) AS n FROM page_views WHERE product_id IS NOT NULL AND day >= ? AND day <= ? AND is_bot = 0 GROUP BY product_id',
            cur.from, cur.to)
        maps.push(new Map(r.map(x => [Number(x.id), Number(x.n) || 0])))
    }
    return addCounts(...maps)
}

/** Product views of the last `days` Istanbul days (home "En çok incelenenler"). Never throws. */
export async function recentProductViews(db: D1Lite, days = 30, now = new Date()): Promise<Map<number, number>> {
    try {
        const today = istanbulDay(now)
        const { newFrom } = await newCountingFrom(db)
        return await productViewCounts(db, addDays(today, -(days - 1)), today, newFrom)
    } catch {
        return new Map()
    }
}

// ---- The admin dashboard -------------------------------------------------------------------------

export interface RangeStats {
    key: RangeKey
    label: string
    from: string
    to: string
    views: number
    /** distinct visitors; null when the range lies entirely before visitor counting started */
    visitors: number | null
    /** the range crosses a month boundary: the visitor count is a sum of monthly counts */
    approx: boolean
    /** visitor counting started inside the range: visitors only cover the days since `since` */
    partial: boolean
    orders: number
    revenue: number
}

export interface AssistantRange {
    conversations: number
    turns: number
    handoffs: number
    waClicks: number
}

export interface StatsResult {
    today: string
    /** first day of visitor counting (null: not started yet) */
    since: string | null
    ranges: RangeStats[]
    daily: DayCount[]
    days: 7 | 30
    topProducts: Array<{ id: number; name: string; slug: string | null; active: boolean; views: number }>
    topPages: Array<{ path: string; views: number }>
    devices: Array<{ type: DeviceType; views: number; visitors: number }>
    sources: Array<{ type: Exclude<ReferrerType, 'internal'>; visits: number }>
    assistant: { today: AssistantRange; d7: AssistantRange; d30: AssistantRange }
}

/** Same rule as the dashboard's order totals: no cancelled orders, no unpaid online (PayTR/iyzico) orders. */
const ORDER_FILTER = `status != 'cancelled' AND NOT (payment_status != 'paid' AND json_extract(shipping_address, '$.provider') IN ('paytr', 'iyzico'))`

async function assistantRange(db: D1Lite, from: string, to: string): Promise<AssistantRange> {
    const turn = (await rowsOrEmpty<{ c: number; t: number; h: number }>(db,
        `SELECT COUNT(DISTINCT conv_hash) AS c, COUNT(*) AS t, SUM(CASE WHEN handoff IS NOT NULL AND handoff <> '' THEN 1 ELSE 0 END) AS h
FROM ai_chat_events WHERE kind = 'turn' AND day >= ? AND day <= ?`, from, to))[0]
    const ui = (await rowsOrEmpty<{ n: number }>(db,
        "SELECT COUNT(*) AS n FROM ai_chat_events WHERE kind = 'ui' AND outcome = 'wa_click' AND day >= ? AND day <= ?", from, to))[0]
    return {
        conversations: Number(turn?.c) || 0,
        turns: Number(turn?.t) || 0,
        handoffs: Number(turn?.h) || 0,
        waClicks: Number(ui?.n) || 0,
    }
}

/** Everything the Admin › İstatistikler page shows. `days` (7 or 30) applies to the lists. */
export async function loadStats(db: D1Lite, opts: { now?: Date; days?: 7 | 30 } = {}): Promise<StatsResult> {
    const now = opts.now ?? new Date()
    const days = opts.days === 7 ? 7 : 30
    try {
        await ensureAnalyticsTables(db)
    } catch {
        // reading still works for whatever exists
    }
    const today = istanbulDay(now)
    const ranges = dashboardRanges(today)
    const { firstDay, newFrom } = await newCountingFrom(db)
    const earliest = ranges.reduce((m, r) => (r.from < m ? r.from : m), today)

    // Daily views (old table up to newFrom, page_views from then on) for everything the ranges need
    const legacyDaily = await rowsOrEmpty<{ day: string; views: number }>(db,
        "SELECT date(created_at, '+3 hours') AS day, COUNT(*) AS views FROM analytics WHERE created_at >= ? GROUP BY day",
        istanbulDayStartUtc(earliest))
    const currentDaily = await rowsOrEmpty<{ day: string; views: number; visitors: number }>(db,
        'SELECT day, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors FROM page_views WHERE day >= ? AND is_bot = 0 GROUP BY day', earliest)
    const merged = mergeDaily(earliest, today, legacyDaily, currentDaily, newFrom)

    const rangeStats: RangeStats[] = []
    for (const r of ranges) {
        const monthly = await rowsOrEmpty<{ month: string; visitors: number }>(db,
            'SELECT substr(day, 1, 7) AS month, COUNT(DISTINCT visitor) AS visitors FROM page_views WHERE day >= ? AND day <= ? AND is_bot = 0 GROUP BY month',
            r.from, r.to)
        const v = sumMonthlyVisitors(monthly, r.from, r.to)
        const counted = firstDay != null && firstDay <= r.to
        const orders = (await rowsOrEmpty<{ n: number; total: number | null }>(db,
            `SELECT COUNT(*) AS n, SUM(total_amount) AS total FROM orders WHERE created_at >= ? AND created_at < ? AND ${ORDER_FILTER}`,
            istanbulDayStartUtc(r.from), istanbulDayStartUtc(addDays(r.to, 1))))[0]
        rangeStats.push({
            key: r.key,
            label: r.label,
            from: r.from,
            to: r.to,
            views: sumViews(merged, r.from, r.to),
            visitors: counted ? v.visitors : null,
            approx: counted && v.approx,
            partial: counted && firstDay! > r.from,
            orders: Number(orders?.n) || 0,
            revenue: Math.round((Number(orders?.total) || 0) * 100) / 100,
        })
    }

    const listFrom = addDays(today, -(days - 1))
    const [products, paths] = await Promise.all([
        productViewCounts(db, listFrom, today, newFrom),
        pathCounts(db, listFrom, today, newFrom),
    ])
    const top = topEntries(products, 10)
    const names = top.length
        ? await rowsOrEmpty<{ id: number; name: string; slug: string | null; is_active: number | null }>(db,
            `SELECT id, name, slug, is_active FROM products WHERE id IN (${top.map(() => '?').join(', ')})`, ...top.map(t => t.key))
        : []
    const byId = new Map(names.map(n => [Number(n.id), n]))
    const topProducts = top.map(t => {
        const p = byId.get(Number(t.key))
        return {
            id: Number(t.key),
            name: p ? String(p.name) : `Ürün #${t.key}`,
            slug: p?.slug ? String(p.slug) : null,
            active: p ? Number(p.is_active ?? 1) === 1 : false,
            views: t.views,
        }
    })
    const topPages = topEntries(paths, 10).map(t => ({ path: String(t.key), views: t.views }))

    const deviceRows = await rowsOrEmpty<{ type: DeviceType; views: number; visitors: number }>(db,
        'SELECT device_type AS type, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors FROM page_views WHERE day >= ? AND day <= ? AND is_bot = 0 GROUP BY device_type',
        listFrom, today)
    const devices = (['phone', 'desktop', 'tablet'] as const).map(type => {
        const r = deviceRows.find(x => x.type === type)
        return { type, views: Number(r?.views) || 0, visitors: Number(r?.visitors) || 0 }
    })
    const sourceRows = await rowsOrEmpty<{ type: ReferrerType; n: number }>(db,
        "SELECT referrer_type AS type, COUNT(*) AS n FROM page_views WHERE day >= ? AND day <= ? AND is_bot = 0 AND referrer_type <> 'internal' GROUP BY referrer_type",
        listFrom, today)
    const sources = (['direct', 'google', 'social', 'other'] as const).map(type => ({
        type,
        visits: Number(sourceRows.find(x => x.type === type)?.n) || 0,
    }))

    const [aToday, a7, a30] = await Promise.all([
        assistantRange(db, today, today),
        assistantRange(db, addDays(today, -6), today),
        assistantRange(db, addDays(today, -29), today),
    ])

    return {
        today,
        since: firstDay,
        ranges: rangeStats,
        daily: merged.filter(d => d.day >= addDays(today, -29)),
        days,
        topProducts,
        topPages,
        devices,
        sources,
        assistant: { today: aToday, d7: a7, d30: a30 },
    }
}
