/**
 * Store statistics: the pure part (no D1, no Next imports), shared by the track route, the admin stats API
 * and the home page's "En çok incelenenler" row, and unit-tested by scripts/analytics.test.mjs.
 *
 * How visitors are counted without cookies (privacy first, KVKK):
 * - Every page view gets `visitor` = HMAC-SHA256(salt of the calendar month, IP + "\n" + user agent),
 *   first 16 hex characters. The raw IP is never stored anywhere.
 * - The salt is random, kept in D1 per month (analytics_salts) and deleted once the month is over, so
 *   nobody (not even with the database) can later tell which IP a hash belonged to, and the same
 *   person gets a different hash next month.
 * - Distinct visitors in a range = distinct hashes in that range. A range that crosses a month boundary
 *   sums the per-month counts (someone who came in both months counts twice): shown as "yaklaşık".
 *
 * Days are Europe/Istanbul days (UTC+3 all year since 2016), like the assistant's counters. The old
 * `analytics` table stores created_at in UTC, so its rows are converted with istanbulDayStartUtc().
 */

/** Turkey has had no daylight saving time since 2016: Istanbul is UTC+3 all year. */
export const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 86_400_000

/** 'YYYY-MM-DD' of the Istanbul day `daysBack` days before `date`. */
export function istanbulDay(date: Date, daysBack = 0): string {
    return new Date(date.getTime() + ISTANBUL_OFFSET_MS - daysBack * DAY_MS).toISOString().slice(0, 10)
}

/** 'YYYY-MM' of an Istanbul day. */
export function monthOf(day: string): string {
    return day.slice(0, 7)
}

/** `day` moved by `n` days ('2026-03-01', -1 → '2026-02-28'). */
export function addDays(day: string, n: number): string {
    return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Every day from `from` to `to`, both included (empty when from > to). */
export function daysBetween(from: string, to: string): string[] {
    const out: string[] = []
    for (let d = from; d <= to && out.length < 1000; d = addDays(d, 1)) out.push(d)
    return out
}

/** UTC timestamp ('YYYY-MM-DD HH:MM:SS', the format of CURRENT_TIMESTAMP) at which an Istanbul day starts. */
export function istanbulDayStartUtc(day: string): string {
    return new Date(Date.parse(`${day}T00:00:00Z`) - ISTANBUL_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ')
}

// ---- Ranges shown on the dashboard ---------------------------------------------------------------

export type RangeKey = 'today' | 'yesterday' | 'd7' | 'd30' | 'month'

export interface DayRange {
    key: RangeKey
    label: string
    from: string
    to: string
}

export const RANGE_LABELS: Record<RangeKey, string> = {
    today: 'Bugün',
    yesterday: 'Dün',
    d7: 'Son 7 gün',
    d30: 'Son 30 gün',
    month: 'Bu ay',
}

/** The dashboard's ranges for the Istanbul day `today` (inclusive on both ends). */
export function dashboardRanges(today: string): DayRange[] {
    const r = (key: RangeKey, from: string, to: string): DayRange => ({ key, label: RANGE_LABELS[key], from, to })
    return [
        r('today', today, today),
        r('yesterday', addDays(today, -1), addDays(today, -1)),
        r('d7', addDays(today, -6), today),
        r('d30', addDays(today, -29), today),
        r('month', `${monthOf(today)}-01`, today),
    ]
}

/** True when the range covers days of more than one calendar month (visitor counts are then approximate). */
export function crossesMonth(from: string, to: string): boolean {
    return monthOf(from) !== monthOf(to)
}

// ---- Merging the old table (page views only) with the new one ------------------------------------

export interface DayCount {
    day: string
    views: number
    /** distinct visitors that day; null when the day is older than the new counting */
    visitors: number | null
}

/**
 * Daily series from `from` to `to` (zeros for empty days). Days before `newFrom` take their page views
 * from the old analytics table (it has no visitor ids, so visitors stay null); days from `newFrom` on
 * take both from page_views. newFrom = the first FULL day of page_views (the deploy day itself is partial
 * there but complete in the old table, which the track route keeps writing). newFrom null = no new data.
 */
export function mergeDaily(
    from: string,
    to: string,
    legacy: Array<{ day: string; views: number }>,
    current: Array<{ day: string; views: number; visitors: number }>,
    newFrom: string | null,
): DayCount[] {
    const old = new Map(legacy.map(r => [r.day, Number(r.views) || 0]))
    const now = new Map(current.map(r => [r.day, r]))
    return daysBetween(from, to).map(day => {
        if (newFrom != null && day >= newFrom) {
            const r = now.get(day)
            return { day, views: Number(r?.views) || 0, visitors: Number(r?.visitors) || 0 }
        }
        const visitors = now.get(day)
        return { day, views: old.get(day) ?? 0, visitors: visitors ? Number(visitors.visitors) || 0 : null }
    })
}

/** Page views in [from, to] from a merged daily series. */
export function sumViews(daily: DayCount[], from: string, to: string): number {
    return daily.reduce((n, d) => (d.day >= from && d.day <= to ? n + d.views : n), 0)
}

/**
 * Distinct visitors of a range from per-month distinct counts (one row per month the range touches).
 * Months are summed; `approx` says the sum may count the same person twice.
 */
export function sumMonthlyVisitors(rows: Array<{ month: string; visitors: number }>, from: string, to: string): { visitors: number; approx: boolean } {
    const visitors = rows.reduce((n, r) => n + (Number(r.visitors) || 0), 0)
    return { visitors, approx: crossesMonth(from, to) && rows.filter(r => Number(r.visitors) > 0).length > 1 }
}

/** Adds count maps (path → views, product id → views …). */
export function addCounts<K>(...maps: Array<Map<K, number>>): Map<K, number> {
    const out = new Map<K, number>()
    for (const m of maps) for (const [k, v] of m) out.set(k, (out.get(k) ?? 0) + (Number(v) || 0))
    return out
}

/** The `limit` largest entries, ties broken by key (stable across requests). */
export function topEntries<K extends string | number>(counts: Map<K, number>, limit: number): Array<{ key: K; views: number }> {
    return [...counts]
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .slice(0, limit)
        .map(([key, views]) => ({ key, views }))
}

// ---- Paths ---------------------------------------------------------------------------------------

/** Top-level paths that are never product pages (static routes, see RESERVED_SLUGS in lib/seo-routing). */
const NOT_PRODUCT = new Set([
    'admin', 'api', 'categories', 'help', 'kategori', 'login', 'maintenance', 'odeme', 'orders', 'page', 'policy',
    'product', 'products', 'profile', 'register', 'shipping', 'siparis-basarili', 'siparis-hata', 'terms',
    'cart', 'checkout', 'sepet', 'export', 'favorites', 'favoriler', 'search', 'arama', 'degerlendir',
])

/** Stored path: no query or hash, at most 300 characters, always starting and ending with "/". */
export function normalizePath(raw: unknown): string {
    let p = typeof raw === 'string' ? raw : ''
    p = p.split(/[?#]/)[0].trim()
    if (!p.startsWith('/')) p = '/' + p
    p = p.replace(/\/{2,}/g, '/')
    if (!p.endsWith('/')) p += '/'
    return p.slice(0, 300)
}

/** The product slug of a product page path ('/onopo-67w-sarj/' → 'onopo-67w-sarj'), else null. */
export function productSlugOf(path: string): string | null {
    const m = /^\/([^/]+)\/$/.exec(path)
    if (!m) return null
    let slug = m[1]
    try { slug = decodeURIComponent(slug) } catch { /* keep raw */ }
    if (NOT_PRODUCT.has(slug.toLowerCase()) || slug.includes('.')) return null
    return slug
}

// ---- Request classification ----------------------------------------------------------------------

export type DeviceType = 'phone' | 'tablet' | 'desktop'

/** Phone, tablet or computer, from the user agent (iPad on iPadOS 13+ says "Macintosh": counted as desktop). */
export function deviceTypeOf(userAgent: string): DeviceType {
    const ua = userAgent || ''
    if (/ipad|tablet|playbook|silk|kindle/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return 'tablet'
    if (/mobi|iphone|ipod|android|windows phone|opera mini|blackberry/i.test(ua)) return 'phone'
    return 'desktop'
}

export type ReferrerType = 'internal' | 'direct' | 'google' | 'social' | 'other'

export const REFERRER_LABELS: Record<Exclude<ReferrerType, 'internal'>, string> = {
    direct: 'Doğrudan',
    google: 'Google',
    social: 'Sosyal medya',
    other: 'Diğer siteler',
}

/**
 * Where a visit came from. Only the first page view of a visit carries the browser's document.referrer
 * (`landing` true); every later view in the same tab is 'internal'. Our own host (and www.) is internal.
 */
export function referrerTypeOf(referrer: unknown, landing: boolean, ownHost = 'onopostore.com'): ReferrerType {
    if (!landing) return 'internal'
    if (typeof referrer !== 'string' || !referrer.trim()) return 'direct'
    let host: string
    try {
        host = new URL(referrer).hostname.toLowerCase()
    } catch {
        return 'other'
    }
    const own = ownHost.toLowerCase().replace(/^www\./, '')
    if (host === own || host === `www.${own}`) return 'internal'
    if (/(^|\.)google\.[a-z.]+$/.test(host) || host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com')) return 'google'
    if (/(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|t\.co|twitter\.com|x\.com|tiktok\.com|youtube\.com|youtu\.be|linkedin\.com|lnkd\.in|pinterest\.[a-z.]+|reddit\.com|whatsapp\.com|wa\.me|t\.me|telegram\.org|threads\.net|snapchat\.com|eksisozluk\.com)$/.test(host)) return 'social'
    return 'other'
}

// ---- Visitor hash --------------------------------------------------------------------------------

function toHex(buf: ArrayBuffer): string {
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** A new random salt (32 bytes, hex). */
export function newSalt(): string {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return toHex(bytes.buffer)
}

const keyCache = new Map<string, Promise<CryptoKey>>()

/** HMAC-SHA256(salt, ip + "\n" + userAgent), first 16 hex characters (64 bits: no collisions at this traffic). */
export async function visitorHash(salt: string, ip: string, userAgent: string): Promise<string> {
    let key = keyCache.get(salt)
    if (!key) {
        if (keyCache.size > 4) keyCache.clear()
        key = crypto.subtle.importKey('raw', new TextEncoder().encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
        keyCache.set(salt, key)
    }
    const sig = await crypto.subtle.sign('HMAC', await key, new TextEncoder().encode(`${ip}\n${userAgent}`))
    return toHex(sig).slice(0, 16)
}

// ---- Home: "En çok incelenenler" -----------------------------------------------------------------

/**
 * The most viewed products for a home row: products with views first (most views first, ties by the
 * pool order), then the rest of the pool in its own order (newest first) to fill up `limit`. Stable:
 * the same data gives the same order on every request. `pool` holds only products that may be shown
 * (active, in stock), so a viewed product that sold out is skipped.
 */
export function rankMostViewed<T extends { id: number }>(pool: T[], views: Map<number, number>, limit: number): T[] {
    const index = new Map(pool.map((p, i) => [p.id, i]))
    const viewed = pool
        .filter(p => (views.get(p.id) ?? 0) > 0)
        .sort((a, b) => (views.get(b.id) ?? 0) - (views.get(a.id) ?? 0) || (index.get(a.id)! - index.get(b.id)!))
    const seen = new Set(viewed.map(p => p.id))
    return [...viewed, ...pool.filter(p => !seen.has(p.id))].slice(0, Math.max(0, limit))
}

/**
 * Products of a "products" home section in a stable order (it used to be shuffled on every render):
 * manual → the admin's own order of product_ids; otherwise the pool order. `random: true` (an explicit
 * admin choice) shuffles.
 */
export function orderSectionProducts<T extends { id: number }>(list: T[], productIds: unknown, random: boolean, rnd: () => number = Math.random): T[] {
    let out = list
    if (Array.isArray(productIds) && productIds.length > 0) {
        const order = new Map<number, number>()
        productIds.forEach((x, i) => {
            const id = Number(x)
            if (Number.isFinite(id) && !order.has(id)) order.set(id, i)
        })
        out = list.filter(p => order.has(p.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!)
    }
    if (random) {
        out = [...out]
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(rnd() * (i + 1))
            ;[out[i], out[j]] = [out[j], out[i]]
        }
    }
    return out
}
