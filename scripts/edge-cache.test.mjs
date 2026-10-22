// Unit tests for the pure edge rules in lib/edge-cache.ts (used by worker.ts) and lib/bot-user-agent.ts.
// Run: node --test scripts/edge-cache.test.mjs   (Node 23.6+ strips the TypeScript types itself)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import {
    ANONYMOUS_HTML_CACHE_CONTROL,
    blocksRscDuringMaintenance,
    cacheKeyUrl,
    canonicalRedirect,
    isCacheablePath,
    isCacheableRequest,
    isCookieRemoval,
    isMaintenanceBody,
    isProductSlugPath,
    isRscRequest,
    isStorableBody,
    isStorableResponse,
    isTrackingParam,
    maintenanceHeaders,
    mayRenderMaintenance,
    needsBodyCheck,
    restoreTrackingParams,
    sessionHintSetCookie,
    shouldBumpCacheVersion,
    stripTrackingParams,
} from '../lib/edge-cache.ts'
import { isBotUserAgent } from '../lib/bot-user-agent.ts'

const headers = (obj = {}) => new Headers(obj)
const req = (url, init = {}) => ({ method: init.method || 'GET', url: new URL(url), headers: headers(init.headers) })
const res = (status, obj = {}) => ({ status, headers: headers(obj) })
const HTML = 'text/html; charset=utf-8'
const NEXT_DEFAULT = 'private, no-cache, no-store, max-age=0, must-revalidate'

test('canonicalRedirect: http and www pages go to the https apex', () => {
    assert.equal(canonicalRedirect(new URL('http://onopostore.com/products/?page=2'), 'GET'), 'https://onopostore.com/products/?page=2')
    assert.equal(canonicalRedirect(new URL('https://www.onopostore.com/urun-slug/'), 'GET'), 'https://onopostore.com/urun-slug/')
    assert.equal(canonicalRedirect(new URL('http://www.onopostore.com/'), 'HEAD'), 'https://onopostore.com/')
    assert.equal(canonicalRedirect(new URL('https://onopostore.com/'), 'GET'), null)
})

test('canonicalRedirect: /sitemap.xml and /robots.txt are served on www (Akakçe), http is still upgraded', () => {
    for (const method of ['GET', 'HEAD']) {
        assert.equal(canonicalRedirect(new URL('https://www.onopostore.com/sitemap.xml'), method), null)
        assert.equal(canonicalRedirect(new URL('https://www.onopostore.com/robots.txt'), method), null)
        assert.equal(canonicalRedirect(new URL('https://onopostore.com/sitemap.xml'), method), null)
    }
    assert.equal(canonicalRedirect(new URL('http://www.onopostore.com/sitemap.xml'), 'GET'), 'https://www.onopostore.com/sitemap.xml')
    assert.equal(canonicalRedirect(new URL('http://onopostore.com/robots.txt'), 'GET'), 'https://onopostore.com/robots.txt')
    // other files on www still go to the apex
    assert.equal(canonicalRedirect(new URL('https://www.onopostore.com/sitemap.xml.gz'), 'GET'), 'https://onopostore.com/sitemap.xml.gz')
})

test('canonicalRedirect: APIs, writes and other hosts are never redirected', () => {
    assert.equal(canonicalRedirect(new URL('https://www.onopostore.com/api/feeds/google'), 'GET'), null)
    assert.equal(canonicalRedirect(new URL('http://onopostore.com/api/payment/callback/paytr/result'), 'POST'), null)
    assert.equal(canonicalRedirect(new URL('https://www.onopostore.com/odeme/'), 'POST'), null)
    assert.equal(canonicalRedirect(new URL('http://127.0.0.1:8836/'), 'GET'), null)
    assert.equal(canonicalRedirect(new URL('https://onopo-app.example.workers.dev/'), 'GET'), null)
})

test('isCacheablePath: allowlist, deny list and product slugs', () => {
    for (const p of ['/', '/products/', '/kategori/cep-telefonu-aksesuarlari/', '/page/help/', '/help/', '/product/1058/',
        '/sitemap.xml', '/robots.txt', '/api/products/', '/api/categories/', '/api/site-settings/public/', '/urun-slug-1/']) {
        assert.equal(isCacheablePath(p), true, p)
    }
    for (const p of ['/admin/', '/odeme/', '/profile/', '/login/', '/siparis-basarili/', '/api/orders/', '/api/auth/me/',
        '/api/admin/dashboard-stats/', '/api/birfatura/api/orders', '/api/site-settings/', '/maintenance/', '/categories/', '/Buyuk-Harf/']) {
        assert.equal(isCacheablePath(p), false, p)
    }
})

test('isCacheableRequest: only anonymous plain GETs', () => {
    assert.equal(isCacheableRequest(req('https://onopostore.com/')), true)
    assert.equal(isCacheableRequest(req('https://onopostore.com/', { method: 'HEAD' })), false)
    assert.equal(isCacheableRequest(req('https://onopostore.com/', { headers: { cookie: 'a=1; auth_token=x' } })), false)
    assert.equal(isCacheableRequest(req('https://onopostore.com/', { headers: { cookie: 'theme=dark' } })), true)
    assert.equal(isCacheableRequest(req('https://onopostore.com/', { headers: { authorization: 'Bearer x' } })), false)
    assert.equal(isCacheableRequest(req('https://onopostore.com/', { headers: { rsc: '1' } })), false)
    assert.equal(isCacheableRequest(req('https://onopostore.com/?_rsc=abc')), false)
    assert.equal(isCacheableRequest(req('https://onopostore.com/api/products/?includeAll=true')), false)
})

test('isStorableResponse: header rules', () => {
    assert.equal(isStorableResponse(res(200, { 'content-type': HTML, 'cache-control': NEXT_DEFAULT })), true)
    assert.equal(isStorableResponse(res(200, { 'content-type': 'application/json' })), true)
    assert.equal(isStorableResponse(res(404, { 'content-type': HTML })), false)
    assert.equal(isStorableResponse(res(500, { 'content-type': HTML })), false)
    assert.equal(isStorableResponse(res(200, { 'content-type': HTML, 'set-cookie': 'a=1' })), false)
    assert.equal(isStorableResponse(res(200, { 'content-type': HTML, 'cache-control': 'private, no-store' })), false)
    assert.equal(isStorableResponse(res(200, { 'content-type': 'image/png' })), false)
    assert.equal(isStorableResponse(res(200, { 'content-type': HTML, vary: '*' })), false)
})

test('isProductSlugPath: only /<slug>/ paths that can be products', () => {
    assert.equal(isProductSlugPath('/onopo-t67-usb-a-to-type-c-67w/'), true)
    assert.equal(isProductSlugPath('/onopo-t67'), true)
    for (const p of ['/', '/products/', '/help/', '/policy/', '/shipping/', '/terms/', '/maintenance/', '/admin/', '/kategori/x/', '/page/help/', '/sitemap.xml']) {
        assert.equal(isProductSlugPath(p), false, p)
    }
})

test('isStorableBody: the no-cache marker is never stored', () => {
    const marker = '<html><body><main>Bir hata oluştu</main><div hidden="" data-onopo-nocache=""></div></body></html>'
    for (const p of ['/', '/products/', '/kategori/x/', '/page/help/', '/onopo-t67/']) {
        assert.equal(isStorableBody(p, HTML, marker), false, p)
    }
    assert.equal(isStorableBody('/', HTML, '<html><body><h1>Onopo</h1></body></html>'), true)
})

test('isStorableBody: a /<slug>/ page is stored only when it is a product page', () => {
    const product = '<html><body><div id="product-info" style="display:none"><h1 id="product-name">T67</h1></div></body></html>'
    const soft404 = '<html><body><h1>Sayfa bulunamadı</h1></body></html>'
    assert.equal(isStorableBody('/onopo-t67/', HTML, product), true)
    assert.equal(isStorableBody('/onopo-t67/', HTML, soft404), false)
    assert.equal(isStorableBody('/onopo-t67/', HTML, product.replace('</body>', '<div hidden data-onopo-nocache=""></div></body>')), false)
    // known non-product single-segment pages need no product block
    assert.equal(isStorableBody('/products/', HTML, soft404), true)
    assert.equal(isStorableBody('/help/', HTML, soft404), true)
    assert.equal(isStorableBody('/kategori/x/', HTML, soft404), true)
})

test('isStorableBody: non-HTML bodies are not inspected', () => {
    assert.equal(needsBodyCheck('application/json'), false)
    assert.equal(needsBodyCheck('application/xml'), false)
    assert.equal(needsBodyCheck(HTML), true)
    assert.equal(isStorableBody('/api/products/', 'application/json', '{"x":"data-onopo-nocache"}'), true)
    assert.equal(isStorableBody('/sitemap.xml', 'application/xml', '<urlset></urlset>'), true)
    assert.equal(isStorableBody('/robots.txt', 'text/plain', 'User-Agent: *'), true)
})

test('cacheKeyUrl: tracking parameters dropped, the rest sorted, build and version in the key', () => {
    const key = cacheKeyUrl(new URL('https://www.onopostore.com/products/?utm_source=x&page=2&gclid=1&f=a'), 'B1', 'v9')
    assert.equal(key, 'https://onopostore.com/__edge-cache/B1/v9/products/?f=a&page=2')
})

const TRACKING = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'utm_source_platform',
    'fbclid', 'gclid', 'gclsrc', 'gbraid', 'wbraid', 'dclid', 'srsltid', '_gl', '_ga', 'msclkid', 'yclid', 'ttclid', 'twclid',
    'igshid', 'igsh', 'mc_cid', 'mc_eid', 'li_fat_id', 'UTM_SOURCE', 'GCLID',
    'gad_source', 'gad_campaignid', '_kx', 'hsa_acc', 'hsa_cam', 'hsa_grp', 'hsa_ad', 'hsa_src', 'hsa_tgt', 'hsa_kw', 'hsa_mt',
    'hsa_net', 'hsa_ver', '_hsenc', '_hsmi', 'epik', 'rdt_cid', 'sc_cid', 'ScCid', 'irclickid', 'ysclid', 'mkt_tok']

// Parameters the store itself reads (they change the output), plus near misses of the tracking names
const STORE_PARAMS = ['q', 'f', 'sort', 'page', 'minPrice', 'maxPrice', 'discounted', 'inStock', 'category', 'cat', 'index',
    'includeAll', 'includeInactive', 'hideEmpty', 'redirect', 'returnQ', 'returnPage', 'returnCat', 'returnSize', 'size', 'slug',
    'search_slug', 'variationId', 'range', 'limit', 'exact', '_rsc', 'id', 'token']
const NEAR_MISSES = ['utm', 'gl', 'ga', 'srsltid2', 'xgclid', 'gad', 'gadsource', 'hsa', 'kx', '_kxx', 'sc', 'cid', 'epikx', 'rdt', 'hsenc']

test('isTrackingParam: ad/analytics click ids yes, store parameters no', () => {
    for (const p of TRACKING) assert.equal(isTrackingParam(p), true, p)
    for (const p of [...STORE_PARAMS, ...NEAR_MISSES]) assert.equal(isTrackingParam(p), false, p)
})

test('isTrackingParam: no query parameter the code reads is ever stripped', () => {
    const root = new URL('..', import.meta.url)
    const read = new Set()
    for (const dir of ['app', 'components', 'lib']) {
        for (const file of readdirSync(new URL(`${dir}/`, root), { recursive: true })) {
            if (!/\.(tsx?|mjs)$/.test(file)) continue
            const source = readFileSync(new URL(`${dir}/${file.replaceAll('\\', '/')}`, root), 'utf8')
            for (const m of source.matchAll(/(?:searchParams|params)\??\.(?:get|getAll|has)\(\s*['"]([\w-]+)['"]/g)) read.add(m[1])
        }
    }
    assert.ok(read.has('page') && read.has('q') && read.has('redirect'), 'the scan finds the store parameters')
    for (const p of read) assert.equal(isTrackingParam(p), false, p)
})

test('cacheKeyUrl: every tracking parameter is ignored (one key for all ad/organic landings)', () => {
    const clean = cacheKeyUrl(new URL('https://onopostore.com/onopo-t67/'), 'B', 'v')
    for (const p of TRACKING) {
        assert.equal(cacheKeyUrl(new URL(`https://onopostore.com/onopo-t67/?${p}=AfmBOoq1`), 'B', 'v'), clean, p)
    }
    assert.equal(cacheKeyUrl(new URL('https://onopostore.com/products/?srsltid=a&_gl=1*x*_ga*y&page=2&ttclid=3'), 'B', 'v'),
        'https://onopostore.com/__edge-cache/B/v/products/?page=2')
})

test('stripTrackingParams: the URL Next renders has no tracking parameters; other parameters keep their order', () => {
    assert.equal(stripTrackingParams(new URL('https://onopostore.com/products/?page=2&sort=price_asc')), null)
    assert.equal(stripTrackingParams(new URL('https://onopostore.com/')), null)
    assert.equal(stripTrackingParams(new URL('https://onopostore.com/?utm_source=google&gclid=x'))?.href, 'https://onopostore.com/')
    assert.equal(
        stripTrackingParams(new URL('https://onopostore.com/products/?sort=price_asc&srsltid=AfmB&page=2&_gl=1*abc&q=şarj aleti'))?.href,
        'https://onopostore.com/products/?sort=price_asc&page=2&q=%C5%9Farj+aleti',
    )
    const stripped = stripTrackingParams(new URL('https://onopostore.com/onopo-t67/?fbclid=1&utm_campaign=x'))
    assert.equal(stripped?.pathname, '/onopo-t67/')
    assert.equal(stripped?.search, '')
    // the stripped request stays cacheable exactly like the clean one
    assert.equal(isCacheableRequest(req(stripped.href)), true)
})

// Location a redirect gets when Next answered the stripped URL with `location` (worker.ts withTrackingParams)
const restore = (href, status, location) => {
    const url = new URL(href)
    return restoreTrackingParams(status, location, url, stripTrackingParams(url) ?? url)
}

test('restoreTrackingParams: the trailing-slash redirect keeps the visitor query as sent', () => {
    assert.equal(restore('https://onopostore.com/products?utm_source=nl&gclid=abc&page=2', 308, '/products/?page=2'),
        '/products/?utm_source=nl&gclid=abc&page=2')
    assert.equal(restore('https://onopostore.com/kategori/ok-satanlar?utm_campaign=x', 308, '/kategori/ok-satanlar/'),
        '/kategori/ok-satanlar/?utm_campaign=x')
    assert.equal(restore('http://127.0.0.1:8865/onopo-t67?gad_source=1&gad_campaignid=2207&gclid=z', 308, '/onopo-t67/'),
        '/onopo-t67/?gad_source=1&gad_campaignid=2207&gclid=z')
    assert.equal(restore('https://onopostore.com/products?q=şarj aleti&fbclid=1', 308, '/products/?q=%C5%9Farj+aleti'),
        '/products/?q=%C5%9Farj%20aleti&fbclid=1')
    for (const status of [301, 302, 303, 307]) {
        assert.equal(restore('https://onopostore.com/help?utm_source=x', status, '/help/'), '/help/?utm_source=x', String(status))
    }
    // an absolute same-origin Location stays absolute
    assert.equal(restore('https://onopostore.com/products?srsltid=AfmB', 308, 'https://onopostore.com/products/'),
        'https://onopostore.com/products/?srsltid=AfmB')
    assert.equal(restore('https://onopostore.com/products?srsltid=AfmB', 308, '//onopostore.com/products/'),
        'https://onopostore.com/products/?srsltid=AfmB')
})

test('restoreTrackingParams: other same-origin redirects get the removed parameters appended', () => {
    assert.equal(restore('https://onopostore.com/product/1058/?gclid=g1&utm_source=s', 301, '/onopo-t67/'),
        '/onopo-t67/?gclid=g1&utm_source=s')
    assert.equal(restore('https://onopostore.com/product/1058/?page=2&gclid=g1', 308, '/onopo-t67/?ref=x#yorumlar'),
        '/onopo-t67/?ref=x&gclid=g1#yorumlar')
    assert.equal(restore('https://onopostore.com/profile/?utm_source=nl', 307, '/login/?redirect=%2Fprofile%2F'),
        '/login/?redirect=%2Fprofile%2F&utm_source=nl')
})

test('restoreTrackingParams: everything else is left alone', () => {
    // nothing was stripped
    assert.equal(restore('https://onopostore.com/products?page=2', 308, '/products/?page=2'), null)
    // not a redirect, or no Location
    for (const status of [200, 304, 404, 500, 503]) {
        assert.equal(restore('https://onopostore.com/x?gclid=1', status, '/x/'), null, String(status))
    }
    assert.equal(restore('https://onopostore.com/x?gclid=1', 308, null), null)
    assert.equal(restore('https://onopostore.com/x?gclid=1', 308, ''), null)
    // other origins never receive the visitor's click ids
    assert.equal(restore('https://onopostore.com/odeme?gclid=1', 302, 'https://www.paytr.com/odeme/guvenli/x'), null)
    assert.equal(restore('https://onopostore.com/x?gclid=1', 302, 'https://www.onopostore.com/x/'), null)
    assert.equal(restore('https://onopostore.com/x?gclid=1', 302, 'http://onopostore.com/x/'), null)
    assert.equal(restore('https://onopostore.com/x?gclid=1', 302, '//evil.example/x/'), null)
    // a target with its own tracking parameters, or the rendered URL itself (a loop), is not touched
    assert.equal(restore('https://onopostore.com/x?gclid=1', 302, '/y/?utm_source=site'), null)
    assert.equal(restore('https://onopostore.com/x/?gclid=1&page=2', 302, '/x/?page=2'), null)
    assert.equal(restore('https://onopostore.com/x?gclid=1', 302, 'http://[bad'), null)
})

test('shouldBumpCacheVersion: successful content writes with a session', () => {
    assert.equal(shouldBumpCacheVersion('/api/products/12/', 'PUT', true), true)
    assert.equal(shouldBumpCacheVersion('/api/seed-pages/', 'POST', true), true)
    assert.equal(shouldBumpCacheVersion('/api/fix-db/', 'POST', true), true)
    assert.equal(shouldBumpCacheVersion('/api/migrations/usd-price/', 'POST', true), true)
    assert.equal(shouldBumpCacheVersion('/api/admin/db-fix-index/', 'POST', true), true)
    assert.equal(shouldBumpCacheVersion('/api/seed-pages/', 'GET', true), false)
    assert.equal(shouldBumpCacheVersion('/api/products/12/', 'PUT', false), false)
    assert.equal(shouldBumpCacheVersion('/api/admin/forgot-password/', 'POST', true), false)
    assert.equal(shouldBumpCacheVersion('/api/orders/', 'POST', true), false)
})

test('shouldBumpCacheVersion: writes that never change the storefront do not flush the cache', () => {
    for (const p of ['/api/admin/optimize-images/', '/api/admin/optimize-images', '/api/admin/email/send/', '/api/admin/users/',
        '/api/admin/profile/', '/api/admin/log/', '/api/admin/reset-password/', '/api/auth/login/', '/api/auth/logout/',
        '/api/auth/verify-2fa/', '/api/favorites/', '/api/favorites/12/', '/api/analytics/track/', '/api/orders/', '/api/orders/90/',
        '/api/user/profile/', '/api/coupons/verify/', '/api/payment/callback/paytr/result', '/api/birfatura/api/orderCargoUpdate']) {
        for (const m of ['POST', 'PUT', 'DELETE']) assert.equal(shouldBumpCacheVersion(p, m, true), false, `${m} ${p}`)
    }
    // still bumping: everything that can change what the store shows
    for (const p of ['/api/products/', '/api/products/12/', '/api/products/12/reviews/', '/api/products/12/variations/',
        '/api/admin/products/bulk/', '/api/admin/reviews/3/', '/api/admin/menus/', '/api/admin/coupons/', '/api/admin/payment-settings/',
        '/api/admin/upload/', '/api/upload/', '/api/categories/4/', '/api/site-settings/', '/api/shipping-settings/', '/api/pages/help/',
        '/api/homepage-sections/2/', '/api/hero-slides/', '/api/admin/db-fix/']) {
        assert.equal(shouldBumpCacheVersion(p, 'POST', true), true, p)
    }
})

test('maintenance: the rendered marker is detected in HTML only, and only page paths are inspected', () => {
    const page = '<html><body><main><div hidden="" data-onopo-nocache=""></div><div hidden="" data-onopo-maintenance=""></div><h1>Onopo kısa bir bakımda</h1></main></body></html>'
    assert.equal(isMaintenanceBody(HTML, page), true)
    assert.equal(isMaintenanceBody(HTML, '<html><body><h1>Onopo</h1></body></html>'), false)
    // an RSC/JSON payload that only names the attribute is not the render
    assert.equal(isMaintenanceBody(HTML, '<script>self.__next_f.push([1,"{\\"data-onopo-maintenance\\":\\"\\"}"])</script>'), false)
    assert.equal(isMaintenanceBody('application/json', page), false)
    assert.equal(isMaintenanceBody('text/x-component', page), false)
    // the maintenance page is never stored either
    assert.equal(isStorableBody('/', HTML, page), false)
    for (const p of ['/', '/products/', '/onopo-t67/', '/kategori/x/', '/odeme/', '/maintenance/', '/login/', '/siparis-basarili/']) {
        assert.equal(mayRenderMaintenance(p), true, p)
    }
    for (const p of ['/api/feeds/google', '/api/products/', '/api/birfatura/api/orders/', '/api/payment/callback/paytr/result',
        '/admin/', '/admin', '/admin/login/', '/sitemap.xml', '/robots.txt', '/_next/static/chunks/a.js', '/api']) {
        assert.equal(mayRenderMaintenance(p), false, p)
    }
    assert.deepEqual(maintenanceHeaders(), { 'Retry-After': '3600', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' })
})

test('maintenance: client-side (RSC) navigations of store pages are answered 503 (worker.ts), the rest is untouched', () => {
    const u = (p) => new URL(`https://onopostore.com${p}`)
    assert.equal(isRscRequest(headers({ RSC: '1' }), u('/onopo-t67/')), true)
    assert.equal(isRscRequest(headers({ rsc: '1', 'next-router-prefetch': '1' }), u('/products/')), true)
    assert.equal(isRscRequest(headers(), u('/onopo-t67/?_rsc=1x2y3')), true)
    assert.equal(isRscRequest(headers({ accept: 'text/html' }), u('/onopo-t67/')), false)
    assert.equal(isRscRequest(headers(), u('/products/?page=2&rsc=1')), false)
    for (const p of ['/', '/products/', '/onopo-t67/', '/kategori/x/', '/odeme/', '/page/help/', '/orders/', '/profile/', '/siparis-basarili/', '/product/12/']) {
        assert.equal(blocksRscDuringMaintenance(p), true, p)
    }
    // admin, APIs, crawler files, Next assets and the pages LayoutProvider keeps open (login, register, maintenance)
    for (const p of ['/admin/', '/admin', '/admin/orders/', '/api/products/', '/api/payment/callback/paytr/result', '/api/birfatura/api/orders/',
        '/api/feeds/google', '/sitemap.xml', '/robots.txt', '/_next/static/chunks/a.js', '/login/', '/login', '/register/', '/maintenance/', '/maintenance']) {
        assert.equal(blocksRscDuringMaintenance(p), false, p)
    }
    // product slugs that only start like an exempt page are store pages
    for (const p of ['/login-sayfasi/', '/registerx/', '/maintenance-kiti/']) assert.equal(blocksRscDuringMaintenance(p), true, p)
})

test('ANONYMOUS_HTML_CACHE_CONTROL: revalidated by the browser but bfcache-eligible (no no-store)', () => {
    assert.match(ANONYMOUS_HTML_CACHE_CONTROL, /\bno-cache\b/)
    assert.match(ANONYMOUS_HTML_CACHE_CONTROL, /\bprivate\b/)
    assert.doesNotMatch(ANONYMOUS_HTML_CACHE_CONTROL, /no-store|public|max-age=[1-9]/)
})

test('isCookieRemoval: empty value, Max-Age 0 or a past Expires', () => {
    assert.equal(isCookieRemoval('auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'), true)
    assert.equal(isCookieRemoval('auth_token=abc; Path=/; Max-Age=0'), true)
    assert.equal(isCookieRemoval('auth_token=abc; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'), true)
    assert.equal(isCookieRemoval('auth_token=abc; Path=/; Expires=Thu, 29 Oct 2099 04:11:22 GMT; Max-Age=604800; Secure; HttpOnly; SameSite=lax'), false)
    assert.equal(isCookieRemoval('auth_token=abc'), false)
})

test('sessionHintSetCookie: keeps onopo_oturum in line with auth_token', () => {
    const H = 'onopo_oturum'
    const SET = 'onopo_oturum=1; Path=/; Max-Age=604800; Secure; SameSite=Lax'
    const CLEAR = 'onopo_oturum=; Path=/; Max-Age=0; Secure; SameSite=Lax'
    // request state
    assert.equal(sessionHintSetCookie(H, 'auth_token=x', []), SET)
    assert.equal(sessionHintSetCookie(H, 'a=1; auth_token=x; b=2', []), SET)
    assert.equal(sessionHintSetCookie(H, 'auth_token=x; onopo_oturum=1', []), null)
    assert.equal(sessionHintSetCookie(H, 'onopo_oturum=1', []), CLEAR)
    assert.equal(sessionHintSetCookie(H, 'theme=dark; onopo_oturum=1', []), CLEAR)
    assert.equal(sessionHintSetCookie(H, null, []), null)
    assert.equal(sessionHintSetCookie(H, 'theme=dark', []), null)
    assert.equal(sessionHintSetCookie(H, 'xonopo_oturum=1', []), null)
    // a response that logs in or out decides the state after it
    const login = 'auth_token=eyJ; Path=/; Expires=Thu, 29 Oct 2099 04:11:22 GMT; Max-Age=604800; Secure; HttpOnly; SameSite=lax'
    const logout = 'auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    assert.equal(sessionHintSetCookie(H, null, [login]), SET)
    assert.equal(sessionHintSetCookie(H, 'onopo_oturum=1', [login]), null)
    assert.equal(sessionHintSetCookie(H, 'auth_token=old; onopo_oturum=1', [logout]), CLEAR)
    assert.equal(sessionHintSetCookie(H, 'auth_token=old', [logout]), null)
    // the route set the hint itself: never a second, conflicting line
    assert.equal(sessionHintSetCookie(H, 'onopo_oturum=1', [login, 'onopo_oturum=1; Path=/; Max-Age=604800; Secure; SameSite=lax']), null)
    assert.equal(sessionHintSetCookie(H, 'auth_token=x', [logout, 'onopo_oturum=; Path=/; Max-Age=0']), null)
    // the hint never makes a request uncacheable (only auth_token does)
    assert.equal(isCacheableRequest(req('https://onopostore.com/', { headers: { cookie: 'onopo_oturum=1' } })), true)
})

test('isBotUserAgent: crawlers yes, CUBOT phones no', () => {
    for (const ua of [
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
        'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)',
        'DuckDuckBot-Https/1.1; (+https://duckduckgo.com/duckduckbot)',
        'Twitterbot/1.0',
        'Mozilla/5.0 (Linux; Android 7.0;) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)',
        'akakce bot',
        'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)',
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'curl/8.5.0',
        '',
    ]) {
        assert.equal(isBotUserAgent(ua), true, ua)
    }
    for (const ua of [
        'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Mozilla/5.0 (Linux; Android 13; CUBOT_KINGKONG_9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
        'Mozilla/5.0 (Linux; Android 11; Cubot P50 Build/RP1A.200720.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Mobile Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    ]) {
        assert.equal(isBotUserAgent(ua), false, ua)
    }
})
