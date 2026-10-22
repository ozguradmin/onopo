// Unit tests for the RSC payload edge cache (lib/edge-cache.ts, used by worker.ts serveRscFromEdgeCache) and the
// prefetch rules of the store links (lib/prefetch.ts, components/layout/PrefetchLink.tsx).
// Run: node --test scripts/rsc-cache.test.mjs   (Node 23.6+ strips the TypeScript types itself)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
    cacheKeyUrl,
    isCacheablePath,
    isCacheableRequest,
    isCacheableRscRequest,
    isStorableRscBody,
    isStorableRscResponse,
    rscCacheKeyUrl,
    rscVariant,
} from '../lib/edge-cache.ts'
import { isPrefetchableHref, prefetchAllowedOn } from '../lib/prefetch.ts'

const TREE = encodeURIComponent(JSON.stringify(['', { children: ['kategoriler', { children: ['__PAGE__', {}, null, 'refetch'] }] }, null, null, true]))
const rsc = (extra = {}) => ({ rsc: '1', 'next-router-state-tree': TREE, ...extra })
const req = (url, { method = 'GET', headers = {} } = {}) => ({ method, url: new URL(url), headers: new Headers(headers) })
const res = (status, headers = {}) => ({ status, headers: new Headers(headers) })
const FLIGHT = { 'content-type': 'text/x-component', vary: 'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch' }
const NEXT_DEFAULT = 'private, no-cache, no-store, max-age=0, must-revalidate'

test('rsc requests: anonymous navigations and prefetches of the allowlisted public pages are cacheable', () => {
    for (const path of ['/', '/kategoriler/', '/products/', '/products/?page=2', '/kategori/sarj-aletleri/', '/rehber/', '/rehber/powerbank-secimi-mah-ve-cikis-gucu/', '/cihaz/iphone/', '/page/help/', '/onopo-t67/']) {
        assert.equal(isCacheableRscRequest(req(`https://onopostore.com${path}`, { headers: rsc() })), true, path)
        assert.equal(isCacheableRscRequest(req(`https://onopostore.com${path}${path.includes('?') ? '&' : '?'}_rsc=1a2b3`, { headers: rsc({ 'next-router-prefetch': '1' }) })), true, path)
    }
    // The visitor's session hint alone is not a session
    assert.equal(isCacheableRscRequest(req('https://onopostore.com/', { headers: rsc({ cookie: 'onopo_oturum=1; _ga=x' }) })), true)
    // The HTML rules still never take an RSC request
    assert.equal(isCacheableRequest(req('https://onopostore.com/', { headers: rsc() })), false)
})

test('rsc requests: never personal pages, signed-in visitors, server actions, APIs, other methods or plain requests', () => {
    for (const path of ['/profile/', '/orders/', '/odeme/', '/login/', '/register/', '/siparis-basarili/', '/degerlendir/', '/admin/', '/admin/products/', '/maintenance/', '/categories/', '/api/products/', '/api/categories/']) {
        assert.equal(isCacheableRscRequest(req(`https://onopostore.com${path}`, { headers: rsc() })), false, path)
    }
    assert.equal(isCacheableRscRequest(req('https://onopostore.com/', { headers: rsc({ cookie: 'a=1; auth_token=xyz' }) })), false)
    assert.equal(isCacheableRscRequest(req('https://onopostore.com/', { headers: rsc({ authorization: 'Bearer x' }) })), false)
    assert.equal(isCacheableRscRequest(req('https://onopostore.com/', { headers: rsc({ 'next-action': 'abc' }) })), false)
    assert.equal(isCacheableRscRequest(req('https://onopostore.com/', { method: 'POST', headers: rsc() })), false)
    assert.equal(isCacheableRscRequest(req('https://onopostore.com/', { method: 'HEAD', headers: rsc() })), false)
    assert.equal(isCacheableRscRequest(req('https://onopostore.com/products/?includeAll=true', { headers: rsc() })), false)
    // Plain page loads (HTML) and a bare _rsc without the header are not RSC payload requests
    assert.equal(isCacheableRscRequest(req('https://onopostore.com/')), false)
    assert.equal(isCacheableRscRequest(req('https://onopostore.com/?_rsc=abc')), false)
})

test('rsc key: own namespace, varies with every router header, ignores _rsc, Next-Url and tracking parameters', () => {
    const url = new URL('https://onopostore.com/kategoriler/?_rsc=abc&utm_source=x')
    const variant = rscVariant(new Headers(rsc()))
    const key = rscCacheKeyUrl(url, 'build1', 'v7', 'h1')
    assert.equal(key, 'https://onopostore.com/__edge-cache-rsc/build1/v7/h1/kategoriler/')
    // Never the same as an HTML key, whatever the HTML page's path
    assert.notEqual(key, cacheKeyUrl(new URL('https://onopostore.com/kategoriler/'), 'build1', 'v7'))
    assert.ok(!cacheKeyUrl(new URL('https://onopostore.com/h1/kategoriler/'), 'build1', 'v7').startsWith('https://onopostore.com/__edge-cache-rsc/'))
    // The page's own query stays (sorted, like the HTML key)
    assert.equal(rscCacheKeyUrl(new URL('https://onopostore.com/products/?sort=newest&page=2&_rsc=z'), 'b', 'v', 'h'), 'https://onopostore.com/__edge-cache-rsc/b/v/h/products/?page=2&sort=newest')
    // Build id and content version invalidate it like HTML
    assert.notEqual(rscCacheKeyUrl(url, 'build2', 'v7', 'h1'), key)
    assert.notEqual(rscCacheKeyUrl(url, 'build1', 'v8', 'h1'), key)

    // Each router header changes the variant; Next-Url, cookies and other headers do not
    const variants = new Set([
        variant,
        rscVariant(new Headers(rsc({ 'next-router-prefetch': '1' }))),
        rscVariant(new Headers(rsc({ 'next-router-segment-prefetch': '/_tree' }))),
        rscVariant(new Headers(rsc({ 'next-router-state-tree': encodeURIComponent('["",{}]') }))),
        rscVariant(new Headers({ rsc: '1' })),
    ])
    assert.equal(variants.size, 5)
    assert.equal(rscVariant(new Headers(rsc({ 'next-url': '/onopo-t67/', cookie: 'onopo_oturum=1', 'user-agent': 'x' }))), variant)
    // The values are kept apart, so two headers cannot be shifted into each other
    assert.notEqual(rscVariant(new Headers({ rsc: '1', 'next-router-prefetch': 'a' })), rscVariant(new Headers({ rsc: '1', 'next-router-segment-prefetch': 'a' })))
})

test('rsc responses: only 200 Flight payloads without cookies, Next-Url variance, partial renders or an explicit opt-out', () => {
    assert.equal(isStorableRscResponse(res(200, FLIGHT)), true)
    assert.equal(isStorableRscResponse(res(200, { ...FLIGHT, 'cache-control': NEXT_DEFAULT })), true)
    assert.equal(isStorableRscResponse(res(200, { ...FLIGHT, 'content-type': 'text/x-component; charset=utf-8' })), true)
    for (const [why, r] of [
        ['404', res(404, FLIGHT)],
        ['redirect', res(307, { ...FLIGHT, location: '/x/' })],
        ['503', res(503, FLIGHT)],
        ['html', res(200, { ...FLIGHT, 'content-type': 'text/html; charset=utf-8' })],
        ['set-cookie', res(200, { ...FLIGHT, 'set-cookie': 'a=1' })],
        ['vary next-url (interception route)', res(200, { ...FLIGHT, vary: `${FLIGHT.vary}, Next-Url` })],
        ['vary *', res(200, { ...FLIGHT, vary: '*' })],
        ['postponed', res(200, { ...FLIGHT, 'x-nextjs-postponed': '1' })],
        ['action redirect', res(200, { ...FLIGHT, 'x-action-redirect': '/x/' })],
        ['private', res(200, { ...FLIGHT, 'cache-control': 'private, max-age=0' })],
        ['no-store', res(200, { ...FLIGHT, 'cache-control': 'no-store' })],
    ]) {
        assert.equal(isStorableRscResponse(r), false, why)
    }
})

test('rsc bodies: error rows, no-cache and maintenance markers, a degraded shell and non-product slugs are not stored', () => {
    const page = '0:{"b":"build1","f":[["",{"children":["kategoriler"]}]]}\n1:I["123",[],"CategoriesGrid"]\n2:["$","h1",null,{"children":"Kategoriler"}]\n'
    assert.equal(isStorableRscBody('/kategoriler/', page), true)
    assert.equal(isStorableRscBody('/kategoriler/', ''), false)
    // A server component's no-cache / maintenance marker, as JSON props
    assert.equal(isStorableRscBody('/', `${page}3:["$","div",null,{"hidden":true,"data-onopo-nocache":""}]\n`), false)
    assert.equal(isStorableRscBody('/', `${page}3:["$","div",null,{"hidden":true,"data-onopo-maintenance":""}]\n`), false)
    // A page that only references the marker name (e.g. in a text) stays storable
    assert.equal(isStorableRscBody('/', `${page}3:T20,data-onopo-nocache is a marker\n`), true)
    // React error rows: a thrown error, notFound() or redirect() (first row too)
    assert.equal(isStorableRscBody('/', `${page}a:E{"digest":"NEXT_HTTP_ERROR_FALLBACK;404"}\n`), false)
    assert.equal(isStorableRscBody('/', `1f:E{"digest":"123"}\n${page}`), false)
    // The shell's layout data without categories (LayoutProvider's degraded render)
    assert.equal(isStorableRscBody('/', `${page}4:["$","$L5",null,{"data":{"settings":{},"categories":[],"menus":[]}}]\n`), false)
    // /<slug>/: only a real product page (its #product-info block)
    const product = `${page}5:["$","div",null,{"id":"product-info","style":{"display":"none"},"dangerouslySetInnerHTML":{"__html":"x"}}]\n`
    assert.equal(isStorableRscBody('/onopo-t67/', product), true)
    assert.equal(isStorableRscBody('/onopo-t67/', page), false)
    // Hubs that look like a slug are not product pages
    assert.equal(isStorableRscBody('/rehber/', page), true)
    assert.equal(isStorableRscBody('/kategoriler/', page), true)
})

test('worker.ts: RSC payloads go through serveRscFromEdgeCache, after the HTML rules, with the maintenance 503 kept', () => {
    const src = readFileSync(new URL('../worker.ts', import.meta.url), 'utf8')
    const html = src.indexOf('if (isCacheableRequest({ method, url: targetUrl, headers: target.headers }))')
    const rscBranch = src.indexOf('if (isCacheableRscRequest({ method, url: targetUrl, headers: target.headers }))')
    assert.ok(html > 0 && rscBranch > html)
    const fn = src.slice(src.indexOf('async function serveRscFromEdgeCache'), src.indexOf('// ---- old URLs'))
    assert.match(fn, /settings\?\.maintenance && blocksRscDuringMaintenance\(url\.pathname\)\) return maintenanceRscResponse\(\)/)
    assert.match(fn, /settings\.maintenance\) \{\s*return withCacheStatus\(await handler\.fetch/)
    assert.match(fn, /rscCacheKeyUrl\(url, buildId, settings\.version, await sha256Hex\(rscVariant\(request\.headers\)\)\)/)
    assert.match(fn, /isStorableRscResponse\(response\)/)
    assert.match(fn, /if \(!isStorableRscBody\(url\.pathname, body\)\) return/)
})

test('prefetch: public pages only, never more than the edge-cache allowlist, never personal pages, APIs or files', () => {
    const allowed = ['/', '/kategoriler/', '/products/', '/products/?sort=newest', '/products/?f=type-c', '/kategori/sarj-aletleri/', '/rehber/', '/cihaz/', '/page/help/', '/onopo-t67/']
    for (const href of allowed) {
        assert.equal(isPrefetchableHref(href), true, href)
        assert.equal(isCacheablePath(href.split('?')[0]), true, `${href} is on the edge-cache allowlist`)
    }
    for (const href of ['/profile/', '/profile/?tab=favorites', '/orders/', '/odeme/', '/login/', '/register/', '/siparis-basarili/', '/degerlendir/?t=x', '/admin/', '/maintenance/', '/categories/', '/api/products/', '/sitemap.xml', '/favicon.ico', 'https://wa.me/905', '//evil.example/', '#categories', 'mailto:a@b.c', '', null, undefined]) {
        assert.equal(isPrefetchableHref(href), false, String(href))
    }
})

test('prefetch: off on Save-Data and 2G-class connections, on otherwise (and where the browser says nothing)', () => {
    assert.equal(prefetchAllowedOn(undefined), true)
    assert.equal(prefetchAllowedOn({}), true)
    assert.equal(prefetchAllowedOn({ effectiveType: '4g' }), true)
    assert.equal(prefetchAllowedOn({ effectiveType: '3g' }), true)
    assert.equal(prefetchAllowedOn({ saveData: true, effectiveType: '4g' }), false)
    assert.equal(prefetchAllowedOn({ effectiveType: '2g' }), false)
    assert.equal(prefetchAllowedOn({ effectiveType: 'slow-2g' }), false)
})
