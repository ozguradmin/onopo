// Unit tests for the pure edge rules in lib/edge-cache.ts (used by worker.ts) and lib/bot-user-agent.ts.
// Run: node --test scripts/edge-cache.test.mjs   (Node 23.6+ strips the TypeScript types itself)
import test from 'node:test'
import assert from 'node:assert/strict'
import {
    cacheKeyUrl,
    canonicalRedirect,
    isCacheablePath,
    isCacheableRequest,
    isProductSlugPath,
    isStorableBody,
    isStorableResponse,
    needsBodyCheck,
    shouldBumpCacheVersion,
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
