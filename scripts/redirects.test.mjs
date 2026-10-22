// Unit tests for the old-URL redirects: lib/redirects.ts (used by worker.ts and Admin › Yönlendirmeler).
// Run: node --test scripts/redirects.test.mjs   (Node 23.6+ strips the TypeScript types itself)
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

// lib/redirects.ts imports extensionless relative paths ('./seo'); resolve them to the .ts files.
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
const R = await import('../lib/redirects.ts')
const {
    buildIndex, extractUrls, fuzzyMatch, isJunkPath, isLegacyPattern, isLiveTarget, isProtectedPath, normalizePath,
    notFoundCandidate, notFoundVisitorKind, parsePath, rankCandidates, recordNotFound, referrerHost, resolvePath,
    safeTarget, scoreCandidate, suggestTargets, toLocation, tokenize, trimNotFoundLog,
} = R

// The real catalogue's naming (118 products, scripts/fixtures/ai-catalog.json) plus two images with upload keys
const CATALOG = JSON.parse(readFileSync(new URL('fixtures/ai-catalog.json', import.meta.url), 'utf8'))
const PRODUCTS = [
    ...CATALOG.map(p => ({ id: p.id, slug: p.slug, name: p.name, is_active: 1, images: p.images })),
    { id: 700, slug: 'onopo-eski-pasif-urun-700', name: 'Eski Pasif Ürün', is_active: 0, images: '["/api/images/1769000000000-ab12cd34-Eski-Kapak.JPG"]' },
    { id: 701, slug: 'onopo-iphone-11-silikon-kilif-701', name: 'onopo iPhone 11 Silikon Kılıf', is_active: 1, images: '["https://images.onopostore.com/1769000000001-0a1b2c3d-iphone-11-kilif.webp"]' },
]
const CATEGORIES = [
    { name: 'Cep Telefonu Aksesuarları', slug: 'cep-telefonu-aksesuarlari', product_count: 108 },
    { name: 'Oyun ve Oyuncu Aksesuarları', slug: 'oyun-ve-oyuncu-aksesuarlari', product_count: 3 },
    { name: 'Çok Satanlar', slug: 'ok-satanlar', product_count: 8 },
    { name: 'Boş Kategori', slug: 'bos-kategori', product_count: 0 },
]
const PAGES = [{ slug: 'hakkimizda' }, { slug: 'help' }, { slug: 'iade-kosullari' }]
const index = buildIndex({ products: PRODUCTS, categories: CATEGORIES, pages: PAGES })
const IMG = 'https://images.onopostore.com'

/** resolvePath with the test index; admin redirects and R2 objects from the given maps. */
function resolve(input, { admin = {}, r2 = [], assets = [] } = {}) {
    const heads = []
    const promise = resolvePath(input, {
        index,
        adminRedirect: async key => (Object.prototype.hasOwnProperty.call(admin, key) ? admin[key] : null),
        imageExists: async key => { heads.push(key); return r2.includes(key) },
        assetExists: async path => assets.includes(path),
    })
    return promise.then(r => Object.assign(r ?? { target: null }, { heads }))
}
const target = async (input, opts) => (await resolve(input, opts)).target

// ---- normalization ----

test('normalizePath: our hosts only, decoded, lower-case, trailing slash, no tracking parameters, sorted query', () => {
    assert.equal(normalizePath('https://www.onopostore.com/Urun/K%C4%B1l%C4%B1f?utm_source=x&gclid=1'), '/urun/kılıf/')
    assert.equal(normalizePath('http://onopostore.com//urun///iPhone-15'), '/urun/iphone-15/')
    assert.equal(normalizePath('/İPHONE-KILIF/'), '/iphone-kilif/')
    assert.equal(normalizePath('onopostore.com/kategori/x'), '/kategori/x/')
    assert.equal(normalizePath('/eski-urun.html/'), '/eski-urun.html')
    assert.equal(normalizePath('/images/A.JPG'), '/images/a.jpg')
    assert.equal(normalizePath('/index.php?route=product/product&product_id=12&fbclid=x'), '/index.php?product_id=12&route=product%2Fproduct')
    assert.equal(normalizePath('/x?b=2&a=1'), normalizePath('/x/?a=1&b=2'))
    assert.equal(normalizePath('"https://onopostore.com/a"'), '/a/')
    // not ours / not a path
    assert.equal(normalizePath('https://evil.example/urun/x'), null)
    assert.equal(normalizePath('//evil.example/x'), null)
    assert.equal(normalizePath('/\\evil.example'), null)
    assert.equal(normalizePath('javascript:alert(1)'), null)
    assert.equal(normalizePath('urun/x'), null)
    assert.equal(normalizePath('/a%00b'), null)
    assert.equal(normalizePath(''), null)
    assert.equal(normalizePath(`/${'a'.repeat(500)}`), null)
    // parsePath keeps the original case for R2 keys
    assert.equal(parsePath('/uploads/IMG_01.JPG').rawPath, '/uploads/IMG_01.JPG')
})

test('isProtectedPath / isJunkPath', () => {
    for (const p of ['/admin', '/admin/', '/admin/products/', '/api', '/api/orders/', '/api/auth/login', '/_next/static/x.js', '/_next/data/x.json']) {
        assert.equal(isProtectedPath(p), true, p)
    }
    for (const p of ['/api/images/abc.jpg', '/_next/image', '/_next/image/', '/urun/x/', '/administrator/', '/apix/']) {
        assert.equal(isProtectedPath(p), false, p)
    }
    for (const p of ['/wp-login.php', '/wp-admin/', '/.env', '/.git/config', '/apple-touch-icon-precomposed.png', '/favicon.ico', '/xmlrpc.php']) {
        assert.equal(isJunkPath(p), true, p)
    }
    assert.equal(isJunkPath('/urun/wp-kilif/'), false)
})

// ---- tokens and scoring ----

test('tokenize: Turkish folding, numbers kept, codes whole, stopwords out', () => {
    assert.deepEqual(tokenize('onopo İphone 15 Pro Max Uyumlu Şeffaf Kılıf'), ['iphone', '15', 'pro', 'max', 'uyumlu', 'seffaf', 'kilif'])
    assert.deepEqual(tokenize('iphone15pro-kilif'), ['iphone', '15', 'pro', 'kilif'])
    assert.deepEqual(tokenize('Samsung Galaxy S24 9D Cam 20W'), ['samsung', 'galaxy', 's24', '9d', 'cam', '20w'])
    assert.deepEqual(tokenize('Şarj Aleti ve Kablo - A1'), ['sarj', 'aleti', 'kablo', 'a1'])
    assert.deepEqual(tokenize('urun-detay.html'), [])
})

test('scoreCandidate: same model wins; a different model or a missing model word is penalised', () => {
    const idf = () => 1
    const q = tokenize('iphone-13-kilif')
    const same = scoreCandidate(q, tokenize('iPhone 13 Kılıfı'), idf)
    assert.ok(same > 0.9, String(same))
    assert.ok(scoreCandidate(q, tokenize('iPhone 13 Pro Kılıf'), idf) < same * 0.8)
    assert.ok(scoreCandidate(q, tokenize('iPhone 14 Kılıf'), idf) < 0.5)
    assert.equal(scoreCandidate([], tokenize('x y'), idf), 0)
})

// ---- fuzzy matching on the real catalogue ----

const POOL = [...index.products, ...index.categories]
const fuzzy = q => fuzzyMatch(q, POOL, index.idf)?.entry.slug ?? null

test('fuzzy: old slugs of real products redirect to that product', () => {
    const cases = {
        'iphone-15-anti-static-9d-cam-ekran-koruyucu': 'onopo-iphone-15-anti-static-9d-cam-ekran-koruyucu-551',
        'iphone-15-pro-max-seramik-mat-ekran-koruyucu': 'onopo-iphone-15-pro-max-uyumlu-seramik-mat-ekran-koruyucu-12d-505',
        'iphone-11-pro-max-seramik-ekran-koruyucu': 'onopo-iphone-11-pro-max-uyumlu-seramik-mat-ekran-koruyucu-12d-478',
        'redmi-note-13-pro-9d-cam': 'onopo-redmi-note-13-pro-anti-static-9d-cam-ekran-koruyucu-571',
        'iphone-13-9d-cam': 'onopo-iphone-13-anti-static-9d-cam-ekran-koruyucu-539',
        'samsung-galaxy-s24-cam-ekran-koruyucu': 'onopo-samsung-galaxy-s24-anti-static-9d-cam-ekran-koruyucu-568',
        'onopo-20w-pd-type-c-hizli-sarj-aleti-adaptor': 'onopo-20w-pd-type-c-hizli-sarj-aleti-adaptor-a1-401',
        'miknatisli-telefon-tutucu': 'onopo-miknatisli-telefon-tutucu-havalandirma-tipi-635',
        'şarjlı-el-süpürgesi': 'onopo-sarjli-el-supurgesi-120w-kablosuz-v1-616',
        'type-c-to-type-c-60w-orgulu-kablo-1-metre': 'onopo-type-c-to-type-c-60w-orgulu-hizli-sarj-ve-data-kablosu-1-m-k1-442',
        'pubg-tetik': 'onopo-pubg-mobil-tetik-seti-metal-g1-628',
        'oyun-aksesuarlari': 'oyun-ve-oyuncu-aksesuarlari',
    }
    for (const [q, slug] of Object.entries(cases)) assert.equal(fuzzy(q), slug, q)
})

test('fuzzy: ambiguous or unknown names never redirect', () => {
    for (const q of [
        'iphone-15-ekran-koruyucu',       // the seramik and the 9D cam one fit equally
        '10000-mah-powerbank',            // two 10000 mAh power banks
        'telefon-tutucu',                 // masaüstü and mıknatıslı
        'bluetooth-kulaklik', 'kablosuz-kulaklik',
        'ekran-koruyucu', 'seramik-ekran-koruyucu',
        'iphone-15-kilif',                // no cases in the shop: protectors must not be offered instead
        'iphone-16-pro-max-kilif', 'samsung-galaxy-s24-kilif', 'xiaomi-14-kilif',
        'airpods-pro-kilif', 'apple-watch-kordon', 'magsafe-cuzdan', 'gaming-kulaklik',
        'iphone-sarj-kablosu', 'lightning-kablo', 'el-supurgesi',
        'kilif',                          // one word never picks a product
        'iphone-14-ekran',                // 4 iPhone 14 protectors
    ]) {
        assert.equal(fuzzy(q), null, q)
    }
})

test('fuzzy: deterministic ranking', () => {
    const a = rankCandidates('iphone-15-ekran-koruyucu', POOL, index.idf).map(c => c.entry.slug)
    const b = rankCandidates('iphone-15-ekran-koruyucu', [...POOL].reverse(), index.idf).map(c => c.entry.slug)
    assert.deepEqual(a, b)
})

// ---- pattern rules ----

const P551 = '/onopo-iphone-15-anti-static-9d-cam-ekran-koruyucu-551/'
const P401 = '/onopo-20w-pd-type-c-hizli-sarj-aleti-adaptor-a1-401/'

test('patterns: product URLs of the old platforms', async () => {
    assert.equal(await target('/urun/onopo-iphone-15-anti-static-9d-cam-ekran-koruyucu-551/'), P551)
    assert.equal(await target('/urun/iphone-15-anti-static-9d-cam-ekran-koruyucu'), P551)
    assert.equal(await target('/product/iphone-15-anti-static-9d-cam-ekran-koruyucu/'), P551)
    assert.equal(await target('/products/iphone-15-anti-static-9d-cam-ekran-koruyucu/'), P551)
    assert.equal(await target('/p/iphone-15-anti-static-9d-cam-ekran-koruyucu/'), P551)
    assert.equal(await target('/iphone-15-anti-static-9d-cam-ekran-koruyucu.html'), P551)
    assert.equal(await target('/urun/551/'), P551)
    assert.equal(await target('/index.php?route=product/product&product_id=401'), P401)
    assert.equal(await target('/urun.php?id=401'), P401)
    assert.equal(await target('/?id=401&utm_source=google'), P401)
    // trailing ids: -p-<n> is an id; a bare -<n> only when the words agree
    assert.equal(await target('/20w-sarj-adaptoru-p-401.html'), P401)
    assert.equal(await target('/p-401.html'), P401)
    assert.equal(await target('/urun/eski-ad-p-401/'), P401)
    assert.equal(await target('/urun/onopo-20w-pd-type-c-hizli-sarj-aleti-adaptor-a1-999/'), P401)
    assert.equal(await target('/urun/onopo-20w-pd-type-c-hizli-sarj-aleti-adaptor-a1-551/'), P401, 'the words win over an id they contradict')
    // not ours (unknown id, inactive product)
    assert.equal(await target('/urun/99999/'), null)
    assert.equal(await target('/index.php?route=product/product&product_id=99999'), null)
    assert.equal(await target('/urun/onopo-eski-pasif-urun-700/'), null)
    assert.equal(await target('/product/700/'), null)
})

test('patterns: categories and CMS pages', async () => {
    assert.equal(await target('/category/Cep-Telefonu-Aksesuarlari'), '/kategori/cep-telefonu-aksesuarlari/')
    assert.equal(await target('/kategori/Cep-Telefonu-Aksesuarlari/'), null, 'a live page (any case) is never redirected to itself')
    assert.equal(await target('/kategori/oyun-aksesuarlari/'), '/kategori/oyun-ve-oyuncu-aksesuarlari/')
    assert.equal(await target('/kategori/cep-telefonu-aksesuarlari/sarj-aletleri/'), '/kategori/cep-telefonu-aksesuarlari/')
    assert.equal(await target('/category/oyun-ve-oyuncu-aksesuarlari'), '/kategori/oyun-ve-oyuncu-aksesuarlari/')
    assert.equal(await target('/collections/cep-telefonu-aksesuarlari'), '/kategori/cep-telefonu-aksesuarlari/')
    assert.equal(await target('/cep-telefonu-aksesuarlari.html'), '/kategori/cep-telefonu-aksesuarlari/')
    assert.equal(await target('/kategori/bos-kategori/'), null, 'a category without products is a 404 itself')
    assert.equal(await target('/hakkimizda.html'), '/page/hakkimizda/')
    assert.equal(await target('/bilgi/iade-kosullari/'), '/page/iade-kosullari/')
})

test('patterns: images go to the R2 original only when it exists', async () => {
    const key = '1769000000001-0a1b2c3d-iphone-11-kilif.webp'
    // the verified example: /_next/image?url=%2Fapi%2Fimages%2F<key>&w=640&q=75
    assert.equal(await target(`/_next/image?url=%2Fapi%2Fimages%2F${key}&w=640&q=75`), `${IMG}/${key}`)
    assert.equal(await target(`/_next/image/?url=${encodeURIComponent(`${IMG}/${key}`)}&w=64&q=75`), `${IMG}/${key}`)
    assert.equal(await target(`/_next/image?url=${encodeURIComponent(`https://pub-abc123.r2.dev/${key}`)}&w=64`), `${IMG}/${key}`)
    // a key nothing references: checked in R2
    let r = await resolve('/_next/image?url=%2Fapi%2Fimages%2Fbaska.png&w=640&q=75', { r2: ['baska.png'] })
    assert.equal(r.target, `${IMG}/baska.png`)
    assert.deepEqual(r.heads, ['baska.png'])
    r = await resolve('/_next/image?url=%2Fapi%2Fimages%2Fyok.png&w=640&q=75')
    assert.equal(r.target, null)
    // /api/images/<key> misses, old upload folders: by file name (with or without our upload prefix)
    assert.equal(await target('/api/images/iphone-11-kilif.webp'), `${IMG}/${key}`)
    assert.equal(await target('/uploads/2023/05/iphone-11-kilif.webp'), `${IMG}/${key}`)
    assert.equal(await target('/images/Eski-Kapak.JPG'), `${IMG}/1769000000000-ab12cd34-Eski-Kapak.JPG`, 'images of inactive products still exist')
    r = await resolve('/storage/IMG_0042.JPG', { r2: ['IMG_0042.JPG'] })
    assert.equal(r.target, `${IMG}/IMG_0042.JPG`, 'the original case is tried first')
    r = await resolve('/images/a/b/c.png', { r2: [] })
    assert.equal(r.target, null)
    assert.ok(r.heads.length <= 2, 'at most two R2 lookups')
    // a public file of the site
    assert.equal(await target('/_next/image?url=%2Flogo.png&w=200&q=75', { assets: ['/logo.png'] }), '/logo.png')
    assert.equal(await target('/_next/image?url=%2Flogo.png&w=200&q=75'), null)
})

test('open-redirect safety: foreign hosts are never a target', async () => {
    for (const u of [
        'https://evil.example/x.png', '//evil.example/x.png', 'https://images.onopostore.com.evil.example/a.png',
        'https://evil.example/api/images/x.png', 'javascript:alert(1)', '/\\evil.example/x.png',
    ]) {
        assert.equal(await target(`/_next/image?url=${encodeURIComponent(u)}&w=64`, { r2: ['x.png', 'a.png'], assets: ['/\\evil.example/x.png'] }), null, u)
    }
    // '/%2Fevil.example/x.png' decodes to a protocol-relative '//evil.example/x.png': never a Location
    for (const u of ['/%2Fevil.example/x.png', '/%5Cevil.example/x.png']) {
        const t = await target(`/_next/image?url=${encodeURIComponent(u)}&w=64`, { assets: ['//evil.example/x.png', '/\\evil.example/x.png'] })
        assert.ok(t === null || (t.startsWith('/') && !t.startsWith('//') && !t.startsWith('/\\')), `${u} → ${t}`)
    }
    for (const t of ['https://evil.example/', '//evil.example', '/\\evil.example', 'javascript:alert(1)', 'http://images.onopostore.com:8080/a.png', 'https://user@images.onopostore.com/a.png']) {
        assert.equal(safeTarget(t), null, t)
    }
    assert.equal(safeTarget('https://www.onopostore.com/Kategori/X?utm_source=a'), '/kategori/x/')
    assert.equal(safeTarget('https://images.onopostore.com/a%20b.png'), `${IMG}/a%20b.png`)
    assert.equal(safeTarget('/admin/'), null)
    assert.equal(safeTarget('/api/orders/'), null)
    // an admin redirect to another site is ignored
    const r = await resolve('/eski/', { admin: { '/eski/': 'https://evil.example/' } })
    assert.equal(r.target, null)
    assert.equal(r.problem, 'admin-target-gone')
})

test('admin redirects: exact normalized match first; gone targets and self-targets never redirect', async () => {
    assert.equal(await target('/Eski-Kampanya?utm_source=x', { admin: { '/eski-kampanya/': P401 } }), P401)
    let r = await resolve('/eski-kampanya/', { admin: { '/eski-kampanya/': '/products/?q=kılıf' } })
    assert.equal(r.target, '/products/?q=k%C4%B1l%C4%B1f')
    assert.equal(r.via, 'admin')
    assert.equal(toLocation(r.target), '/products/?q=k%C4%B1l%C4%B1f')
    // the query-specific row wins, then the bare path
    assert.equal(await target('/x/?page=2', { admin: { '/x/?page=2': '/products/', '/x/': P401 } }), '/products/')
    assert.equal(await target('/x/?page=3', { admin: { '/x/?page=2': '/products/', '/x/': P401 } }), P401)
    // target gone (deleted product): no redirect, reported
    r = await resolve('/eski/', { admin: { '/eski/': '/silinmis-urun/' } })
    assert.equal(r.target, null)
    assert.equal(r.problem, 'admin-target-gone')
    // never to itself
    assert.equal((await resolve('/a/', { admin: { '/a/': '/a/' } })).target, null)
    // the admin row beats the patterns
    assert.equal(await target('/urun/551/', { admin: { '/urun/551/': P401 } }), P401)
    // Turkish target path is sent encoded
    assert.equal(toLocation('/kategori/şarj/'), '/kategori/%C5%9Farj/')
})

test('loop safety: every target is live, never protected, never the request; one hop', async () => {
    // a live target never 404s, so the redirect cannot be followed by another one
    for (const t of [P551, '/kategori/cep-telefonu-aksesuarlari/', '/page/hakkimizda/', '/', '/products/', '/product/401/', `${IMG}/x.png`]) {
        assert.equal(isLiveTarget(t, index), true, t)
    }
    for (const t of ['/urun/x/', '/silinmis-urun/', '/kategori/bos-kategori/', '/page/yok/', '/product/700/', '/admin/', '/api/images/x.png']) {
        assert.equal(isLiveTarget(t, index), false, t)
    }
    // /api and /admin are never redirected from
    assert.equal(await target('/admin/eski/', { admin: { '/admin/eski/': '/products/' } }), null)
    assert.equal(await target('/api/products/eski/', { admin: { '/api/products/eski/': '/products/' } }), null)
    assert.equal(await target('/wp-login.php', { admin: { '/wp-login.php': '/products/' } }), null)
    // every resolved target resolves to nothing further (it is live)
    for (const input of ['/urun/551/', '/iphone-15-anti-static-9d-cam-ekran-koruyucu.html', '/kategori/oyun-aksesuarlari/', '/hakkimizda.html']) {
        const first = await target(input)
        assert.ok(first, input)
        assert.equal(isLiveTarget(first, index), true, first)
    }
})

// ---- what worker.ts looks at ----

test('notFoundCandidate: 404 pages, /_next/image errors, and the trailing-slash hop of legacy paths', () => {
    const u = s => new URL(s, 'https://onopostore.com')
    assert.equal(notFoundCandidate('GET', u('/urun/x/'), 404, null, false), '/urun/x/')
    assert.equal(notFoundCandidate('HEAD', u('/x.html?id=3'), 404, null, false), '/x.html?id=3')
    assert.equal(notFoundCandidate('POST', u('/urun/x/'), 404, null, false), null)
    assert.equal(notFoundCandidate('GET', u('/urun/x/'), 404, null, true), null, 'RSC navigations are left alone')
    assert.equal(notFoundCandidate('GET', u('/urun/x/'), 200, null, false), null)
    assert.equal(notFoundCandidate('GET', u('/api/products/1'), 404, null, false), null)
    assert.equal(notFoundCandidate('GET', u('/admin/x/'), 404, null, false), null)
    assert.equal(notFoundCandidate('GET', u('/api/images/a.png'), 404, null, false), '/api/images/a.png')
    assert.equal(notFoundCandidate('GET', u('/_next/image?url=%2Fa.png&w=64'), 400, null, false), '/_next/image?url=%2Fa.png&w=64')
    assert.equal(notFoundCandidate('GET', u('/_next/image?url=%2Fa.png&w=64'), 200, null, false), null)
    assert.equal(notFoundCandidate('GET', u('/_next/static/chunks/x.js'), 404, null, false), null)
    // Next's 308 /urun/x → /urun/x/ is skipped for legacy prefixes only
    assert.equal(notFoundCandidate('GET', u('/urun/x'), 308, '/urun/x/', false), '/urun/x/')
    assert.equal(notFoundCandidate('GET', u('/urun/x?id=2'), 308, 'https://onopostore.com/urun/x/?id=2', false), '/urun/x/?id=2')
    assert.equal(notFoundCandidate('GET', u('/kategori/x/y'), 308, '/kategori/x/y/', false), '/kategori/x/y/')
    assert.equal(notFoundCandidate('GET', u('/products'), 308, '/products/', false), null, 'a live listing')
    assert.equal(notFoundCandidate('GET', u('/some-product'), 308, '/some-product/', false), null, 'product pages are not legacy')
    assert.equal(notFoundCandidate('GET', u('/urun/x'), 308, 'https://evil.example/urun/x/', false), null)
    assert.equal(notFoundCandidate('GET', u('/urun/x'), 308, '/baska/', false), null)
    assert.equal(isLegacyPattern('/urun/x'), true)
    assert.equal(isLegacyPattern('/kategori'), false)
    assert.equal(isLegacyPattern('/products'), false)
})

test('notFoundVisitorKind / referrerHost: Googlebot and visitors only, host only', () => {
    assert.equal(notFoundVisitorKind('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), 'googlebot')
    assert.equal(notFoundVisitorKind('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36'), 'visitor')
    assert.equal(notFoundVisitorKind('Mozilla/5.0 (compatible; bingbot/2.0)'), null)
    assert.equal(notFoundVisitorKind('Mozilla/5.0 (compatible; AhrefsBot/7.0)'), null)
    assert.equal(notFoundVisitorKind('curl/8.0'), null)
    assert.equal(notFoundVisitorKind(''), null)
    assert.equal(referrerHost('https://www.google.com/search?q=ozel+bilgi'), 'www.google.com')
    assert.equal(referrerHost('not a url'), null)
    assert.equal(referrerHost(null), null)
})

test('extractUrls: Search Console CSV and pasted lists', () => {
    const csv = [
        'URL,Last crawled',
        'https://onopostore.com/urun/a,2026-10-01',
        '"https://www.onopostore.com/urun/a/?utm_source=x",2026-10-02',
        'https://onopostore.com/kategori/b,2026-10-03',
        'https://evil.example/x,2026-10-03',
        '/eski.html',
        'bos satir',
    ].join('\r\n')
    assert.deepEqual(extractUrls(csv), ['https://onopostore.com/urun/a', 'https://onopostore.com/kategori/b', '/eski.html'])
    assert.equal(extractUrls(Array.from({ length: 50 }, (_, i) => `/x${i}`).join('\n'), 10).length, 10)
})

test('suggestTargets: what the site does now, else looser candidates for the admin', async () => {
    const auto = await suggestTargets('/urun/551/', { index })
    assert.equal(auto[0].kind, 'auto')
    assert.equal(auto[0].target, P551)
    const loose = await suggestTargets('/urun/iphone-15-ekran-koruyucu/', { index })
    assert.ok(loose.length >= 2 && loose.every(s => s.kind === 'suggested'))
    assert.deepEqual(loose.slice(0, 2).map(s => s.target).sort(), [
        '/onopo-iphone-15-anti-static-9d-cam-ekran-koruyucu-551/',
        '/onopo-iphone-15-uyumlu-seramik-mat-ekran-koruyucu-12d-499/',
    ])
    assert.deepEqual(await suggestTargets('/airpods-pro-kilif/', { index }), [])
    assert.deepEqual(await suggestTargets('/admin/x/', { index }), [])
})

// ---- D1 helpers (fake database) ----

function fakeDb() {
    const calls = []
    const db = {
        calls,
        count: 0,
        prepare(sql) {
            const stmt = {
                args: [],
                bind(...a) { stmt.args = a; return stmt },
                async run() { calls.push({ sql, args: stmt.args }); return {} },
                async first() { calls.push({ sql, args: stmt.args }); return /COUNT/.test(sql) ? { n: db.count } : null },
                async all() { calls.push({ sql, args: stmt.args }); return { results: [] } },
            }
            return stmt
        },
    }
    return db
}

test('recordNotFound: one upsert, no IP or user agent; the table is trimmed now and then', async () => {
    const db = fakeDb()
    await recordNotFound(db, '/urun/x/', { googlebot: true, referrerHost: 'www.google.com' }, 0.5)
    assert.equal(db.calls.length, 1)
    assert.match(db.calls[0].sql, /ON CONFLICT\(path\) DO UPDATE/)
    assert.deepEqual(db.calls[0].args, ['/urun/x/', 1, 'www.google.com'])
    db.count = 2005
    await recordNotFound(db, '/urun/y/', { googlebot: false, referrerHost: null }, 0.001)
    const del = db.calls.find(c => /^DELETE/.test(c.sql))
    assert.ok(del)
    assert.deepEqual(del.args, [5])
    db.calls.length = 0
    db.count = 10
    await trimNotFoundLog(db)
    assert.equal(db.calls.some(c => /^DELETE/.test(c.sql)), false)
})

test('notFoundLogKey: query values that may identify a person are not stored', () => {
    const key = s => R.notFoundLogKey(parsePath(s))
    assert.equal(key('/index.php?route=product/product&product_id=12'), '/index.php?product_id=12&route=product%2Fproduct')
    assert.equal(key('/sifre-sifirla?email=ali@example.com&token=abc'), '/sifre-sifirla/')
    assert.equal(key('/siparis?no=12&x=ali%40example.com'), '/siparis/?no=12')
    assert.equal(key('/takip?q=0555%20123%2045%2067'), '/takip/')
    assert.equal(key('/onay?k=9f8e7d6c5b4a39281706f5e4d3c2b1a0ffeeddcc'), '/onay/')
    assert.equal(key('/urun/kilif/?utm_source=x'), '/urun/kilif/')
})

test('schema.sql has the same tables as the lazy ensure', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8').replace(/--[^\n]*/g, '').replace(/\s+/g, ' ')
    for (const sql of R.REDIRECT_TABLES) {
        const name = /(?:TABLE|INDEX) IF NOT EXISTS (\w+)/.exec(sql)[1]
        assert.ok(schema.includes(`IF NOT EXISTS ${name}`), name)
    }
    // the column list matches (comments in schema.sql aside)
    for (const col of ['from_path TEXT PRIMARY KEY', 'to_path TEXT NOT NULL', 'googlebot_hits INTEGER NOT NULL DEFAULT 0', 'last_referrer_host TEXT', 'ignored INTEGER NOT NULL DEFAULT 0']) {
        assert.ok(schema.includes(col), col)
    }
})

// ---- admin ----

test('validateRedirect: old address must not open, new one must; no chains possible', () => {
    const { validateRedirect } = R
    const ok = validateRedirect('https://onopostore.com/Urun/Eski-Ad?utm_source=x', 'https://www.onopostore.com/onopo-iphone-15-anti-static-9d-cam-ekran-koruyucu-551/', index)
    assert.deepEqual(ok, { ok: true, from: '/urun/eski-ad/', to: P551 })
    assert.equal(validateRedirect('/eski.html', '/kategori/cep-telefonu-aksesuarlari', index).ok, true)
    assert.equal(validateRedirect('/eski/', `${IMG}/a.png`, index).ok, true)
    const bad = (from, to) => { const v = validateRedirect(from, to, index); assert.equal(v.ok, false, `${from} → ${to}`); return v.error }
    assert.match(bad('https://evil.example/x', P551), /siteye ait/)
    assert.match(bad('/admin/x/', P551), /admin/)
    assert.match(bad('/api/products/', P551), /admin/)
    assert.match(bad('/', P551), /Ana sayfa/)
    assert.match(bad(P551, P401), /zaten açılıyor/, 'a live product page is never a source')
    assert.match(bad('/kategori/cep-telefonu-aksesuarlari/', P401), /zaten açılıyor/)
    assert.match(bad('/eski/', 'https://evil.example/'), /bu sitenin/)
    assert.match(bad('/eski/', '/eski/'), /aynı/)
    assert.match(bad('/eski/', '/baska-eski/'), /bulunamadı/, 'a target that 404s (e.g. another source) is refused')
    assert.match(bad('/eski/', '/onopo-eski-pasif-urun-700/'), /bulunamadı/)
    assert.match(bad('/eski/', ''), /Yeni adresi/)
})

test('classifyUrl: what happens to each Search Console address', async () => {
    const { classifyUrl } = R
    const existing = new Map([['/eski-kampanya/', P401]])
    const deps = { index, existing: key => existing.get(key) ?? null }
    const s = async u => (await classifyUrl(u, deps)).status
    assert.equal(await s('https://evil.example/x'), 'invalid')
    assert.equal(await s('https://onopostore.com/wp-login.php'), 'protected')
    assert.equal(await s('https://onopostore.com/admin/'), 'protected')
    assert.equal(await s(`https://onopostore.com${P551}`), 'live')
    assert.equal(await s('https://onopostore.com/eski-kampanya?utm_source=x'), 'has-redirect')
    assert.equal(await s('https://onopostore.com/urun/551'), 'auto')
    assert.equal(await s('https://onopostore.com/urun/iphone-15-ekran-koruyucu'), 'suggested')
    assert.equal(await s('https://onopostore.com/airpods-pro-kilif'), 'none')
    const r = await classifyUrl('https://onopostore.com/eski-kampanya/', deps)
    assert.equal(r.current, P401)
})
