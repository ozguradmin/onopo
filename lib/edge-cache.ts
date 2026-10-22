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
//
// Also here (pure rules used by worker.ts): tracking parameters stripped before Next renders (and put back
// on Next's same-origin redirects), the browser Cache-Control of anonymous allowlisted HTML (bfcache), the
// maintenance render (503) and the readable session hint cookie kept in sync with auth_token.

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

// Tracking parameters that don't change the response: dropped from the cache key, and worker.ts removes them
// from the URL Next renders (stripTrackingParams), so a stored page never carries one visitor's click ids.
// Only vendor click/campaign ids: no page reads any of these names (the store's own parameters, e.g. q, f,
// sort, page, minPrice, maxPrice, discounted, inStock, category, redirect, token, index, includeAll, stay).
// Google: utm_*, gclid, gclsrc, gbraid, wbraid, dclid, gad_* (Ads auto-tagging: gad_source, gad_campaignid),
// srsltid (Merchant Center auto-tagging), _gl/_ga (cross-domain linker); Meta: fbclid, igshid/igsh;
// Microsoft: msclkid; Yandex: yclid, ysclid; TikTok: ttclid; X: twclid; Pinterest: epik; Reddit: rdt_cid;
// Snapchat: sc_cid, ScCid; Impact: irclickid; Klaviyo: _kx; HubSpot: hsa_*, _hsenc, _hsmi; Mailchimp: mc_cid,
// mc_eid; Marketo: mkt_tok; LinkedIn: li_fat_id.
const IGNORED_PARAMS = /^(utm_\w+|fbclid|gclid|gclsrc|gbraid|wbraid|dclid|gad_\w+|srsltid|_gl|_ga|msclkid|yclid|ysclid|ttclid|twclid|igshid|igsh|epik|rdt_cid|sc_cid|sccid|irclickid|_kx|hsa_\w+|_hsenc|_hsmi|mc_cid|mc_eid|mkt_tok|li_fat_id)$/i

export function isTrackingParam(name: string): boolean {
    return IGNORED_PARAMS.test(name)
}

/**
 * The URL without tracking parameters (order of the others kept), or null when it has none.
 * worker.ts hands this URL to Next; the address in the browser is not changed.
 */
export function stripTrackingParams(url: URL): URL | null {
    const params = [...url.searchParams]
    const kept = params.filter(([key]) => !isTrackingParam(key))
    if (kept.length === params.length) return null
    const clean = new URL(url.href)
    clean.search = kept.length ? new URLSearchParams(kept).toString() : ''
    return clean
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/**
 * The Location of a redirect Next answered for a request whose tracking parameters were stripped, with
 * those parameters put back, or null when the response is left as it is. Campaign links without the
 * trailing slash (/products?utm_source=x&page=2 → 308 /products/?page=2) then still land with their
 * utm/gclid/... Only same-origin targets get them. When Next kept the rendered query unchanged (the
 * trailing-slash redirect) the visitor's query is restored exactly as sent; otherwise the removed
 * parameters are appended. A path-relative Location stays relative.
 * requestUrl: the URL the browser asked for; renderedUrl: the URL handed to Next (stripTrackingParams).
 */
export function restoreTrackingParams(status: number, location: string | null, requestUrl: URL, renderedUrl: URL): string | null {
    if (!REDIRECT_STATUSES.has(status) || !location) return null
    const removed = [...requestUrl.searchParams].filter(([key]) => isTrackingParam(key))
    if (!removed.length) return null
    let target: URL
    try {
        target = new URL(location, renderedUrl)
    } catch {
        return null
    }
    if (target.origin !== renderedUrl.origin) return null
    // The route chose its own tracking parameters: keep them
    if ([...target.searchParams.keys()].some(isTrackingParam)) return null
    // A redirect to the rendered URL itself is left alone (it can only loop)
    if (target.pathname === renderedUrl.pathname && target.search === renderedUrl.search) return null
    target.search = target.search === renderedUrl.search
        ? requestUrl.search
        : `${target.search ? `${target.search}&` : '?'}${new URLSearchParams(removed).toString()}`
    const absolute = /^[a-z][a-z\d+.-]*:/i.test(location) || location.startsWith('//')
    return absolute ? target.href : `${target.pathname}${target.search}${target.hash}`
}

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
// Matched as the rendered HTML attribute (with =""): the same name can appear in RSC/JSON payloads of
// pages that only reference it (e.g. the client-side 404 view), and those pages must stay cacheable.
export const NO_CACHE_MARKER = 'data-onopo-nocache=""'
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
        if (!isTrackingParam(key)) params.append(key, value)
    }
    params.sort()
    const query = params.toString()
    return `https://${CANONICAL_HOST}/__edge-cache/${encodeURIComponent(buildId)}/${encodeURIComponent(version)}${url.pathname}${query ? `?${query}` : ''}`
}

// Successful writes to these change what the storefront shows: bump the content version afterwards
// (product reviews included: the product page and the cards show them). Customer endpoints (/api/auth,
// /api/orders, /api/favorites, /api/analytics, /api/user, /api/coupons) are not on the list at all.
const CONTENT_WRITE = /^\/api\/(admin|products|categories|homepage-sections|hero|hero-slides|menus|pages|site-settings|shipping-settings|upload|migrations|seed-pages|fix-db)(\/|$)/
// ...except these, which change nothing the storefront shows (and some are reachable without a session):
// password reset and the client error log; optimize-images only checks image URLs (one POST per product
// from the admin button); email/send only sends mail; profile changes the admin's own login; users is
// read-only.
const CONTENT_WRITE_EXCEPTIONS = /^\/api\/admin\/(forgot-password|reset-password|log|optimize-images|email|profile|users)(\/|$)/

export function shouldBumpCacheVersion(pathname: string, method: string, hasSession: boolean): boolean {
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false
    // Every content write needs a logged-in user, so anonymous requests can't be used to flush the cache
    if (!hasSession) return false
    return CONTENT_WRITE.test(pathname) && !CONTENT_WRITE_EXCEPTIONS.test(pathname)
}

// ---- browser cache of anonymous allowlisted HTML ----

/**
 * Cache-Control sent to the browser with anonymous allowlisted HTML (edge-cache HIT and MISS). Next's default
 * for dynamic pages contains no-store, which keeps every store page out of the back/forward cache; no-cache
 * still makes the browser revalidate before reusing it. Personal, admin and checkout responses (BYPASS)
 * keep their own header.
 */
export const ANONYMOUS_HTML_CACHE_CONTROL = 'private, no-cache'

// ---- maintenance ----

// Rendered by the maintenance view (components/layout/LayoutProvider.tsx, app/maintenance) as an HTML
// attribute; matched with ="" like NO_CACHE_MARKER so RSC payloads that only mention it don't count
export const MAINTENANCE_MARKER = 'data-onopo-maintenance=""'
export const MAINTENANCE_RETRY_AFTER_SECONDS = 3600

/** Whether this HTML response is the maintenance render (worker.ts then answers 503). */
export function isMaintenanceBody(contentType: string | null, body: string): boolean {
    return needsBodyCheck(contentType) && body.includes(MAINTENANCE_MARKER)
}

/**
 * Page GETs that can show the maintenance render and that worker.ts inspects while maintenance is on.
 * APIs (PayTR, BirFatura, feeds), /admin and the crawler files never render it and are passed through.
 */
export function mayRenderMaintenance(pathname: string): boolean {
    if (pathname === '/api' || pathname.startsWith('/api/')) return false
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return false
    if (pathname.startsWith('/_next/')) return false
    return !CRAWLER_FILES.has(pathname)
}

/** Headers of the 503 maintenance answer (the body is the maintenance render itself). */
export function maintenanceHeaders(): Record<string, string> {
    return {
        'Retry-After': String(MAINTENANCE_RETRY_AFTER_SECONDS),
        'X-Robots-Tag': 'noindex',
        'Cache-Control': 'no-store',
    }
}

// ---- readable session hint (lib/session-hint.ts) ----

const SESSION_HINT_MAX_AGE = 60 * 60 * 24 * 7 // like auth_token

function cookieName(setCookie: string): string {
    return setCookie.slice(0, setCookie.indexOf('=')).trim()
}

/** Whether a Set-Cookie line removes its cookie (empty value, Max-Age <= 0 or an Expires in the past). */
export function isCookieRemoval(setCookie: string, now = Date.now()): boolean {
    const [pair, ...attributes] = setCookie.split(';')
    if (pair.slice(pair.indexOf('=') + 1).trim() === '') return true
    for (const attribute of attributes) {
        const [rawName, ...rest] = attribute.split('=')
        const name = rawName.trim().toLowerCase()
        const value = rest.join('=').trim()
        if (name === 'max-age' && Number(value) <= 0) return true
        if (name === 'expires') {
            const time = Date.parse(value)
            if (Number.isFinite(time) && time <= now) return true
        }
    }
    return false
}

/**
 * The Set-Cookie line that brings the readable session hint in line with auth_token, or null when nothing
 * has to change. The session state is the one after this response: a login/logout response that sets or
 * removes auth_token decides it, otherwise the request's cookie does. A response that already sets the hint
 * itself is left alone. hintName is SESSION_HINT_COOKIE (lib/session-hint.ts).
 */
export function sessionHintSetCookie(hintName: string, requestCookie: string | null, responseSetCookies: string[]): string | null {
    if (responseSetCookies.some(c => cookieName(c) === hintName)) return null
    const authLine = responseSetCookies.find(c => cookieName(c) === 'auth_token')
    const loggedIn = authLine ? !isCookieRemoval(authLine) : hasAuthCookie(requestCookie)
    const hasHint = (requestCookie || '').split(';').some(part => part.trim() === `${hintName}=1`)
    if (loggedIn && !hasHint) return `${hintName}=1; Path=/; Max-Age=${SESSION_HINT_MAX_AGE}; Secure; SameSite=Lax`
    if (!loggedIn && hasHint) return `${hintName}=; Path=/; Max-Age=0; Secure; SameSite=Lax`
    return null
}
