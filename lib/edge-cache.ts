// Edge policy used by worker.ts: canonical-host redirects and a deliberately conservative edge cache
// (Workers Cache API) for anonymous GETs of an allowlist of public pages and JSON.
// Pure functions only, so the rules can be unit-tested without the Workers runtime.
//
// Cache rules (all must hold, otherwise the response is passed through and marked BYPASS):
//   - GET, no auth_token cookie, no Authorization header, not a Next RSC/prefetch/server-action request
//   - path on the allowlist below and not on the deny list
//   - origin answered 200, without Set-Cookie, with a cacheable content type and no explicit
//     'private' / 'no-store' (the Next.js default header of dynamic pages is not an explicit opt-out)
//   - HTML only: the body has no data-onopo-nocache marker, and a /<slug>/ page contains the product
//     page's id="product-info" block (isStorableBody)
// Entries live for EDGE_CACHE_TTL_SECONDS. The key contains the deployed build id and the content
// version (site_settings.cache_version), which worker.ts bumps after every successful admin/content write
// and after the daily price cron, so edits show up at once (within the ~10 s version memo per isolate).

// Set to false to switch the edge cache off completely (every response is then BYPASS).
export const EDGE_CACHE_ENABLED = true

export const EDGE_CACHE_TTL_SECONDS = 600
export const CACHE_VERSION_MEMO_MS = 10_000
export const CACHE_HEADER = 'x-onopo-cache'
export const CANONICAL_HOST = 'onopostore.com'

// Hosts that get the http->https and www->apex redirect. Anything else (127.0.0.1, workers.dev,
// preview URLs) is left alone.
const REDIRECT_HOSTS = new Set([CANONICAL_HOST, `www.${CANONICAL_HOST}`])

// Crawler files served on www as they are: the Akakçe bot reads https://www.onopostore.com/sitemap.xml
// (HEAD + GET) and may not follow a redirect
const CRAWLER_FILES = new Set(['/sitemap.xml', '/robots.txt'])

/**
 * 301 target for http:// and www requests, or null.
 * Only GET/HEAD outside /api/: PayTR and BirFatura callbacks, the Google Merchant feed fetch from www
 * and customers' checkout POSTs on www must keep working untouched.
 * /sitemap.xml and /robots.txt stay on the host they were asked on (only http is upgraded to https).
 */
export function canonicalRedirect(url: URL, method: string): string | null {
    if (method !== 'GET' && method !== 'HEAD') return null
    if (!REDIRECT_HOSTS.has(url.hostname)) return null
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return null
    if (CRAWLER_FILES.has(url.pathname)) {
        if (url.protocol === 'https:' && !url.port) return null
        return `https://${url.hostname}${url.pathname}${url.search}`
    }
    if (url.protocol === 'https:' && url.hostname === CANONICAL_HOST && !url.port) return null
    return `https://${CANONICAL_HOST}${url.pathname}${url.search}`
}

export function hasAuthCookie(cookieHeader: string | null): boolean {
    return !!cookieHeader && /(?:^|;\s*)auth_token=/.test(cookieHeader)
}

// Never cached, whatever the other rules say
const DENY = [
    /^\/api\/(orders|auth|birfatura|payment|cron|analytics|favorites|user|installment-token|admin)/,
    /^\/(admin|odeme|profile|orders|login|register|siparis-)/,
]

// Single-segment paths that are not product pages
const RESERVED_SEGMENTS = new Set(['admin', 'odeme', 'profile', 'orders', 'login', 'register', 'api', 'maintenance', 'categories'])

const PAGE_ALLOW = [
    /^\/$/,
    /^\/products\/?$/,
    /^\/kategori\/[a-z0-9-]+(\/[a-z0-9-]+)*\/?$/,
    /^\/page\/[a-z0-9-]+\/?$/,
    /^\/(help|policy|shipping|terms)\/?$/,
    /^\/product\/\d+\/?$/,
    /^\/sitemap\.xml$/,
    /^\/robots\.txt$/,
]

// Product pages /<slug>/ (slugs are lowercase a-z, 0-9 and '-')
const PRODUCT_SLUG = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/

// Single-segment pages on PAGE_ALLOW that are not product pages
const NON_PRODUCT_PAGES = new Set(['products', 'help', 'policy', 'shipping', 'terms'])

const API_ALLOW = [
    /^\/api\/categories\/?$/,
    /^\/api\/menus\/?$/,
    /^\/api\/hero\/?$/,
    /^\/api\/hero-slides\/?$/,
    /^\/api\/homepage-sections\/?$/,
    /^\/api\/shipping-settings\/?$/,
    /^\/api\/site-settings\/public\/?$/,
    /^\/api\/products\/?$/,
    /^\/api\/product-page-data\/\d+\/?$/,
]

// Query parameters that only admin screens use: such requests are never cached
const ADMIN_PARAMS = ['includeAll']

// Tracking parameters that don't change the response; dropped from the cache key
const IGNORED_PARAMS = /^(utm_[a-z_]+|fbclid|gclid|gbraid|wbraid|msclkid|yclid)$/i

// Requests made by the Next.js client router (RSC payloads share the page URL) or server actions
const NEXT_INTERNAL_HEADERS = ['rsc', 'next-router-prefetch', 'next-router-state-tree', 'next-router-segment-prefetch', 'next-action', 'x-prerender-revalidate']

export function isCacheablePath(pathname: string): boolean {
    if (DENY.some(re => re.test(pathname))) return false
    if (PAGE_ALLOW.some(re => re.test(pathname))) return true
    if (API_ALLOW.some(re => re.test(pathname))) return true
    const slug = PRODUCT_SLUG.exec(pathname)
    return !!slug && !RESERVED_SEGMENTS.has(slug[1])
}

export interface RequestLike {
    method: string
    url: URL
    headers: { get(name: string): string | null, has(name: string): boolean }
}

export function isCacheableRequest(req: RequestLike): boolean {
    if (!EDGE_CACHE_ENABLED) return false
    if (req.method !== 'GET') return false
    if (hasAuthCookie(req.headers.get('cookie'))) return false
    if (req.headers.has('authorization')) return false
    if (NEXT_INTERNAL_HEADERS.some(h => req.headers.has(h))) return false
    if (req.url.searchParams.has('_rsc')) return false
    if (ADMIN_PARAMS.some(p => req.url.searchParams.has(p))) return false
    return isCacheablePath(req.url.pathname)
}

// The header Next.js puts on every dynamically rendered page; it means "dynamic", not "personal"
const NEXT_DYNAMIC_DEFAULT = 'private, no-cache, no-store, max-age=0, must-revalidate'

const CACHEABLE_TYPES = /^(text\/html|application\/json|application\/xml|text\/xml|text\/plain)\b/i

export interface ResponseLike {
    status: number
    headers: { get(name: string): string | null, has(name: string): boolean }
}

export function isStorableResponse(res: ResponseLike): boolean {
    if (res.status !== 200) return false
    if (res.headers.has('set-cookie')) return false
    if ((res.headers.get('vary') || '').includes('*')) return false
    if (!CACHEABLE_TYPES.test(res.headers.get('content-type') || '')) return false
    const cacheControl = (res.headers.get('cache-control') || '').trim().toLowerCase()
    if (cacheControl && cacheControl !== NEXT_DYNAMIC_DEFAULT && /(^|[\s,])(private|no-store)([\s,=]|$)/.test(cacheControl)) {
        return false
    }
    return true
}

// Pages that must never be stored (error states, client-side fallbacks after a data failure, maintenance)
// render <div hidden data-onopo-nocache="" /> somewhere in their HTML
export const NO_CACHE_MARKER = 'data-onopo-nocache'
// Every product page renders the hidden Akakçe block (components/seo/ProductMachineData.tsx)
export const PRODUCT_PAGE_MARKER = 'id="product-info"'

/** /<slug>/ paths that can only be product pages (not a reserved route, not a known listing/CMS page). */
export function isProductSlugPath(pathname: string): boolean {
    const slug = PRODUCT_SLUG.exec(pathname)
    return !!slug && !RESERVED_SEGMENTS.has(slug[1]) && !NON_PRODUCT_PAGES.has(slug[1])
}

/** Whether isStorableBody has to see the body before the response may be stored (HTML only). */
export function needsBodyCheck(contentType: string | null): boolean {
    return /^text\/html\b/i.test(contentType || '')
}

/**
 * Body rules, checked after isStorableResponse for HTML: never store a page carrying the no-cache marker,
 * and store a /<slug>/ page only when it really is a product page (a soft 404 or a failed product render
 * must not be served from the cache for 10 minutes).
 */
export function isStorableBody(pathname: string, contentType: string | null, body: string): boolean {
    if (!needsBodyCheck(contentType)) return true
    if (body.includes(NO_CACHE_MARKER)) return false
    if (isProductSlugPath(pathname)) return body.includes(PRODUCT_PAGE_MARKER)
    return true
}

export function cacheKeyUrl(url: URL, buildId: string, version: string): string {
    const params = new URLSearchParams()
    for (const [key, value] of url.searchParams) {
        if (!IGNORED_PARAMS.test(key)) params.append(key, value)
    }
    params.sort()
    const query = params.toString()
    return `https://${CANONICAL_HOST}/__edge-cache/${encodeURIComponent(buildId)}/${encodeURIComponent(version)}${url.pathname}${query ? `?${query}` : ''}`
}

// Successful writes to these change what the storefront shows: bump the content version afterwards
const CONTENT_WRITE = /^\/api\/(admin|products|categories|homepage-sections|hero|hero-slides|menus|pages|site-settings|shipping-settings|upload|migrations|seed-pages|fix-db)(\/|$)/
// ...except these, which change nothing the storefront shows (and some are reachable without a session)
const CONTENT_WRITE_EXCEPTIONS = /^\/api\/admin\/(forgot-password|reset-password|log)(\/|$)/

export function shouldBumpCacheVersion(pathname: string, method: string, hasSession: boolean): boolean {
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false
    // Every content write needs a logged-in user, so anonymous requests can't be used to flush the cache
    if (!hasSession) return false
    return CONTENT_WRITE.test(pathname) && !CONTENT_WRITE_EXCEPTIONS.test(pathname)
}
