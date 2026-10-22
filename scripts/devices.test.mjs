// Unit tests for the device pages (/cihaz/): the name rules (lib/devices/match.ts) on hand-picked and real catalogue
// names (scripts/fixtures/guide-catalog.json: the active products' public names, read 2026-10-22), the page threshold,
// slugs, texts, the product page link, the sitemap rows (app/sitemap.ts with a fake D1), the edge-cache rules, the
// reserved-slug lists and the old-URL resolver (lib/redirects.ts must treat /cihaz/ as live and never guess under it).
// Run: node --test scripts/devices.test.mjs   (Node 23.6+ strips the TypeScript types itself)
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

// '@/…', extensionless relative paths and directories (index.ts) resolve to the .ts files; '@/lib/db' (Cloudflare context) is a fake
// that hands app/sitemap.ts the D1 stand-in in globalThis.__testDb.
const ROOT = new URL('../', import.meta.url)
const FAKE_DB_MODULE = 'data:text/javascript,export async function getDB() { return globalThis.__testDb }'
registerHooks({
    resolve(specifier, context, next) {
        if (specifier === '@/lib/db') return { url: FAKE_DB_MODULE, shortCircuit: true }
        let spec = specifier.startsWith('@/') ? new URL(specifier.slice(2), ROOT).href : specifier
        if ((spec.startsWith('.') || spec.startsWith('file:')) && !/\.[cm]?[jt]sx?$/.test(spec)) {
            for (const ext of ['.ts', '.tsx', '/index.ts']) {
                const url = new URL(spec + ext, context.parentURL)
                if (existsSync(fileURLToPath(url))) return next(url.href, context)
            }
        }
        return next(spec, context)
    },
})
const D = await import('../lib/devices/index.ts')
const seo = await import('../lib/seo.ts')
const routing = await import('../lib/seo-routing.ts')
const edge = await import('../lib/edge-cache.ts')
const R = await import('../lib/redirects.ts')
const analytics = await import('../lib/analytics.ts')
const pageContext = await import('../components/assistant/page-context.ts')
const gf = await import('../lib/google-feed.ts')

const CATALOG = JSON.parse(readFileSync(new URL('fixtures/guide-catalog.json', import.meta.url), 'utf8'))
const byName = part => {
    const p = CATALOG.find(x => x.name.includes(part))
    assert.ok(p, `fixture has a product named like "${part}"`)
    return p
}
const slugsOf = name => D.modelsInName(name).map(m => m.slug)
const catalog = D.buildDeviceCatalog(CATALOG)
const page = slug => {
    const p = catalog.bySlug.get(slug)
    assert.ok(p, `page ${slug} exists`)
    return p
}
const namesOn = slug => page(slug).productIds.map(id => CATALOG.find(p => p.id === id).name)

// ---------------------------------------------------------------------------------------------
// Name rules
// ---------------------------------------------------------------------------------------------

test('models: iPhone 15, 15 Pro and 15 Pro Max are three models; a list names each of its models', () => {
    assert.deepEqual(slugsOf('Onopo iPhone 15 Anti Static 9D Tam Ekran Cam Ekran Koruyucu'), ['iphone-15'])
    assert.deepEqual(slugsOf('Onopo iPhone 15 Pro Anti Static 9D Tam Ekran Cam Ekran Koruyucu'), ['iphone-15-pro'])
    assert.deepEqual(slugsOf('Onopo iPhone 15 Pro Max Uyumlu Tam Kaplayan Şeffaf Seramik 12D Cam Ekran Koruyucu'), ['iphone-15-pro-max'])
    assert.deepEqual(slugsOf('Onopo iPhone 13 / 13 Pro Anti Static 9D Tam Ekran Cam Ekran Koruyucu'), ['iphone-13', 'iphone-13-pro'])
    assert.deepEqual(slugsOf('Onopo İPHONE 16 Uyumlu Seramik'), ['iphone-16'])
    assert.deepEqual(D.modelsInName('Onopo iPhone 14 Pro Max Anti Static').map(m => m.label), ['iPhone 14 Pro Max'])
    // Brand words without a model, and numbers with a unit, are not models
    assert.deepEqual(slugsOf('Onopo iPhone Apple Uyumlu Lightning USB iPhone 20W Hızlı Şarj Cihazı 3.4A - M4'), [])
    assert.deepEqual(slugsOf('Onopo iPhone ve Android Uyumlu 20W Type-C Girişli Şarj Başlığı - M3'), [])
})

test('models: Redmi Note 12, 12 Pro, 12 Pro Plus, 12S and Redmi 12 stay apart; Mi 13T is not a Redmi', () => {
    assert.deepEqual(slugsOf('Onopo Xiaomi Redmi Note 12 Anti Static 9D Tam Ekran Cam Ekran Koruyucu'), ['redmi-note-12'])
    assert.deepEqual(slugsOf('Onopo Redmi Note 12 Pro Uyumlu Tam Kaplayan Şeffaf Seramik 12D Cam Ekran Koruyucu'), ['redmi-note-12-pro'])
    assert.deepEqual(slugsOf('Onopo Xiaomi Redmi Note 12 Pro Plus Anti Static 9D Tam Ekran Cam Ekran Koruyucu'), ['redmi-note-12-pro-plus'])
    assert.deepEqual(slugsOf('Onopo Xiaomi Redmi Note 12S Anti Static 9D Tam Ekran Cam Ekran Koruyucu'), ['redmi-note-12s'])
    assert.deepEqual(slugsOf('Onopo Redmi 12 Uyumlu Tam Kaplayan Şeffaf Seramik 12D Cam Ekran Koruyucu'), ['redmi-12'])
    assert.deepEqual(slugsOf('Onopo Xiaomi Redmi 10A Anti Static 9D Tam Ekran Cam Ekran Koruyucu'), ['redmi-10a'])
    assert.deepEqual(D.modelsInName('Onopo Xiaomi Redmi Mi 13T / Mi 13T Pro Anti Static 9D').map(m => m.label), ['Mi 13T', 'Mi 13T Pro'])
    assert.deepEqual(D.modelsInName('Onopo İnfinix Note 30 Pro Anti Static').map(m => m.label), ['Infinix Note 30 Pro'])
})

test('models: Samsung phones are Galaxy models; tablets (Tab, SM-T/SM-P codes) are their own brand; sizes are not models', () => {
    const s24u = D.modelsInName('Onopo Samsung S24 Ultra Anti Static 9D Tam Ekran Cam Ekran Koruyucu')
    assert.deepEqual(s24u.map(m => [m.slug, m.label, m.brand]), [['samsung-galaxy-s24-ultra', 'Galaxy S24 Ultra', 'samsung']])
    assert.deepEqual(slugsOf('Onopo Samsung S24 Anti Static 9D'), ['samsung-galaxy-s24'])
    const lite = 'Onopo Samsung Galaxy Tab S6 Lite SM-P615 10.4 İnç Siyah Ekran Çerçeveli Seramik Cam Ekran Koruyucu'
    assert.deepEqual(D.modelsInName(lite).map(m => [m.slug, m.label, m.brand]), [['samsung-galaxy-tab-s6-lite', 'Galaxy Tab S6 Lite', 'samsung-tablet']])
    assert.deepEqual(D.brandsInName(lite), ['samsung-tablet'])
    assert.deepEqual(slugsOf('Onopo Samsung Galaxy Tab S7 T870 11 İnç Siyah Ekran Çerçeveli'), ['samsung-galaxy-tab-s7'])
    assert.deepEqual(slugsOf('Onopo Samsung Galaxy Tab S5e 10.5 İnç T720, T725 Siyah'), ['samsung-galaxy-tab-s5e'])
    assert.deepEqual(D.modelsInName('Onopo Samsung T515 Siyah Ekran Çerçeveli').map(m => [m.label, m.brand]), [['Samsung T515', 'samsung-tablet']])
    assert.deepEqual(slugsOf('Onopo MediaPad T5 10.1 İnç Siyah Ekran Çerçeveli'), ['huawei-mediapad-t5'])
    assert.deepEqual(slugsOf("Onopo Huawei MediaPad T3 7'' Siyah Ekran Çerçeveli"), ['huawei-mediapad-t3'])
    assert.deepEqual(slugsOf('Onopo iPad Air 5 / 6 Siyah Ekran Çerçeveli'), ['ipad-air-5', 'ipad-air-6'])
})

test('brands: brand words only ("Android Xiaomi ve Samsung" is both); unbranded model codes belong to no brand', () => {
    assert.deepEqual(D.brandsInName('Onopo Android Xiaomi ve Samsung Uyumlu Type-C USB Hızlı Şarj ve Data Kablosu 3.0A / 1MT - D7').sort(), ['samsung', 'xiaomi-redmi'])
    assert.deepEqual(D.modelsInName('Onopo Android Xiaomi ve Samsung Uyumlu Micro USB Hızlı Şarj ve Data Kablosu 3.0A / 1MT - D6'), [])
    assert.deepEqual(D.brandsInName('Onopo D880 GT-E1190 GT-E1150 GT-E1205 GT-E1207 SM-D880 Uyumlu Şarj Cihazı - X1'), [])
    assert.deepEqual(D.brandsInName('Onopo T310 9.6 İnç Siyah Ekran Çerçeveli Seramik Cam Ekran Koruyucu'), [])
    assert.deepEqual(D.brandsInName('Onopo 10000 mAh Şarj Edilebilir Led Göstergeli Taşınabilir Powerbank'), [])
})

test('connectors: the phone end decides; ports only where certain', () => {
    assert.equal(D.productConnector('Onopo iPhone Apple Uyumlu Type-C to Lightning PD 20W Hızlı Şarj ve Data Kablosu 100CM - P4'), 'lightning')
    assert.equal(D.productConnector('Onopo Android Xiaomi ve Samsung Uyumlu Micro to USB Kablo 3.4A'), 'micro-usb')
    assert.equal(D.productConnector('T120 USB-A to Type-C Turbo Şarj ve Data Kablosu | 120W GaN'), 'usb-c')
    assert.equal(D.productConnector('Onopo 3.4A USB Girişli Hızlı Şarj Adaptörü - X9'), null)
    assert.equal(D.modelConnector({ brand: 'iphone', slug: 'iphone-14-pro-max' }), 'lightning')
    assert.equal(D.modelConnector({ brand: 'iphone', slug: 'iphone-11' }), 'lightning')
    assert.equal(D.modelConnector({ brand: 'iphone', slug: 'iphone-se' }), 'lightning')
    assert.equal(D.modelConnector({ brand: 'iphone', slug: 'iphone-15' }), 'usb-c')
    assert.equal(D.modelConnector({ brand: 'iphone', slug: 'iphone-16-pro-max' }), 'usb-c')
    assert.equal(D.modelConnector({ brand: 'samsung', slug: 'samsung-galaxy-s24-ultra' }), 'usb-c')
    // Redmi phones mix Micro USB and USB-C, tablets are not charged by the rule: no connector rule
    assert.equal(D.modelConnector({ brand: 'xiaomi-redmi', slug: 'redmi-note-12' }), null)
    assert.equal(D.modelConnector({ brand: 'samsung-tablet', slug: 'samsung-galaxy-tab-s7' }), null)
    // Only chargers, cables and car chargers (lib/product-type, shared with the Google feed) whose connector is the
    // plug for the phone: a charger's own Type-C port needs a separate cable (it fits a Lightning iPhone as well)
    assert.equal(D.isConnectorProduct('Onopo 22W USB Hızlı Şarj Aleti Seti Esnek Type-C Kablo - M9'), true)
    assert.equal(D.isConnectorProduct('Onopo Android Xiaomi ve Samsung Uyumlu Type-C to Type-C PD 25W Hızlı Şarj ve Data Kablosu 100CM - P5'), true)
    assert.equal(D.isConnectorProduct('Onopo iPhone ve Android Uyumlu 20W Type-C Girişli Şarj Başlığı - M3'), false)
    assert.equal(D.isConnectorProduct('Onopo 48W Type-C ve USB Girişli Turbo Şarj Adaptörü Başlığı - M5'), false)
    assert.equal(D.isConnectorProduct('Onopo 3.4A Type-C (PD) ve Çift USB Girişli Turbo Hızlı Araç Şarjı 55W - A8'), false)
    assert.equal(D.isConnectorProduct('Onopo 3.4A Çift USB + Type-C Çıkışlı Metal Hızlı Araç Şarjı 40W - A9'), false)
    assert.equal(D.isConnectorProduct('Onopo 30W Turbo PD Type-C Hızlı Şarj Cihazı Adaptör + Şarj Kablosu - M2'), false)
    assert.equal(D.isConnectorProduct('Onopo iPhone 15 Anti Static 9D Tam Ekran Cam Ekran Koruyucu'), false)
    assert.equal(D.isConnectorProduct('Onopo 20000 mAh Şarj Edilebilir Led Göstergeli Taşınabilir Powerbank'), false)
    assert.deepEqual(gf.classifyProduct('Onopo iPhone ve Android Uyumlu 20W Type-C Girişli Şarj Başlığı - M3'), { type: 'Şarj Aleti', google: 505295 })
})

// ---------------------------------------------------------------------------------------------
// Pages from the real catalogue
// ---------------------------------------------------------------------------------------------

test('catalogue: the pages the real names give, slugs unique and URL-safe, every page has at least 3 products', () => {
    const slugs = catalog.pages.map(p => p.slug)
    assert.deepEqual(slugs, [
        'iphone', 'iphone-11', 'iphone-11-pro', 'iphone-13', 'iphone-13-pro', 'iphone-13-pro-max', 'iphone-14-pro', 'iphone-14-pro-max',
        'iphone-15', 'iphone-15-pro', 'iphone-15-pro-max', 'iphone-16', 'iphone-16-pro', 'iphone-16-pro-max',
        'samsung', 'samsung-galaxy-s24', 'samsung-galaxy-s24-plus', 'samsung-galaxy-s24-ultra',
        'xiaomi-redmi', 'samsung-tablet', 'huawei',
    ])
    assert.equal(new Set(slugs).size, slugs.length)
    for (const p of catalog.pages) {
        assert.match(p.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, p.slug)
        assert.ok(p.productIds.length >= D.MIN_DEVICE_PRODUCTS, p.slug)
        assert.equal(new Set(p.productIds).size, p.productIds.length, `${p.slug} lists a product once`)
        assert.equal(D.devicePath(p.slug), `/cihaz/${p.slug}/`)
        assert.ok(!routing.RESERVED_SLUGS.includes(p.slug), p.slug)
    }
    // Brands and models too small for a page are still listed (on the hub / their brand page)
    const ipad = catalog.brands.find(b => b.id === 'ipad')
    assert.equal(ipad.hasPage, false)
    assert.equal(ipad.productIds.length, 2)
    const xiaomi = catalog.brands.find(b => b.id === 'xiaomi-redmi')
    assert.equal(xiaomi.hasPage, true)
    assert.ok(xiaomi.models.some(m => m.slug === 'redmi-note-12' && !m.hasPage && m.namedIds.length === 2))
    assert.ok(!catalog.bySlug.has('redmi-note-12'))
})

test('iPhone 15 page: its own screen protectors and USB-C chargers/cables; never 15 Pro protectors, Lightning, Micro USB or power banks', () => {
    const names = namesOn('iphone-15')
    assert.ok(names.includes(byName('iPhone 15 Anti Static').name))
    assert.ok(names.includes(byName('iPhone 15 Uyumlu Tam Kaplayan').name))
    assert.ok(names.includes(byName('T120 USB-A to Type-C').name))
    assert.ok(names.includes(byName('Type-C to Type-C PD 25W').name))
    assert.ok(!names.includes(byName('20W Type-C Girişli Şarj Başlığı').name), 'a charger port is not the phone plug')
    for (const n of names) {
        assert.doesNotMatch(n, /iPhone 15 Pro|Lightning|Micro|Powerbank|Kulaklık|Girişli|Çıkışlı|Adaptör|X9$/, n)
        if (/Ekran Koruyucu/.test(n)) assert.match(n, /iPhone 15 /, n)
    }
    assert.deepEqual(page('iphone-15').namedIds.length, 2)
    assert.ok(!namesOn('iphone-15-pro').some(n => /iPhone 15 Pro Max/.test(n)))
    assert.ok(!namesOn('iphone-15-pro-max').some(n => /iPhone 15 (Anti|Uyumlu|Pro Anti|Pro Uyumlu)/.test(n)))
})

test('iPhone 14 Pro page: Lightning products and its own protectors; no USB-C-only product, no 14 Pro Max protector', () => {
    const names = namesOn('iphone-14-pro')
    assert.ok(names.some(n => /Type-C to Lightning/.test(n)))
    assert.ok(names.includes(byName('iPhone 14 Pro Anti Static').name))
    for (const n of names) {
        assert.ok(/Lightning/.test(n) || /iPhone 14 Pro (Anti|Uyumlu)/.test(n), n)
        assert.doesNotMatch(n, /14 Pro Max/, n)
    }
    // "13 / 13 Pro" is on both model pages
    const both = byName('iPhone 13 / 13 Pro').id
    assert.ok(page('iphone-13').productIds.includes(both))
    assert.ok(page('iphone-13-pro').productIds.includes(both))
    assert.ok(!page('iphone-13-pro-max').productIds.includes(both))
})

test('Samsung pages: Galaxy S24 gets USB-C products; the brand page has Samsung-named products only; tablets apart', () => {
    for (const n of namesOn('samsung-galaxy-s24')) assert.doesNotMatch(n, /Lightning|Micro|S24 (Plus|Ultra)/, n)
    for (const n of namesOn('samsung')) {
        assert.match(n, /Samsung/, n)
        assert.doesNotMatch(n, /Tab|T515/, n)
    }
    for (const n of namesOn('samsung-tablet')) assert.match(n, /Samsung/, n)
    assert.equal(namesOn('samsung-tablet').length, 5)
    assert.ok(namesOn('iphone').every(n => /iPhone/.test(n)), 'the iPhone brand page: iPhone-named products (all Lightning ones are)')
    assert.equal(namesOn('huawei').length, 3)
})

test('threshold: a model needs 3 products (named, or by a certain connector), a brand needs 3 named products', () => {
    const two = D.buildDeviceCatalog([
        { id: 1, name: 'Onopo Redmi Note 99 Ekran Koruyucu' },
        { id: 2, name: 'Onopo Redmi Note 99 Seramik Ekran Koruyucu' },
    ])
    assert.equal(two.pages.length, 0)
    assert.deepEqual(two.brands.map(b => [b.id, b.hasPage, b.models.map(m => m.slug)]), [['xiaomi-redmi', false, ['redmi-note-99']]])
    const three = D.buildDeviceCatalog([...[1, 2, 3].map(id => ({ id, name: `Onopo Redmi Note 99 Ekran Koruyucu ${id}` }))])
    assert.deepEqual(three.pages.map(p => p.slug), ['xiaomi-redmi', 'redmi-note-99'])
    // One iPhone 15 protector + two USB-C cables = 3: a model page, but no iPhone brand page (1 iPhone-named product)
    const mixed = D.buildDeviceCatalog([
        { id: 1, name: 'Onopo iPhone 15 Ekran Koruyucu' },
        { id: 2, name: 'Onopo Type-C to Type-C Şarj ve Data Kablosu' },
        { id: 3, name: 'Onopo 30W Type-C Şarj Aleti' },
        { id: 4, name: 'Onopo Micro USB Şarj ve Data Kablosu' },
    ])
    assert.deepEqual(mixed.pages.map(p => [p.slug, p.productIds]), [['iphone-15', [1, 2, 3]]])
    // … which answers for visitors but is noindex: only one product names the model (near-duplicate of every
    // other USB-C model page)
    const mixedProducts = [1, 2, 3, 4].map(id => ({ id, name: '', in_stock: true }))
    assert.equal(D.isIndexableDevicePage(mixed.pages[0], mixedProducts), false)
    assert.deepEqual(D.devicePagePaths(mixedProducts, mixed), [])
})

test('product page link: exactly one model page, else exactly one brand page, else none', () => {
    const link = part => D.devicePageForProduct(catalog, byName(part))?.slug ?? null
    assert.equal(link('iPhone 15 Anti Static'), 'iphone-15')
    assert.equal(link('iPhone 15 Pro Max Anti Static'), 'iphone-15-pro-max')
    assert.equal(link('iPhone 13 / 13 Pro'), 'iphone', 'two model pages: the brand')
    assert.equal(link('Redmi Note 12 Pro Uyumlu'), 'xiaomi-redmi', 'model without a page: the brand')
    assert.equal(link('Galaxy Tab S6 Lite'), 'samsung-tablet')
    assert.equal(link('Lightning USB Hızlı Şarj ve Data Kablosu 3.0A'), 'iphone')
    assert.equal(link('Type-C USB Hızlı Şarj ve Data Kablosu 3.0A'), null, 'Xiaomi and Samsung: no single page')
    assert.equal(link('T120 USB-A to Type-C'), null, 'connector rules do not pick a page')
    assert.equal(link('iPad Air 5 / 6'), null, 'iPad has no page')
    assert.equal(link('20000 mAh'), null)
})

// ---------------------------------------------------------------------------------------------
// Texts
// ---------------------------------------------------------------------------------------------

test('groups, titles and intros come from the real products: in stock first, no prices, titles fit', () => {
    for (const p of catalog.pages) {
        const products = D.devicePageProducts(p, CATALOG)
        assert.equal(products.length, p.productIds.length)
        const groups = D.groupDeviceProducts(products)
        assert.equal(groups.flatMap(g => g.products).length, products.length, `${p.slug}: every product in one group`)
        for (const g of groups) {
            const stock = g.products.map(x => x.in_stock)
            assert.deepEqual(stock, [...stock].sort((a, b) => Number(b) - Number(a)), `${p.slug}/${g.group.key}: in stock first`)
        }
        const title = D.deviceTitle(p, groups)
        assert.ok(title.startsWith(p.label), title)
        assert.ok((title + seo.SITE.titleSuffix).length <= 60, title)
        const intro = D.deviceIntro(p, groups, D.deviceBrandOf(catalog, p))
        assert.ok(intro.includes(`${p.label} için ${products.length} ürün var`), intro)
        assert.doesNotMatch(intro, /₺|TL\b|garanti|teslim|kargo/i, intro)
        assert.equal(D.deviceH1(p), `${p.label} aksesuarları`)
        const md = seo.buildMetadata({ title, description: seo.categoryMetaDescription(D.deviceH1(p), { count: products.length }), path: D.devicePath(p.slug) })
        assert.equal(md.alternates.canonical, `https://onopostore.com/cihaz/${p.slug}/`)
    }
    const groups = D.groupDeviceProducts(D.devicePageProducts(page('iphone-15'), CATALOG))
    assert.deepEqual(groups.map(g => g.group.key), ['ekran-koruyucu', 'sarj-aleti', 'kablo'])
    assert.equal(D.deviceTitle(page('iphone-15'), groups), 'iPhone 15 Ekran Koruyucu, Şarj Aleti ve Kablo')
    assert.equal(D.deviceTitle(page('iphone-15-pro-max'), groups), 'iPhone 15 Pro Max Ekran Koruyucu ve Şarj Aleti')
    assert.match(D.deviceIntro(page('iphone-15'), groups), /USB-C girişli olduğu için/)
    assert.match(D.deviceIntro(page('iphone-14-pro'), D.groupDeviceProducts(D.devicePageProducts(page('iphone-14-pro'), CATALOG))), /Lightning girişli olduğu için/)
    const xiaomi = page('xiaomi-redmi')
    assert.match(D.deviceIntro(xiaomi, D.groupDeviceProducts(D.devicePageProducts(xiaomi, CATALOG)), D.deviceBrandOf(catalog, xiaomi)), /Adında model geçen ürünler: Mi 13T, .* ve \d+ model daha\./)
})

test('related guides and sibling models', () => {
    const guides = D.relatedDeviceGuides(D.devicePageProducts(page('samsung-tablet'), CATALOG))
    assert.equal(guides[0]?.slug, 'tablet-ekran-koruyucu-model-kodu-bulma')
    assert.ok(D.relatedDeviceGuides(D.devicePageProducts(page('iphone-15'), CATALOG)).length >= 1)
    const siblings = D.siblingDevicePages(catalog, page('iphone-15')).map(p => p.slug)
    assert.ok(siblings.includes('iphone-15-pro') && siblings.includes('iphone-11'))
    assert.ok(!siblings.includes('iphone-15') && !siblings.includes('iphone') && !siblings.includes('samsung-galaxy-s24'))
})

// ---------------------------------------------------------------------------------------------
// URLs: page list, sitemap, edge cache, reserved slugs, redirects
// ---------------------------------------------------------------------------------------------

test('devicePagePaths: the hub and every indexable page; sold-out and connector-filled model pages are left out (noindex)', () => {
    const paths = D.devicePagePaths(CATALOG)
    assert.equal(paths[0], '/cihaz/')
    // Today no model has 3 products naming it: the model pages answer (noindex), the brand pages are indexed
    assert.deepEqual(paths.slice(1), ['/cihaz/iphone/', '/cihaz/samsung/', '/cihaz/xiaomi-redmi/', '/cihaz/samsung-tablet/', '/cihaz/huawei/'])
    for (const p of catalog.pages) assert.equal(D.isIndexableDevicePage(p, CATALOG), p.kind === 'brand', p.slug)
    assert.deepEqual(D.deviceLlmsLinks(CATALOG).map(l => l.path), paths)
    assert.deepEqual(D.deviceLlmsLinks(CATALOG)[1], { label: 'iPhone aksesuarları', path: '/cihaz/iphone/', note: `${page('iphone').productIds.length} ürün` })
    const soldOut = [1, 2, 3].map(id => ({ id, name: `Onopo Redmi Note 99 Ekran Koruyucu ${id}`, in_stock: false }))
    assert.deepEqual(D.devicePagePaths(soldOut), [])
    assert.deepEqual(D.devicePagePaths([...soldOut.slice(0, 2), { ...soldOut[2], in_stock: true }]), ['/cihaz/', '/cihaz/xiaomi-redmi/', '/cihaz/redmi-note-99/'])
    assert.deepEqual(D.devicePagePaths([{ id: 1, name: 'Onopo 3.4A USB Girişli Hızlı Şarj Adaptörü - X9', stock: 5 }]), [])
})

test('sitemap: /cihaz/ and the device pages with lastmod from their products; guides and the rest unchanged', async () => {
    const products = CATALOG.map((p, i) => ({
        id: p.id, name: p.name, stock: p.in_stock ? 5 : 0, slug: seo.slugifyTr(p.name), images: '[]',
        updated_at: p.id === byName('iPhone 15 Anti Static').id ? '2026-10-21 08:00:00' : '2026-10-01 00:00:00', created_at: '2026-01-01 00:00:00',
    }))
    globalThis.__testDb = {
        prepare: sql => ({
            all: async () => ({
                results: /FROM products/.test(sql) && !/categories/.test(sql) ? products : /FROM categories/.test(sql) ? [{ slug: 'cep-telefonu-aksesuarlari', lastmod: '2026-10-20 10:00:00' }] : [{ slug: 'help', updated_at: '2026-09-01 00:00:00' }],
            }),
        }),
    }
    const { default: sitemap } = await import('../app/sitemap.ts')
    const entries = await sitemap()
    const byUrl = new Map(entries.map(e => [e.url, e]))
    assert.equal(entries.length, byUrl.size, 'no duplicates')
    for (const path of D.devicePagePaths(CATALOG)) assert.ok(byUrl.has(`https://onopostore.com${path}`), path)
    assert.equal(byUrl.get('https://onopostore.com/cihaz/iphone/').lastModified, '2026-10-21T08:00:00.000Z')
    assert.ok(!byUrl.has('https://onopostore.com/cihaz/iphone-15/'), 'noindex model page')
    assert.equal(byUrl.get('https://onopostore.com/cihaz/').lastModified, '2026-10-21T08:00:00.000Z')
    assert.equal(byUrl.get('https://onopostore.com/cihaz/huawei/').lastModified, '2026-10-01T00:00:00.000Z')
    assert.ok(!byUrl.has('https://onopostore.com/cihaz/redmi-note-12/'))
    for (const url of ['https://onopostore.com/', 'https://onopostore.com/rehber/', 'https://onopostore.com/kategori/cep-telefonu-aksesuarlari/', 'https://onopostore.com/page/help/']) {
        assert.ok(byUrl.has(url), url)
    }
    // IndexNow's daily sweep takes its list from this sitemap (app/api/cron/automation job=indexnow): the first
    // run sends every indexable device page, never a noindex one
    const ix = await import('../lib/indexnow.ts')
    const { changed } = ix.planIndexNowSweep(entries.map(e => ({ url: e.url, lastModified: e.lastModified ?? null })), new Map())
    for (const path of D.devicePagePaths(CATALOG)) assert.ok(changed.includes(`https://onopostore.com${path}`), path)
    assert.ok(!changed.includes('https://onopostore.com/cihaz/iphone-15/'))
    // Rows without names (an older query shape) add no device page
    assert.deepEqual(D.deviceSitemapEntries([{ id: 1, name: '', stock: 1 }]), [])
})

test('edge cache: the hub and the device pages are cacheable public pages (not product pages)', () => {
    const html = 'text/html; charset=utf-8'
    for (const path of ['/cihaz/', '/cihaz/iphone-15/']) {
        assert.equal(edge.isCacheablePath(path), true, path)
        assert.equal(edge.isProductSlugPath(path), false, path)
        assert.equal(edge.isStorableBody(path, html, '<main><h1>iPhone 15 aksesuarları</h1></main>'), true, path)
        assert.equal(edge.isStorableBody(path, html, '<div hidden data-onopo-nocache=""></div>'), false, path)
    }
    assert.equal(edge.isCacheablePath('/cihaz/a/b/'), false)
    assert.equal(edge.isCacheablePath('/cihaz/iPhone-15/'), false)
})

test('reserved: "cihaz" is never a product slug (routing, analytics, assistant page context)', () => {
    assert.ok(routing.RESERVED_SLUGS.includes('cihaz'))
    assert.equal(analytics.productSlugOf('/cihaz/'), null)
    assert.equal(pageContext.isProductPath('/cihaz/'), false)
    assert.notEqual(pageContext.pageContext('/cihaz/').type, 'product')
    // The guides hub was missing from the assistant's list (it asked for a product named "rehber")
    assert.equal(pageContext.isProductPath('/rehber/'), false)
})

const index = R.buildIndex({
    products: CATALOG.map(p => ({ id: p.id, slug: seo.slugifyTr(p.name), name: p.name, is_active: 1, images: '[]' })),
    categories: [{ name: 'Cep Telefonu Aksesuarları', slug: 'cep-telefonu-aksesuarlari', product_count: 108 }],
    pages: [{ slug: 'help' }],
})
const resolveTarget = async path => (await R.resolvePath(path, { index }))?.target ?? null

test('redirects: /cihaz/ pages are live targets, never redirected from, and nothing under /cihaz/ is guessed', async () => {
    assert.equal(R.isLiveTarget('/cihaz/', index), true)
    assert.equal(R.isLiveTarget('/cihaz/iphone-15/', index), true)
    assert.equal(R.isLiveTarget('/cihaz/samsung-tablet/', index), true)
    assert.equal(R.isLiveTarget('https://onopostore.com/cihaz/iphone-15-pro-max/', index), true)
    assert.equal(R.isLiveTarget('/cihaz/redmi-note-12/', index), false, 'no page: fewer than 3 products')
    assert.equal(R.isLiveTarget('/cihaz/ipad/', index), false)

    assert.deepEqual(R.validateRedirect('/iphone-15-aksesuar/', '/cihaz/iphone-15/', index), { ok: true, from: '/iphone-15-aksesuar/', to: '/cihaz/iphone-15/' })
    assert.equal(R.validateRedirect('/cihaz/iphone-15/', '/products/', index).ok, false)
    assert.equal(R.validateRedirect('/cihaz/', '/products/', index).ok, false)

    // Model names that would fuzzy-match a product stay 404s under /cihaz/
    assert.equal(await resolveTarget('/cihaz/redmi-note-12/'), null)
    assert.equal(await resolveTarget('/cihaz/iphone-12/'), null)
    assert.equal(await resolveTarget(`/cihaz/${seo.slugifyTr(byName('iPhone 15 Anti Static').name)}/`), null)
    assert.equal(await resolveTarget('/cihaz/iphone-15/eski/'), null)
    // Another spelling of a real page goes to it in one hop
    assert.equal(await resolveTarget('/cihaz/iphone-15.html'), '/cihaz/iphone-15/')
    assert.equal(R.isLegacyPattern('/cihaz/x'), false)
})
