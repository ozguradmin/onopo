/**
 * IndexNow (https://www.indexnow.org/documentation): tells Bing, Yandex, Seznam, Naver … that a URL changed, so
 * they recrawl it within minutes instead of days. One POST to api.indexnow.org reaches every participating
 * engine. ChatGPT search reads Bing's index, so this is also how product changes reach it.
 *
 * - The key is INDEXNOW_KEY in wrangler.toml [vars]. It is public by design: worker.ts serves it as
 *   https://onopostore.com/<key>.txt (indexNowKeyFileResponse), which is how the engines verify that the
 *   host owns the key.
 * - Who submits: admin saves (product create/update/delete, category and CMS page changes; lib/indexnow-server.ts,
 *   one POST per save, in ctx.waitUntil) and the daily cron (sweepIndexNow below: sitemap URLs that are new,
 *   changed since they were last sent, or gone from the sitemap).
 * - Only canonical https://onopostore.com/… URLs with a trailing slash and no query (canonicalSubmitUrls).
 * - Nothing happens outside production: no valid key, a host other than onopostore.com / www (127.0.0.1 under
 *   wrangler dev, localhost under next dev) or NODE_ENV=development.
 * - Never throws. A refused or failed POST goes to the system log (source 'indexnow', one row per day and
 *   message: lib/system-log.ts de-duplicates).
 * - indexnow_urls (url, submitted_at) remembers what was sent, so the daily sweep only sends what changed.
 *
 * Pure apart from the injected database and fetch (tests pass fakes), so worker.ts can import it.
 */
import { categoryPath, productPath } from './seo'
import { logSystemEvent, type SystemLogDb } from './system-log'

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
export const INDEXNOW_HOST = 'onopostore.com'
const SITE_ORIGIN = `https://${INDEXNOW_HOST}`
/** The protocol's limit per POST. */
export const INDEXNOW_MAX_URLS = 10_000
const PRODUCTION_HOSTS = new Set([INDEXNOW_HOST, `www.${INDEXNOW_HOST}`])
const FETCH_TIMEOUT_MS = 15_000
/** Rows per D1 statement (D1 allows 100 bound values). */
const BATCH = 50

// ---- key ----------------------------------------------------------------------------------------------

/** The protocol's key format: 8–128 characters of a-z, A-Z, 0-9 and '-'. */
export function isValidIndexNowKey(key: unknown): key is string {
    return typeof key === 'string' && /^[a-zA-Z0-9-]{8,128}$/.test(key)
}

export function indexNowKeyLocation(key: string): string {
    return `${SITE_ORIGIN}/${key}.txt`
}

/**
 * The key file /<key>.txt (exactly the key, text/plain), answered by worker.ts before anything else so neither
 * the edge cache nor the old-URL resolver sees it. Null for every other request.
 */
export function indexNowKeyFileResponse(pathname: string, method: string, key: unknown): Response | null {
    if (method !== 'GET' && method !== 'HEAD') return null
    if (!isValidIndexNowKey(key) || pathname !== `/${key}.txt`) return null
    return new Response(method === 'HEAD' ? null : key, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=86400',
        },
    })
}

// ---- when ---------------------------------------------------------------------------------------------

export interface IndexNowGate {
    key: unknown
    /** Host of the request that changed something (or of the cron's in-process request). */
    host: string | null | undefined
    /** process.env.NODE_ENV: 'development' under next dev. */
    nodeEnv?: string | null
}

/** The production site (onopostore.com / www) and not a development build. */
export function isIndexNowHost(host: string | null | undefined, nodeEnv?: string | null): boolean {
    if (nodeEnv === 'development' || nodeEnv === 'test') return false
    return PRODUCTION_HOSTS.has(String(host || '').toLowerCase())
}

/** Whether submissions may be sent: a valid key, the production host and not a development build. */
export function indexNowEnabled(gate: IndexNowGate): boolean {
    return isValidIndexNowKey(gate.key) && isIndexNowHost(gate.host, gate.nodeEnv)
}

// ---- which URLs ---------------------------------------------------------------------------------------

/**
 * Absolute canonical URLs, de-duplicated, in input order, at most INDEXNOW_MAX_URLS. Accepts site paths
 * ('/kategori/x/') and https://onopostore.com URLs; drops other hosts, http, www, queries, fragments, paths
 * without a trailing slash (files such as /llms.txt are not pages to recrawl) and /api, /admin.
 */
export function canonicalSubmitUrls(urls: Iterable<string | null | undefined>): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    for (const raw of urls) {
        const s = String(raw ?? '').trim()
        if (!s) continue
        let u: URL
        try {
            if (s.startsWith('/') && !s.startsWith('//')) u = new URL(s, SITE_ORIGIN)
            else if (/^https:\/\//i.test(s)) u = new URL(s)
            else continue
        } catch {
            continue
        }
        if (u.protocol !== 'https:' || u.hostname !== INDEXNOW_HOST || u.port) continue
        if (u.search || u.hash || s.includes('?') || s.includes('#')) continue
        if (!u.pathname.endsWith('/') || u.pathname.includes('//')) continue
        if (/^\/(api|admin|_next)(\/|$)/.test(u.pathname)) continue
        const href = `${SITE_ORIGIN}${u.pathname}`
        if (seen.has(href)) continue
        seen.add(href)
        out.push(href)
        if (out.length >= INDEXNOW_MAX_URLS) break
    }
    return out
}

/** The JSON body of the POST (https://www.indexnow.org/documentation, "Submitting set of URLs"). */
export function indexNowPayload(key: string, urlList: string[]) {
    return { host: INDEXNOW_HOST, key, keyLocation: indexNowKeyLocation(key), urlList }
}

/** What an admin save changed. */
export interface IndexNowChange {
    /** Products created, saved or deactivated: their page and their category's listing. */
    productIds?: Array<number | null | undefined>
    /** Category names or slugs whose listing changed (e.g. the old category of a moved product). */
    categories?: Array<string | null | undefined>
    /** Further site paths ('/products/', '/page/shipping/', a deleted product's page). */
    paths?: Array<string | null | undefined>
}

/**
 * The site paths of a change: product pages, then category listings (products reference categories by NAME;
 * the slug comes from the categories table), then the extra paths. Unknown ids and names are skipped.
 */
export async function pathsForChange(db: SystemLogDb, change: IndexNowChange): Promise<string[]> {
    const out: string[] = []
    const categoryKeys: string[] = (change.categories ?? []).filter((c): c is string => typeof c === 'string' && c.trim() !== '')
    const ids = [...new Set((change.productIds ?? []).filter((id): id is number => Number.isInteger(id) && (id as number) > 0))]
    for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH)
        const { results } = await db
            .prepare(`SELECT id, slug, category FROM products WHERE id IN (${chunk.map(() => '?').join(', ')})`)
            .bind(...chunk)
            .all<{ id: number; slug: string | null; category: string | null }>()
        for (const r of results ?? []) {
            if (r.slug) out.push(productPath(String(r.slug)))
            if (r.category) categoryKeys.push(String(r.category))
        }
    }
    if (categoryKeys.length) {
        const { results } = await db.prepare('SELECT name, slug FROM categories').all<{ name: string | null; slug: string | null }>()
        const fold = (v: string) => v.trim().toLocaleLowerCase('tr-TR')
        const bySlugOrName = new Map<string, string>()
        for (const c of results ?? []) {
            if (!c.slug) continue
            bySlugOrName.set(fold(String(c.slug)), String(c.slug))
            if (c.name) bySlugOrName.set(fold(String(c.name)), String(c.slug))
        }
        for (const key of categoryKeys) {
            const slug = bySlugOrName.get(fold(key))
            if (slug) out.push(categoryPath(slug))
        }
    }
    for (const p of change.paths ?? []) if (p) out.push(p)
    return [...new Set(out)]
}

// ---- submitted URLs (D1 table indexnow_urls) ----------------------------------------------------------

/** Same statement as schema.sql, so a database created before this feature works too. */
export const INDEXNOW_TABLE_SQL = 'CREATE TABLE IF NOT EXISTS indexnow_urls (url TEXT PRIMARY KEY, submitted_at TEXT NOT NULL)'

let tableReady: Promise<void> | null = null

export function ensureIndexNowTable(db: SystemLogDb): Promise<void> {
    if (!tableReady) {
        tableReady = db.prepare(INDEXNOW_TABLE_SQL).run().then(() => undefined, err => {
            tableReady = null
            throw err
        })
    }
    return tableReady
}

/** Tests: forget the per-isolate memo. */
export function resetIndexNowMemo(): void {
    tableReady = null
}

/** url → submitted_at (ISO) of everything sent so far. */
export async function loadSubmitted(db: SystemLogDb): Promise<Map<string, string>> {
    await ensureIndexNowTable(db)
    const { results } = await db.prepare('SELECT url, submitted_at FROM indexnow_urls').all<{ url: string; submitted_at: string }>()
    return new Map((results ?? []).map(r => [String(r.url), String(r.submitted_at)]))
}

async function recordSubmitted(db: SystemLogDb, urls: string[], at: string): Promise<void> {
    await ensureIndexNowTable(db)
    for (let i = 0; i < urls.length; i += BATCH) {
        const chunk = urls.slice(i, i + BATCH)
        await db
            .prepare(`INSERT INTO indexnow_urls (url, submitted_at) VALUES ${chunk.map(() => '(?, ?)').join(', ')} ON CONFLICT(url) DO UPDATE SET submitted_at = excluded.submitted_at`)
            .bind(...chunk.flatMap(u => [u, at]))
            .run()
    }
}

async function forgetSubmitted(db: SystemLogDb, urls: string[]): Promise<void> {
    for (let i = 0; i < urls.length; i += BATCH) {
        const chunk = urls.slice(i, i + BATCH)
        await db.prepare(`DELETE FROM indexnow_urls WHERE url IN (${chunk.map(() => '?').join(', ')})`).bind(...chunk).run()
    }
}

// ---- submit -------------------------------------------------------------------------------------------

export type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ status: number; ok: boolean }>

export interface SubmitOptions extends IndexNowGate {
    db?: SystemLogDb | null
    fetch?: FetchLike
    /** Remember the URLs in indexnow_urls after an accepted POST (so the daily sweep skips them). */
    record?: boolean
    now?: Date
}

export type SubmitResult =
    | { status: 'skipped' }
    | { status: 'empty' }
    | { status: 'sent'; count: number; http: number }
    | { status: 'failed'; count: number; http?: number }

// What the engines' answers mean (documentation, "Response format"), for the system log
const HTTP_REASON: Record<number, string> = {
    400: 'geçersiz istek',
    403: 'anahtar doğrulanamadı (anahtar dosyası açılmıyor ya da içeriği farklı)',
    422: 'adresler bu siteye ait değil ya da anahtar uyuşmuyor',
    429: 'çok fazla istek',
}

/**
 * One POST with every URL (after canonicalSubmitUrls). 200 and 202 (key not verified yet) count as accepted.
 * Never throws; failures are logged (source 'indexnow').
 */
export async function submitUrls(urls: Iterable<string | null | undefined>, opts: SubmitOptions): Promise<SubmitResult> {
    try {
        if (!indexNowEnabled(opts)) return { status: 'skipped' }
        const key = opts.key as string
        const list = canonicalSubmitUrls(urls)
        if (!list.length) return { status: 'empty' }
        const doFetch: FetchLike = opts.fetch ?? ((input, init) => fetch(input, init))
        let http: number
        try {
            const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(FETCH_TIMEOUT_MS) : undefined
            const res = await doFetch(INDEXNOW_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify(indexNowPayload(key, list)),
                ...(signal ? { signal } : {}),
            })
            http = res.status
        } catch (err) {
            await logSystemEvent(opts.db, {
                source: 'indexnow',
                level: 'warn',
                message: 'IndexNow bildirimi gönderilemedi; değişen sayfalar arama motorlarına sonra bildirilecek.',
                detail: err instanceof Error ? err.message : 'error',
            }, opts.now)
            return { status: 'failed', count: list.length }
        }
        if (http !== 200 && http !== 202) {
            await logSystemEvent(opts.db, {
                source: 'indexnow',
                level: 'warn',
                message: 'IndexNow bildirimi kabul edilmedi.',
                detail: `HTTP ${http}${HTTP_REASON[http] ? ` (${HTTP_REASON[http]})` : ''}, ${list.length} adres`,
            }, opts.now)
            return { status: 'failed', count: list.length, http }
        }
        console.log(`indexnow_sent ${list.length} url(s) http=${http}`)
        if (opts.record && opts.db) {
            try {
                await recordSubmitted(opts.db, list, (opts.now ?? new Date()).toISOString())
            } catch (err) {
                console.error('indexnow_record_failed', err instanceof Error ? err.message : 'error')
            }
        }
        return { status: 'sent', count: list.length, http }
    } catch (err) {
        console.error('indexnow_failed', err instanceof Error ? err.message : 'error')
        return { status: 'failed', count: 0 }
    }
}

// ---- daily sweep --------------------------------------------------------------------------------------

export interface SitemapEntryLike {
    url: string
    lastModified?: string | Date | null
}

function isoOf(v: string | Date | null | undefined): string | null {
    if (!v) return null
    const d = v instanceof Date ? v : new Date(v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * What the daily sweep sends: sitemap URLs never sent, or whose lastmod is newer than their last submission,
 * plus URLs sent before that are no longer in the sitemap (deleted or deactivated products: the engines then
 * fetch the 404 and drop them). A URL without lastmod is sent once.
 */
export function planIndexNowSweep(entries: SitemapEntryLike[], submitted: Map<string, string>): { changed: string[]; removed: string[] } {
    const current = new Map<string, string | null>()
    for (const e of entries) {
        const [url] = canonicalSubmitUrls([e.url])
        if (url) current.set(url, isoOf(e.lastModified) ?? current.get(url) ?? null)
    }
    const changed: string[] = []
    for (const [url, lastmod] of current) {
        const at = submitted.get(url)
        if (!at || (lastmod && lastmod > at)) changed.push(url)
    }
    const removed = [...submitted.keys()].filter(url => !current.has(url))
    return { changed, removed }
}

export interface SweepResult {
    status: SubmitResult['status']
    changed: number
    removed: number
}

/**
 * The cron step: one POST with the changed and removed sitemap URLs, then indexnow_urls is brought up to date
 * (only after the engines accepted it, so a failed day is retried the next day). `entries` = app/sitemap.ts.
 */
export async function sweepIndexNow(db: SystemLogDb, entries: SitemapEntryLike[], opts: Omit<SubmitOptions, 'db' | 'record'>): Promise<SweepResult> {
    if (!indexNowEnabled(opts)) return { status: 'skipped', changed: 0, removed: 0 }
    const { changed, removed } = planIndexNowSweep(entries, await loadSubmitted(db))
    const urls = [...changed, ...removed].slice(0, INDEXNOW_MAX_URLS)
    if (!urls.length) return { status: 'empty', changed: 0, removed: 0 }
    const result = await submitUrls(urls, { ...opts, db, record: false })
    if (result.status === 'sent') {
        const sent = new Set(urls)
        await recordSubmitted(db, changed.filter(u => sent.has(u)), (opts.now ?? new Date()).toISOString())
        await forgetSubmitted(db, removed.filter(u => sent.has(u)))
    }
    return { status: result.status, changed: changed.length, removed: removed.length }
}
