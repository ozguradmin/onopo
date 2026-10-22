/**
 * Old-URL redirects: answers a 301 to the right live page for URLs that would otherwise be our 404.
 *
 * Google still links to the shop that ran before this codebase (other URL patterns: /urun/<slug>, /x.html,
 * /index.php?route=product/product&product_id=12, /_next/image?url=…, /uploads/<file> …) and to products that
 * were renamed. worker.ts calls resolvePath() only after OpenNext answered 404 (and for the trailing-slash 308
 * of a legacy-looking path, so the visitor gets one hop instead of two); every live page is untouched.
 *
 * Order (first hit wins):
 *   1. Admin-defined redirects (D1 table redirects, Admin › Yönlendirmeler): exact match on the normalized path.
 *   2. Pattern rules for the old platforms' URLs (images, product ids/slugs, category prefixes, CMS pages).
 *   3. Fuzzy match of the last path segment against product and category names (scoreCandidate): only when the
 *      best score is high AND clearly ahead of the second; otherwise no guess (a wrong product is worse than a 404).
 *   4. Nothing: the normal 404 is returned and the path is counted in not_found_log (no IP, no user agent; only
 *      visitors and Googlebot, other bots are ignored), where the admin can map it by hand.
 *
 * Safety:
 *   - Never redirects /api/* (except /api/images/<key> misses) or /admin, and never to them.
 *   - Never an open redirect: targets are same-site paths or https://images.onopostore.com/<key>.
 *   - Never to a page that 404s: targets come from the live index (active products, categories with active
 *     products, CMS pages, a short list of static routes) or are images checked in R2. Admin targets are checked
 *     against the same index on save and on every use, so a target that has since disappeared stops redirecting
 *     (and is reported once a day in system_logs) instead of creating a redirect into a 404.
 *   - Max one hop: a target is always a live page (never itself a redirect source), and never the request itself.
 *
 * The pure parts (normalization, patterns, scoring) are unit-tested in scripts/redirects.test.mjs; D1 helpers
 * are at the end of the file.
 */
import { BOT_USER_AGENT } from './bot-user-agent'
import { isTrackingParam } from './edge-cache'
import { imageKey, R2_PUBLIC_HOST } from './images'
import { foldTr } from './seo'

// ---- constants ---------------------------------------------------------------------------------------

const SITE_ORIGIN = 'https://onopostore.com'
const SITE_HOSTS = new Set(['onopostore.com', 'www.onopostore.com'])
const IMAGE_HOST = new URL(R2_PUBLIC_HOST).hostname

/** The product/category index is rebuilt at most this often per isolate. */
export const INDEX_TTL_MS = 10 * 60_000
/** not_found_log keeps at most this many rows (least recently seen are dropped first). */
export const NOT_FOUND_LOG_MAX_ROWS = 2000

/**
 * Fuzzy thresholds. AUTO_*: an automatic 301 (best score and lead over the runner-up). SUGGEST_MIN_SCORE: the
 * looser bar for the suggestion shown to the admin, who confirms it. Tuned on the real catalogue's naming
 * ("Onopo İphone 15 Anti Static 9D Tam Ekran Cam Ekran Koruyucu"); see scripts/redirects.test.mjs.
 */
export const AUTO_MIN_SCORE = 0.75
export const AUTO_MIN_MARGIN = 0.1
/** …or a moderate score with a wide lead (old slugs are often shorter than today's names). */
export const AUTO_WIDE_MIN_SCORE = 0.6
export const AUTO_WIDE_MIN_MARGIN = 0.25
export const SUGGEST_MIN_SCORE = 0.4

/** Pages that exist without a database row. /help/ … redirect to /page/<slug>/ themselves (lib/seo-routing.ts). */
const STATIC_LIVE = new Set([
    '/', '/products/', '/categories/', '/kategoriler/', '/odeme/', '/login/', '/register/', '/profile/', '/orders/',
    '/help/', '/policy/', '/shipping/', '/terms/',
])

const PRODUCT_PREFIXES = new Set(['urun', 'urunler', 'product', 'products', 'p', 'item', 'items', 'shop', 'magaza'])
const CATEGORY_PREFIXES = new Set(['kategori', 'kategoriler', 'category', 'categories', 'collections', 'collection', 'koleksiyon'])
const IMAGE_PREFIXES = new Set(['images', 'image', 'img', 'uploads', 'upload', 'storage', 'media', 'resimler', 'wp-content'])
const FILE_EXT = /\.([a-z0-9]{1,5})$/
const PAGE_EXT = /\.(html?|php|aspx?|jsp)$/
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|svg|avif)$/

// Words that say nothing about which product is meant (path words of the old platforms, the brand, connectors)
const STOPWORDS = new Set([
    've', 'ile', 'icin', 'for', 'and', 'the', 'with', 'onopo', 'html', 'htm', 'php', 'asp', 'aspx', 'index', 'www', 'com',
    'urun', 'urunler', 'product', 'products', 'kategori', 'category', 'collections', 'detay', 'tr',
])
// Tokens that name a different model: "iPhone 15" is not "iPhone 15 Pro Max", "Redmi 13" is not "Redmi Note 13"
const MODEL_WORDS = new Set(['pro', 'max', 'plus', 'mini', 'ultra', 'lite', 'fe', 'note', 'air', 'se', 'edge', 'prime'])

// Scanner noise and browser probes: neither resolved nor logged
const JUNK_PATH = /^\/(?:wp-|wordpress|cgi-bin|phpmyadmin|pma|xmlrpc|\.env|\.git|\.well-known|vendor\/|apple-touch-icon|favicon|ads\.txt|app-ads\.txt|sellers\.json|boaform|owa\/|autodiscover|ecp\/|remote\/|hnap1)/

// ---- normalization -----------------------------------------------------------------------------------

export interface ParsedPath {
    /** Decoded, lower-case path; directories end with '/', files (x.html, a.jpg) don't. */
    path: string
    /** The decoded path in its original case (R2 keys are case-sensitive). */
    rawPath: string
    /** Non-tracking query parameters, keys lower-case, sorted. */
    params: Array<[string, string]>
    /** path + '?' + params: the key of the redirects and not_found_log tables. */
    key: string
}

function decodeSafe(s: string): string {
    try { return decodeURIComponent(s) } catch { return s }
}

/**
 * Normalizes a URL or path to the form both tables are keyed by: our site only (onopostore.com / www, or a bare
 * path), percent-decoded, lower-case (Turkish İ → i), '//' collapsed, trailing slash on directories, tracking
 * parameters dropped, remaining parameters sorted. Null for other hosts, control characters and absurd lengths.
 */
export function parsePath(input: string | null | undefined): ParsedPath | null {
    let s = String(input ?? '').trim().replace(/^["'<]+|["'>]+$/g, '')
    if (!s || s.length > 2000) return null
    let url: URL
    try {
        if (/^[a-z][a-z0-9+.-]*:/i.test(s)) {
            url = new URL(s)
            if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
            if (!SITE_HOSTS.has(url.hostname.toLowerCase())) return null
        } else if (s.startsWith('//') || s.startsWith('/\\')) {
            return null
        } else if (s.startsWith('/')) {
            url = new URL(s, SITE_ORIGIN)
        } else if (/^(?:www\.)?onopostore\.com(?:[/?#]|$)/i.test(s)) {
            url = new URL(`https://${s}`)
        } else {
            return null
        }
    } catch {
        return null
    }
    const rawPath = decodeSafe(url.pathname)
    if (/[\u0000-\u001f\u007f]/.test(rawPath)) return null
    let path = rawPath.replace(/\\/g, '/').replace(/İ/g, 'i').toLowerCase().replace(/\/{2,}/g, '/')
    if (!path.startsWith('/')) path = `/${path}`
    const trimmed = path.replace(/\/+$/, '')
    const last = trimmed.slice(trimmed.lastIndexOf('/') + 1)
    if (last && FILE_EXT.test(last)) path = trimmed
    else if (!path.endsWith('/')) path += '/'
    if (path.length > 400) return null

    const params: Array<[string, string]> = []
    for (const [k, v] of url.searchParams) {
        const key = k.toLowerCase()
        if (!key || isTrackingParam(key)) continue
        if (/[\u0000-\u001f\u007f]/.test(v)) return null
        params.push([key, v])
    }
    params.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    const query = params.length ? `?${new URLSearchParams(params).toString()}` : ''
    if (path.length + query.length > 600) return null
    return { path, rawPath, params, key: path + query }
}

/** normalizePath('https://www.onopostore.com/Urun/Kılıf?utm_source=x') → '/urun/kılıf/' (null when not ours). */
export function normalizePath(input: string | null | undefined): string | null {
    return parsePath(input)?.key ?? null
}

/** Paths that are never redirected from (and never redirected to): the admin panel, APIs and Next internals. */
export function isProtectedPath(path: string): boolean {
    const p = path.toLowerCase()
    if (p === '/admin' || p.startsWith('/admin/')) return true
    if (p === '/api' || p.startsWith('/api/')) return !p.startsWith('/api/images/')
    if (p.startsWith('/_next/')) return !/^\/_next\/image\/?$/.test(p)
    return false
}

/** Probes and scanner noise (/wp-login.php, /.env, /apple-touch-icon.png …): not resolved, not logged. */
export function isJunkPath(path: string): boolean {
    return JUNK_PATH.test(path.toLowerCase())
}

// ---- target safety -----------------------------------------------------------------------------------

/**
 * A redirect target as stored and as sent: a same-site path ('/x/', decoded, normalized like parsePath, query
 * kept) or an https://images.onopostore.com/<key> URL. Anything else (other hosts, javascript:, '//evil',
 * '/\evil', /api, /admin) is null, so nothing can turn into an open redirect.
 */
export function safeTarget(raw: string | null | undefined): string | null {
    const s = String(raw ?? '').trim()
    if (!s || s.length > 1000) return null
    if (/^https?:\/\//i.test(s)) {
        let u: URL
        try { u = new URL(s) } catch { return null }
        if (u.hostname.toLowerCase() === IMAGE_HOST) {
            if (u.username || u.password || u.port) return null
            if (u.pathname.length < 2) return null
            return `${R2_PUBLIC_HOST}${u.pathname}`
        }
    }
    const parsed = parsePath(s)
    if (!parsed || isProtectedPath(parsed.path)) return null
    return parsed.key
}

/** The Location header for a safe target (paths are stored decoded: 'ç' → '%C3%A7'). */
export function toLocation(target: string): string {
    if (target.startsWith('https://')) return target
    const q = target.indexOf('?')
    const path = q < 0 ? target : target.slice(0, q)
    return encodeURI(path) + (q < 0 ? '' : target.slice(q))
}

// ---- tokens and scoring ------------------------------------------------------------------------------

/**
 * Search tokens of a product name or URL segment: Turkish-folded, split on everything but letters and digits,
 * "iphone15" → iphone 15, "15pro" → 15 pro, while model and spec codes stay whole ("s24", "a54", "9d", "20w").
 * Numbers are kept (they tell models apart); single letters and STOPWORDS are dropped; duplicates removed.
 */
export function tokenize(text: string | null | undefined): string[] {
    const folded = foldTr(String(text ?? ''))
        .replace(/([a-z]{3,})(\d)/g, '$1 $2')
        .replace(/(\d)([a-z]{3,})/g, '$1 $2')
    const out: string[] = []
    for (const t of folded.split(/[^a-z0-9]+/)) {
        if (!t || STOPWORDS.has(t)) continue
        if (t.length < 2 && !/^\d$/.test(t)) continue
        if (!out.includes(t)) out.push(t)
    }
    return out
}

function isNumber(t: string): boolean {
    return /^\d+$/.test(t)
}

function isModelToken(t: string): boolean {
    return isNumber(t) || MODEL_WORDS.has(t)
}

/**
 * 1 for the same token, 0.85 for the same Turkish stem (kılıf / kılıfı / kılıfları, kablo / kablosu: the shorter
 * one has ≥ 4 letters and the longer adds ≤ 5), 0 otherwise. Numbers only match exactly (15 ≠ 150).
 */
export function matchWeight(a: string, b: string): number {
    if (a === b) return 1
    if (isNumber(a) || isNumber(b)) return 0
    const [s, l] = a.length <= b.length ? [a, b] : [b, a]
    if (s.length >= 4 && l.startsWith(s) && l.length - s.length <= 5) return 0.85
    return 0
}

/**
 * How well the query tokens (an old URL segment) describe a candidate (a product or category), 0..1.
 * 0.65 × recall (idf-weighted share of the query found in the candidate) + 0.35 × precision (share of the
 * candidate the query covers), then × 0.75 for each model word of the candidate the query does not have
 * (Pro, Max, Note …), × 0.85 for each such number (13, but also specs like the 22 of "22.5W", hence milder) and
 * × 0.6 for each model word or number of the query the candidate lacks.
 */
export function scoreCandidate(query: string[], candidate: string[], idf: (t: string) => number): number {
    return scoreDetail(query, candidate, idf).score
}

export interface ScoreDetail {
    score: number
    /** idf-weighted share of the query found in the candidate (0..1). */
    recall: number
    /** Model words (Pro, Max, Note …) of the candidate that the query does not have. */
    extraModelWords: number
}

export function scoreDetail(query: string[], candidate: string[], idf: (t: string) => number): ScoreDetail {
    if (!query.length || !candidate.length) return { score: 0, recall: 0, extraModelWords: 0 }
    let qTotal = 0
    let qHit = 0
    const matched = new Map<string, number>()
    for (const t of query) {
        const w = idf(t)
        qTotal += w
        let best = 0
        let bestToken = ''
        for (const u of candidate) {
            const m = matchWeight(t, u)
            if (m > best) { best = m; bestToken = u }
        }
        qHit += w * best
        if (best > 0) matched.set(bestToken, Math.max(matched.get(bestToken) ?? 0, best))
    }
    let cTotal = 0
    let cHit = 0
    for (const u of candidate) {
        const w = idf(u)
        cTotal += w
        cHit += w * (matched.get(u) ?? 0)
    }
    const recall = qHit / qTotal
    let score = 0.65 * recall + 0.35 * (cHit / cTotal)
    let extraModelWords = 0
    for (const u of candidate) {
        if (!isModelToken(u) || matched.has(u)) continue
        if (isNumber(u)) score *= 0.85
        else { score *= 0.75; extraModelWords++ }
    }
    for (const t of query) if (isModelToken(t) && !candidate.includes(t)) score *= 0.6
    return { score: Math.round(score * 1000) / 1000, recall: Math.round(recall * 1000) / 1000, extraModelWords }
}

// ---- index -------------------------------------------------------------------------------------------

export interface IndexEntry {
    kind: 'product' | 'category'
    /** Product id (categories: 0). */
    id: number
    slug: string
    name: string
    tokens: string[]
    /** The live page: /<slug>/ or /kategori/<slug>/ (decoded). */
    path: string
}

export interface RedirectIndex {
    products: IndexEntry[]
    categories: IndexEntry[]
    productsBySlug: Map<string, IndexEntry>
    productsById: Map<number, IndexEntry>
    categoriesBySlug: Map<string, IndexEntry>
    /** CMS page slugs (lower-case). */
    pages: Set<string>
    /** Lower-case file name (and the name without the upload prefix "<ms>-<8 hex>-") → R2 key; null when ambiguous. */
    imageFiles: Map<string, string | null>
    /** Every R2 key referenced by a product (known to exist). */
    imageKeys: Set<string>
    idf: (t: string) => number
}

export interface IndexRows {
    products: Array<{ id: number | string; slug?: string | null; name?: string | null; is_active?: number | string | null; images?: string | null }>
    categories: Array<{ name?: string | null; slug?: string | null; product_count?: number | string | null }>
    pages: Array<{ slug?: string | null }>
}

/** Image references in products.images (a JSON array, or a comma list in very old rows). */
function imageRefs(raw: string | null | undefined): string[] {
    if (!raw) return []
    const s = String(raw).trim()
    if (s.startsWith('[')) {
        try {
            const arr = JSON.parse(s)
            return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
        } catch {
            return []
        }
    }
    return s.split(',').map(x => x.trim()).filter(Boolean)
}

/** Names an old file may have had: the key's file name, and the same without our upload prefix. */
export function imageFileNames(key: string): string[] {
    const file = key.slice(key.lastIndexOf('/') + 1).toLowerCase()
    const names = [file]
    const bare = file.replace(/^\d{10,}-[0-9a-f]{6,10}-/, '').replace(/^\d{10,}-/, '')
    if (bare && bare !== file) names.push(bare)
    return names
}

export function buildIndex(rows: IndexRows): RedirectIndex {
    const products: IndexEntry[] = []
    const productsBySlug = new Map<string, IndexEntry>()
    const productsById = new Map<number, IndexEntry>()
    const imageFiles = new Map<string, string | null>()
    const imageKeys = new Set<string>()
    for (const r of rows.products) {
        for (const ref of imageRefs(r.images)) {
            const key = imageKey(ref)
            if (!key || key.startsWith('v/')) continue
            imageKeys.add(key)
            for (const name of imageFileNames(key)) {
                const seen = imageFiles.get(name)
                imageFiles.set(name, seen === undefined || seen === key ? key : null)
            }
        }
        const active = r.is_active == null || Number(r.is_active) === 1
        const slug = String(r.slug ?? '').trim()
        if (!active || !slug) continue
        const entry: IndexEntry = {
            kind: 'product',
            id: Number(r.id),
            slug,
            name: String(r.name ?? ''),
            // Our slugs end in "-<id>": that number names nothing, so it is not a token
            tokens: tokenize(`${r.name ?? ''} ${slug.replace(new RegExp(`-${Number(r.id)}$`), '')}`),
            path: `/${slug.toLowerCase()}/`,
        }
        products.push(entry)
        productsBySlug.set(slug.toLowerCase(), entry)
        productsById.set(entry.id, entry)
    }
    const categories: IndexEntry[] = []
    const categoriesBySlug = new Map<string, IndexEntry>()
    for (const c of rows.categories) {
        const slug = String(c.slug ?? '').trim()
        if (!slug || Number(c.product_count ?? 0) <= 0) continue
        const entry: IndexEntry = {
            kind: 'category',
            id: 0,
            slug,
            name: String(c.name ?? ''),
            tokens: tokenize(`${c.name ?? ''} ${slug}`),
            path: `/kategori/${slug.toLowerCase()}/`,
        }
        categories.push(entry)
        categoriesBySlug.set(slug.toLowerCase(), entry)
    }
    const pages = new Set(rows.pages.map(p => String(p.slug ?? '').trim().toLowerCase()).filter(Boolean))

    // Inverse document frequency over all candidates: rare words (a model name) weigh more than "kılıf"
    const df = new Map<string, number>()
    const all = [...products, ...categories]
    for (const e of all) for (const t of e.tokens) df.set(t, (df.get(t) ?? 0) + 1)
    const n = all.length
    const idf = (t: string) => Math.log(1 + (n + 1) / (1 + (df.get(t) ?? 0)))

    return { products, categories, productsBySlug, productsById, categoriesBySlug, pages, imageFiles, imageKeys, idf }
}

// ---- matching ----------------------------------------------------------------------------------------

export interface Candidate extends ScoreDetail {
    entry: IndexEntry
}

/** Candidates ranked by score (ties: products before categories, then lower id, then slug), best first. */
export function rankCandidates(segment: string, entries: IndexEntry[], idf: (t: string) => number): Candidate[] {
    const query = tokenize(segment)
    if (!query.length) return []
    const out: Candidate[] = []
    for (const entry of entries) {
        const detail = scoreDetail(query, entry.tokens, idf)
        if (detail.score > 0) out.push({ entry, ...detail })
    }
    out.sort((a, b) =>
        b.score - a.score
        || (a.entry.kind === b.entry.kind ? 0 : a.entry.kind === 'product' ? -1 : 1)
        || a.entry.id - b.entry.id
        || (a.entry.slug < b.entry.slug ? -1 : a.entry.slug > b.entry.slug ? 1 : 0))
    return out
}

/**
 * The confident fuzzy match, or null. Products need at least two meaningful words in the query (a single
 * "kilif" fits dozens); a category may match on one. The best must reach AUTO_MIN_SCORE and lead the
 * runner-up by AUTO_MIN_MARGIN, or reach AUTO_WIDE_MIN_SCORE with a lead of AUTO_WIDE_MIN_MARGIN.
 * A runner-up that contains the query just as fully, and differs only by being longer (no extra Pro/Max/…), is
 * as good an answer: "10000 mah powerbank" fits both 10000 mAh power banks, so that is no guess either.
 */
export function fuzzyMatch(segment: string, entries: IndexEntry[], idf: (t: string) => number): Candidate | null {
    const query = tokenize(segment)
    const ranked = rankCandidates(segment, entries, idf)
    const best = ranked[0]
    if (!best) return null
    if (best.entry.kind === 'product' && query.length < 2) return null
    const second = ranked[1]
    if (second && second.recall >= best.recall && second.extraModelWords <= best.extraModelWords) return null
    const lead = best.score - (second?.score ?? 0)
    if (best.score >= AUTO_MIN_SCORE && lead >= AUTO_MIN_MARGIN) return best
    if (best.score >= AUTO_WIDE_MIN_SCORE && lead >= AUTO_WIDE_MIN_MARGIN) return best
    return null
}

// ---- resolution --------------------------------------------------------------------------------------

export type ResolveVia = 'admin' | 'pattern' | 'fuzzy'

export type ResolveResult =
    /** checked: the target's existence was verified directly (a static file), not through the index.
     *  from: the redirects row used (via 'admin'), for its hit counter. */
    | { target: string; via: ResolveVia; rule: string; label?: string; score?: number; checked?: boolean; from?: string }
    /** An admin redirect exists but its target is gone: no redirect (worker logs it). */
    | { target: null; problem: 'admin-target-gone'; from: string; to: string }

export interface ResolveDeps {
    index: RedirectIndex
    /** to_path of the admin redirect for this exact key, if any. */
    adminRedirect?: (key: string) => Promise<string | null>
    /** Whether an R2 object with this key exists (old image names guessed from a URL). */
    imageExists?: (key: string) => Promise<boolean>
    /** Whether a static file of the site exists (public/ files such as /logo.png, served from the assets). */
    assetExists?: (path: string) => Promise<boolean>
}

/** Whether a (safe) target is a page that answers today, judged from the index. */
export function isLiveTarget(target: string, index: RedirectIndex): boolean {
    if (target.startsWith(`${R2_PUBLIC_HOST}/`)) return true
    const parsed = parsePath(target)
    if (!parsed || isProtectedPath(parsed.path)) return false
    const p = parsed.path
    if (STATIC_LIVE.has(p)) return true
    let m = /^\/kategori\/([^/]+)\/$/.exec(p)
    if (m) return index.categoriesBySlug.has(m[1])
    m = /^\/page\/([^/]+)\/$/.exec(p)
    if (m) return index.pages.has(m[1])
    m = /^\/product\/(\d{1,10})\/$/.exec(p)
    if (m) return index.productsById.has(Number(m[1]))
    m = /^\/([^/]+)\/$/.exec(p)
    if (m) return index.productsBySlug.has(m[1])
    return false
}

function encodeKey(key: string): string {
    return key.split('/').map(encodeURIComponent).join('/')
}

function imageUrl(key: string): string {
    return `${R2_PUBLIC_HOST}/${encodeKey(key)}`
}

/** An image key from a /_next/image url= value, or a same-site local path to look at, or null (foreign). */
function nextImageSource(raw: string): { key: string } | { local: string } | null {
    let v = raw.trim()
    // Some crawlers double-encode the parameter
    if (/^%2f|^https?%3a/i.test(v)) v = decodeSafe(v)
    if (/^https?:\/\//i.test(v) || v.startsWith('//')) {
        let u: URL
        try { u = new URL(v.startsWith('//') ? `https:${v}` : v) } catch { return null }
        const host = u.hostname.toLowerCase()
        if (host === IMAGE_HOST || /^pub-[a-z0-9]+\.r2\.dev$/.test(host)) {
            const key = decodeSafe(u.pathname.slice(1))
            return key ? { key } : null
        }
        if (SITE_HOSTS.has(host)) v = u.pathname
        else return null
    }
    if (!v.startsWith('/') || v.startsWith('//')) return null
    const path = v.split(/[?#]/)[0]
    if (path.startsWith('/api/images/')) {
        const key = decodeSafe(path.slice('/api/images/'.length))
        return key ? { key } : null
    }
    return { local: path }
}

/**
 * Image targets: the first key that exists. Keys referenced by a product are known to exist; other guesses
 * (the old file name used as a key) are checked with imageExists (at most two R2 HEADs per request).
 */
async function resolveImage(keys: string[], deps: ResolveDeps, rule: string): Promise<ResolveResult | null> {
    const { index } = deps
    const tried = new Set<string>()
    let heads = 0
    const tryKey = async (key: string): Promise<boolean> => {
        if (!key || tried.has(key) || key.includes('..')) return false
        tried.add(key)
        if (index.imageKeys.has(key)) return true
        if (!deps.imageExists || heads >= 2) return false
        heads++
        try { return await deps.imageExists(key) } catch { return false }
    }
    for (const key of keys) {
        if (await tryKey(key)) return { target: imageUrl(key), via: 'pattern', rule }
    }
    for (const key of keys) {
        const file = key.slice(key.lastIndexOf('/') + 1).toLowerCase()
        if (!file) continue
        for (const name of imageFileNames(file)) {
            const hit = index.imageFiles.get(name)
            if (hit) return { target: imageUrl(hit), via: 'pattern', rule }
        }
    }
    return null
}

function productResult(entry: IndexEntry, via: ResolveVia, rule: string, score?: number): ResolveResult {
    return { target: entry.path, via, rule, label: entry.name, ...(score !== undefined ? { score } : {}) }
}

/**
 * Trailing ids of old product slugs: "kilif-p-123" (always an id) and "kilif-123" (3+ digits, an id only if the
 * words fit; "iphone-15" ends in a model number, and our own slugs in their product id: "…-adaptor-a1-401").
 */
function splitTrailingId(slug: string): { rest: string; id: number | null; strong: boolean } {
    let m = /^(?:(.*)-)?p-(\d{1,9})$/.exec(slug)
    if (m) return { rest: m[1] ?? '', id: Number(m[2]), strong: true }
    m = /^(.+)-(\d{3,9})$/.exec(slug)
    if (m) return { rest: m[1], id: Number(m[2]), strong: false }
    return { rest: slug, id: null, strong: false }
}

function fuzzyResult(segment: string, pool: IndexEntry[], index: RedirectIndex): ResolveResult | null {
    const hit = fuzzyMatch(segment, pool, index.idf)
    if (!hit) return null
    return productResult(hit.entry, 'fuzzy', hit.entry.kind === 'product' ? 'product-fuzzy' : 'category-fuzzy', hit.score)
}

/**
 * A product named by an old URL segment: exact slug, then a trailing id that agrees with the words before it
 * ("-p-<n>" is trusted unless the words clearly name another product; a bare "-<n>" only when the words fit
 * well), then the fuzzy match over `pool` (with, then without the trailing number).
 * Old platforms' ids may not be ours: an id alone is only trusted where the URL has nothing else (query ids,
 * /urun/<n>/), and here only when the words agree.
 */
function matchProductSegment(segment: string, index: RedirectIndex, pool: IndexEntry[] = index.products): ResolveResult | null {
    const exact = index.productsBySlug.get(segment)
    if (exact) return productResult(exact, 'pattern', 'slug')
    const { rest, id, strong } = splitTrailingId(segment)
    if (id !== null) {
        const byId = index.productsById.get(id)
        const words = tokenize(rest)
        if (byId) {
            const fit = words.length ? scoreCandidate(words, byId.tokens, index.idf) : (strong ? 1 : 0)
            if (fit >= (strong ? 0.4 : 0.6)) return productResult(byId, 'pattern', 'id')
        }
        const restExact = rest ? index.productsBySlug.get(rest) : undefined
        if (restExact) return productResult(restExact, 'pattern', 'slug')
        if (strong) {
            const other = rest ? fuzzyResult(rest, pool, index) : null
            if (other || !byId) return other
            // Words that name nothing in particular ("eski-ad-p-401") do not overrule the id
            const closest = rankCandidates(rest, pool, index.idf)[0]
            return !closest || closest.score < 0.5 ? productResult(byId, 'pattern', 'id') : null
        }
        return fuzzyResult(segment, pool, index) ?? fuzzyResult(rest, pool, index)
    }
    return fuzzyResult(segment, pool, index)
}

function matchCategorySegment(segment: string, index: RedirectIndex): ResolveResult | null {
    const exact = index.categoriesBySlug.get(segment)
    if (exact) return productResult(exact, 'pattern', 'category')
    const fuzzy = fuzzyMatch(segment, index.categories, index.idf)
    return fuzzy ? productResult(fuzzy.entry, 'fuzzy', 'category-fuzzy', fuzzy.score) : null
}

function idParam(params: Array<[string, string]>): number | null {
    for (const name of ['product_id', 'products_id', 'productid', 'urun_id', 'id', 'pid']) {
        const hit = params.find(([k]) => k === name)
        if (hit && /^\d{1,9}$/.test(hit[1].trim())) return Number(hit[1].trim())
    }
    return null
}

/** The pattern and fuzzy rules (no admin table, no loop check). */
async function resolveRules(parsed: ParsedPath, deps: ResolveDeps): Promise<ResolveResult | null> {
    const { index } = deps
    const { path, params } = parsed
    const segments = path.split('/').filter(Boolean)
    const first = segments[0] ?? ''
    const lastRaw = segments[segments.length - 1] ?? ''
    // The original-case file name / key (R2 keys are case-sensitive), then the lower-case one
    const rawSegments = parsed.rawPath.split('/').filter(Boolean)
    const fileKeys = (lower: string) => {
        const raw = rawSegments[rawSegments.length - 1] ?? ''
        return raw.toLowerCase() === lower ? [raw, lower] : [lower]
    }

    // /_next/image?url=…: the image itself (our image host or our own path only)
    if (/^\/_next\/image\/?$/.test(path)) {
        const raw = params.find(([k]) => k === 'url')?.[1]
        if (!raw) return null
        const src = nextImageSource(raw)
        if (!src) return null
        if ('key' in src) return resolveImage([src.key], deps, 'next-image')
        const local = parsePath(src.local)
        if (!local || isProtectedPath(local.path) || /^\/_next\//.test(local.path)) return null
        const file = local.path.slice(local.path.lastIndexOf('/') + 1)
        if (!IMAGE_EXT.test(file)) return null
        const rawLocal = decodeSafe(src.local)
        if (deps.assetExists && /^\/[\w\-./]+$/.test(rawLocal) && !rawLocal.includes('..')) {
            try {
                if (await deps.assetExists(rawLocal)) return { target: rawLocal, via: 'pattern', rule: 'next-image', checked: true }
            } catch { /* treated as missing */ }
        }
        return resolveImage([rawLocal.slice(rawLocal.lastIndexOf('/') + 1)], deps, 'old-image')
    }

    // /api/images/<key> that R2 does not have (double-encoded, or an old file name)
    if (path.startsWith('/api/images/')) {
        const key = parsed.rawPath.replace(/^\/api\/images\//i, '').replace(/\/$/, '')
        return key ? resolveImage([key, decodeSafe(key), key.toLowerCase()], deps, 'api-image') : null
    }

    // /images/<file>, /uploads/<file>, /storage/<file>, /wp-content/uploads/…, any *.jpg: the R2 original by
    // file name (IMAGE_PREFIXES only document the usual places; the file name is what is looked up)
    if (IMAGE_EXT.test(lastRaw)) return resolveImage(fileKeys(lastRaw), deps, 'old-image')

    // index.php?route=product/product&product_id=12, /urun.php?id=12, /?id=12
    const qid = idParam(params)
    if (qid !== null) {
        const byId = index.productsById.get(qid)
        if (byId) return productResult(byId, 'pattern', 'query-id')
    }

    const last = lastRaw.replace(PAGE_EXT, '')
    if (!last || last === 'index') return null

    // /kategori/<x>/ (old or nested slug), /category/<x>/, /collections/<x>/
    if (CATEGORY_PREFIXES.has(first) && segments.length >= 2) {
        return matchCategorySegment(last, index)
            ?? (segments.length > 2 ? matchCategorySegment(segments[1].replace(PAGE_EXT, ''), index) : null)
    }

    // /urun/<slug>/, /product/<slug>/, /products/<slug>/, /p/<slug>/, /urun/<id>/
    if (PRODUCT_PREFIXES.has(first) && segments.length >= 2) {
        if (/^\d{1,9}$/.test(last)) {
            const byId = index.productsById.get(Number(last))
            return byId ? productResult(byId, 'pattern', 'path-id') : null
        }
        return matchProductSegment(last, index)
    }

    // /<slug>.html, /<anything>/<slug>/: exact product, category or CMS page, then the fuzzy match over both
    const product = index.productsBySlug.get(last)
    if (product) return productResult(product, 'pattern', 'slug')
    const category = index.categoriesBySlug.get(last)
    if (category) return productResult(category, 'pattern', 'category')
    if (index.pages.has(last)) return { target: `/page/${last}/`, via: 'pattern', rule: 'page' }
    if (/^\d+$/.test(last)) return null
    return matchProductSegment(last, index, [...index.products, ...index.categories])
}

/**
 * Where a URL that answers 404 should go, or null (keep the 404). Admin redirects first, then the rules.
 * Targets are always live and never the request itself (one hop, no loops).
 */
export async function resolvePath(input: string, deps: ResolveDeps): Promise<ResolveResult | null> {
    const parsed = parsePath(input)
    if (!parsed || isProtectedPath(parsed.path) || isJunkPath(parsed.path)) return null

    if (deps.adminRedirect) {
        const keys = parsed.key === parsed.path ? [parsed.key] : [parsed.key, parsed.path]
        for (const key of keys) {
            const to = await deps.adminRedirect(key)
            if (to == null) continue
            const target = safeTarget(to)
            if (target && target !== parsed.key && target !== parsed.path && isLiveTarget(target, deps.index)) {
                return { target, via: 'admin', rule: 'admin', from: key }
            }
            return { target: null, problem: 'admin-target-gone', from: key, to }
        }
    }

    const result = await resolveRules(parsed, deps)
    if (!result || !result.target) return null
    // A static file keeps its case (/Logo.png); everything else is a normalized path or an image URL
    const target = result.checked ? result.target : safeTarget(result.target)
    if (!target || target === parsed.key || target === parsed.path) return null
    if (!result.checked && !isLiveTarget(target, deps.index)) return null
    return { ...result, target }
}

export interface Suggestion {
    target: string
    label: string
    score: number
    /** 'auto': the site already redirects this URL by itself (pattern or confident fuzzy match). */
    kind: 'auto' | 'suggested'
}

/**
 * For the admin: what the site does with this URL now ('auto' when resolvePath redirects it), else the best
 * looser fuzzy candidates (score ≥ SUGGEST_MIN_SCORE) for the admin to confirm. Up to `limit` suggestions.
 */
export async function suggestTargets(input: string, deps: ResolveDeps, limit = 3): Promise<Suggestion[]> {
    const parsed = parsePath(input)
    if (!parsed || isProtectedPath(parsed.path) || isJunkPath(parsed.path)) return []
    const auto = await resolvePath(parsed.key, { index: deps.index, imageExists: deps.imageExists })
    const out: Suggestion[] = []
    if (auto && auto.target) out.push({ target: auto.target, label: auto.label ?? auto.target, score: auto.score ?? 1, kind: 'auto' })
    const segments = parsed.path.split('/').filter(Boolean)
    const last = (segments[segments.length - 1] ?? '').replace(PAGE_EXT, '')
    if (!last || IMAGE_EXT.test(last)) return out
    const { rest, strong } = splitTrailingId(last)
    const first = segments[0] ?? ''
    const pool = CATEGORY_PREFIXES.has(first) ? deps.index.categories
        : PRODUCT_PREFIXES.has(first) ? deps.index.products
        : [...deps.index.products, ...deps.index.categories]
    for (const c of rankCandidates(strong ? rest : last, pool, deps.index.idf)) {
        if (out.length >= limit || c.score < SUGGEST_MIN_SCORE) break
        if (out.some(s => s.target === c.entry.path)) continue
        out.push({ target: c.entry.path, label: c.entry.name, score: c.score, kind: 'suggested' })
    }
    return out
}

// ---- which responses worker.ts looks at ----------------------------------------------------------------

/** First segments of the old platforms' URLs (used to skip Next's extra trailing-slash hop for them). */
export function isLegacyPattern(pathname: string): boolean {
    const p = pathname.toLowerCase()
    const first = p.split('/').filter(Boolean)[0] ?? ''
    return PRODUCT_PREFIXES.has(first) && first !== 'products'
        || ['category', 'collections', 'collection', 'koleksiyon', 'kategori'].includes(first) && p.split('/').filter(Boolean).length >= 2
        || IMAGE_PREFIXES.has(first)
}

/**
 * The path worker.ts should try to resolve for this response, or null to send the response as it is:
 * - a 404 for a GET/HEAD of a page (not /api except /api/images/<key>, not /admin, not Next internals);
 * - any 4xx/5xx of /_next/image (Next answers bad image URLs with 400);
 * - Next's trailing-slash redirect of a legacy-looking path (/urun/x → /urun/x/): resolving the slashed path
 *   right away saves the visitor (and Google) a hop. If that does not resolve, the 308 is sent unchanged.
 * Client-side (RSC) navigations are left alone.
 */
export function notFoundCandidate(method: string, url: URL, status: number, location: string | null, isRsc: boolean): string | null {
    if ((method !== 'GET' && method !== 'HEAD') || isRsc) return null
    const path = url.pathname
    if (/^\/_next\/image\/?$/.test(path)) return status >= 400 ? path + url.search : null
    if (isProtectedPath(path)) return null
    if (status === 404) return path + url.search
    if ((status === 308 || status === 301) && location && !path.endsWith('/') && isLegacyPattern(path)) {
        let to: URL
        try { to = new URL(location, url) } catch { return null }
        if (to.origin === url.origin && to.pathname === `${path}/` && to.search === url.search) return to.pathname + to.search
    }
    return null
}

const GOOGLEBOT = /googlebot|google-inspectiontool|googleother|storebot-google|adsbot-google|mediapartners-google/i

/** 'googlebot' / 'visitor' for 404s worth counting, null for other bots and empty user agents. */
export function notFoundVisitorKind(userAgent: string | null | undefined): 'googlebot' | 'visitor' | null {
    const ua = String(userAgent ?? '')
    if (!ua) return null
    if (GOOGLEBOT.test(ua)) return 'googlebot'
    return BOT_USER_AGENT.test(ua) ? null : 'visitor'
}

/** Only the host of the Referer (no path, no query: it may carry personal data). */
export function referrerHost(referer: string | null | undefined): string | null {
    if (!referer) return null
    try {
        const host = new URL(referer).hostname.toLowerCase()
        return host && host.length <= 100 ? host : null
    } catch {
        return null
    }
}

/**
 * Pulls the URLs out of a pasted list or a Search Console CSV export ("URL,Last crawled" / "URL,Son tarama"):
 * every http(s) URL, plus lines that start with '/'. Duplicates (after normalization) and other sites dropped.
 */
export function extractUrls(text: string, max = 2000): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    const add = (raw: string) => {
        const cleaned = raw.replace(/[),.;]+$/, '')
        const key = normalizePath(cleaned)
        if (!key || seen.has(key) || out.length >= max) return
        seen.add(key)
        out.push(cleaned)
    }
    for (const line of String(text ?? '').split(/\r?\n/)) {
        const urls = line.match(/https?:\/\/[^\s",;<>]+/gi)
        if (urls) urls.forEach(add)
        else {
            const t = line.trim().replace(/^"|"$/g, '').split(/[",;\t]/)[0].trim()
            if (t.startsWith('/') && !t.startsWith('//')) add(t)
        }
    }
    return out
}

// ---- D1 ----------------------------------------------------------------------------------------------

export interface RedirectsStmt {
    bind(...values: unknown[]): RedirectsStmt
    run(): Promise<unknown>
    all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>
    first<T = Record<string, unknown>>(): Promise<T | null>
}
export interface RedirectsDb {
    prepare(sql: string): RedirectsStmt
}

/** Same statements as schema.sql (which runs on deploy); here so a fresh database works before that. */
export const REDIRECT_TABLES = [
    `CREATE TABLE IF NOT EXISTS redirects (
    from_path TEXT PRIMARY KEY,
    to_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hits INTEGER NOT NULL DEFAULT 0,
    last_hit_at TEXT,
    note TEXT
)`,
    `CREATE TABLE IF NOT EXISTS not_found_log (
    path TEXT PRIMARY KEY,
    hits INTEGER NOT NULL DEFAULT 0,
    googlebot_hits INTEGER NOT NULL DEFAULT 0,
    first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_referrer_host TEXT,
    ignored INTEGER NOT NULL DEFAULT 0
)`,
    'CREATE INDEX IF NOT EXISTS idx_not_found_log_hits ON not_found_log(ignored, hits)',
    'CREATE INDEX IF NOT EXISTS idx_not_found_log_seen ON not_found_log(last_seen)',
]

// Resolved values only (never a promise shared between requests: a Worker may not await another request's I/O)
let tablesReady = false

/** CREATE … IF NOT EXISTS once per isolate (retried on the next call after a failure). */
export async function ensureRedirectTables(db: RedirectsDb): Promise<void> {
    if (tablesReady) return
    for (const sql of REDIRECT_TABLES) await db.prepare(sql).run()
    tablesReady = true
}

let indexMemo: { index: RedirectIndex; at: number } | null = null

/** Reads what buildIndex() needs (four small queries, run together). */
export async function readIndexRows(db: RedirectsDb): Promise<IndexRows> {
    const [products, categories, pages] = await Promise.all([
        db.prepare('SELECT id, slug, name, is_active, images FROM products').all<IndexRows['products'][number]>(),
        db.prepare(
            `SELECT c.name, c.slug,
                (SELECT COUNT(*) FROM products p WHERE (LOWER(p.category) = LOWER(c.name) OR LOWER(p.category) = LOWER(c.slug)) AND p.is_active = 1) AS product_count
             FROM categories c`,
        ).all<IndexRows['categories'][number]>(),
        db.prepare('SELECT slug FROM pages').all<IndexRows['pages'][number]>().catch(() => ({ results: [] })),
    ])
    return { products: products.results ?? [], categories: categories.results ?? [], pages: pages.results ?? [] }
}

/**
 * The index, rebuilt at most every INDEX_TTL_MS per isolate (fresh: rebuild now, for the admin screens).
 * A failed rebuild keeps serving the previous index; with none, the error is thrown.
 */
export async function loadIndex(db: RedirectsDb, opts: { fresh?: boolean; now?: number } = {}): Promise<RedirectIndex> {
    const now = opts.now ?? Date.now()
    if (!opts.fresh && indexMemo && now - indexMemo.at < INDEX_TTL_MS) return indexMemo.index
    try {
        const index = buildIndex(await readIndexRows(db))
        indexMemo = { index, at: now }
        return index
    } catch (error) {
        if (indexMemo) return indexMemo.index
        throw error
    }
}

export async function lookupAdminRedirect(db: RedirectsDb, key: string): Promise<string | null> {
    const row = await db.prepare('SELECT to_path FROM redirects WHERE from_path = ?').bind(key).first<{ to_path: string }>()
    return row ? String(row.to_path) : null
}

export async function recordRedirectHit(db: RedirectsDb, key: string): Promise<void> {
    await db.prepare('UPDATE redirects SET hits = hits + 1, last_hit_at = CURRENT_TIMESTAMP WHERE from_path = ?').bind(key).run()
}

/**
 * Counts a 404 (path key, hits, Googlebot hits, first/last seen, referrer host only). Roughly every 50th
 * write trims the table to NOT_FOUND_LOG_MAX_ROWS, least recently seen first.
 */
export async function recordNotFound(db: RedirectsDb, key: string, info: { googlebot: boolean; referrerHost: string | null }, random = Math.random()): Promise<void> {
    await db
        .prepare(
            `INSERT INTO not_found_log (path, hits, googlebot_hits, first_seen, last_seen, last_referrer_host)
             VALUES (?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
             ON CONFLICT(path) DO UPDATE SET
                hits = hits + 1,
                googlebot_hits = googlebot_hits + excluded.googlebot_hits,
                last_seen = CURRENT_TIMESTAMP,
                last_referrer_host = COALESCE(excluded.last_referrer_host, last_referrer_host)`,
        )
        .bind(key, info.googlebot ? 1 : 0, info.referrerHost)
        .run()
    if (random < 0.02) await trimNotFoundLog(db)
}

export async function trimNotFoundLog(db: RedirectsDb, max = NOT_FOUND_LOG_MAX_ROWS): Promise<void> {
    const row = await db.prepare('SELECT COUNT(*) AS n FROM not_found_log').first<{ n: number }>()
    const extra = Number(row?.n ?? 0) - max
    if (extra <= 0) return
    await db
        .prepare('DELETE FROM not_found_log WHERE path IN (SELECT path FROM not_found_log ORDER BY last_seen ASC, hits ASC LIMIT ?)')
        .bind(extra)
        .run()
}

// ---- admin (Admin › Yönlendirmeler) ----------------------------------------------------------------------

export type RedirectValidation =
    | { ok: true; from: string; to: string }
    | { ok: false; error: string }

/**
 * Checks an admin redirect before it is saved. The old address must be ours and must not open today (a
 * redirect only runs where the site would answer 404, so a live page would never be redirected anyway); the
 * new address must be a live page of the site or an image on images.onopostore.com. Because a source never
 * opens and a target always does, a target can never be another redirect's source: no chains, no loops.
 * Messages are for the shop owner (plain Turkish).
 */
export function validateRedirect(fromInput: string, toInput: string, index: RedirectIndex): RedirectValidation {
    const from = parsePath(fromInput)
    if (!from) return { ok: false, error: 'Eski adres bu siteye ait bir adres olmalı (ör. /urun/eski-ad/ ya da https://onopostore.com/...).' }
    if (isProtectedPath(from.path)) return { ok: false, error: '/admin ve /api ile başlayan adresler yönlendirilemez.' }
    if (from.path === '/' && !from.params.length) return { ok: false, error: 'Ana sayfa yönlendirilemez.' }
    if (isJunkPath(from.path)) return { ok: false, error: 'Bu adres yönlendirilemez (tarayıcıların ve botların kendi istediği bir dosya).' }
    if (isLiveTarget(from.key, index)) {
        return { ok: false, error: 'Bu adres sitede zaten açılıyor. Yönlendirme yalnızca açılmayan (bulunamayan) adreslerde çalışır.' }
    }
    if (!String(toInput ?? '').trim()) return { ok: false, error: 'Yeni adresi yazın.' }
    const to = safeTarget(toInput)
    if (!to) return { ok: false, error: 'Yeni adres bu sitenin bir sayfası olmalı (ör. /urun-adi/ ya da https://onopostore.com/kategori/...).' }
    if (to === from.key || to === from.path) return { ok: false, error: 'Eski ve yeni adres aynı olamaz.' }
    if (!isLiveTarget(to, index)) {
        return { ok: false, error: 'Yeni adres sitede bulunamadı. Ürün, kategori ya da sayfa adresini kontrol edin (pasif ürünler ve ürünsüz kategoriler açılmaz).' }
    }
    return { ok: true, from: from.key, to }
}

export type UrlStatus =
    /** Not an address of this site (or unreadable). */
    | 'invalid'
    /** /admin, /api, scanner noise: never redirected. */
    | 'protected'
    /** Opens today: nothing to do. */
    | 'live'
    /** An admin redirect exists. */
    | 'has-redirect'
    /** The site already redirects it by itself (pattern or confident match). */
    | 'auto'
    /** Not redirected yet; a likely target is suggested for the admin to confirm. */
    | 'suggested'
    /** Not redirected and no good guess. */
    | 'none'

export interface UrlReport {
    input: string
    path: string | null
    status: UrlStatus
    /** has-redirect: the saved target. */
    current?: string
    suggestions: Suggestion[]
}

/** What the site does with one address from a Search Console list, and what it could do. */
export async function classifyUrl(input: string, deps: ResolveDeps & { existing?: (key: string) => string | null }): Promise<UrlReport> {
    const parsed = parsePath(input)
    if (!parsed) return { input, path: null, status: 'invalid', suggestions: [] }
    const base = { input, path: parsed.key }
    if (isProtectedPath(parsed.path) || isJunkPath(parsed.path)) return { ...base, status: 'protected', suggestions: [] }
    const current = deps.existing?.(parsed.key) ?? (parsed.key !== parsed.path ? deps.existing?.(parsed.path) : null) ?? null
    if (current) return { ...base, status: 'has-redirect', current, suggestions: [] }
    if (isLiveTarget(parsed.key, deps.index)) return { ...base, status: 'live', suggestions: [] }
    const suggestions = await suggestTargets(parsed.key, deps)
    const status: UrlStatus = suggestions[0]?.kind === 'auto' ? 'auto' : suggestions.length ? 'suggested' : 'none'
    return { ...base, status, suggestions }
}
