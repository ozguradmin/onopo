// Unit tests for the SEO text generators and URL helpers: lib/seo.ts, lib/seo-routing.ts, components/layout/nav-data.ts.
// Run: node --test scripts/seo.test.mjs   (Node 23.6+ strips the TypeScript types itself)
// When the local D1 copy (.wrangler/state) exists, the last test also checks every active product for unique
// <title>s and meta descriptions; without it that test is skipped.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

// The app imports '@/…' and extensionless relative paths ('./stripHtml'); resolve them to the .ts files.
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
const seo = await import('../lib/seo.ts')
const routing = await import('../lib/seo-routing.ts')
const nav = await import('../components/layout/nav-data.ts')

const SITE = { ...seo.DEFAULT_SITE_SEO, freeShippingThreshold: 500, shippingCost: 100, returnPolicy: { days: 14, freeReturn: true } }
const html = (title, body) => `<div class="product-description space-y-4">Ürün Açıklaması${title}Detaylı Bilgi${body}Teknik ÖzelliklerMarkaOnopoDesi0</div>`
const product = (over) => ({ id: 1, slug: 'x', price: 199.9, stock: 5, free_shipping: 0, images: '[]', category: 'Cep Telefonu Aksesuarları', ...over })

// Excerpts of real product texts (public product descriptions).
const F8 = product({
    id: 1165,
    name: 'Onopo İphone Apple Uyumlu 3.4A Lightning Apple Örgülü Hızlı Şarj ve Data Kablosu 30W Metal Uçlu ( 5 Yıl Garanti Güvencesiyle )-F8',
    description: html('İphone Şarj ve Data Kablosu', 'İphone Uyumlu 3.4a Lightning Örgülü Hızlı Şarj Ve Data Kablosu 30w Metal Uçlu (5YIL GARANTİ)-F8 iPhone cihazlarınız için özel olarak tasarlanmış, 3.4A hızlı şarj ve data aktarımı sağlayan Lightning bağlantı tipine sahip kablo.30 watt gücünde metal uçları ile dayanıklılığı artırırken, hızlı şarj deneyimi sunar.5 yıl ithalatçı garantisi ile güvenilir kullanım ve uzun ömürlülük garantisi.220 - 240 volt aralığında çalışabilen geniş voltaj desteği, farklı güç kaynaklarıyla uyumluluk sağlar.C ve F priz tipi ile dünya genelinde yaygın olarak kullanılan prizlerle uyumlu kullanım imkanı.'),
})
const Q5 = product({
    id: 1172,
    name: 'onopo İphone Apple Uyumlu Lightning To Usb Kablo 3.4a Uyumlu Hızlı Şarj Ve Data Kablosu 2m - Q5',
    description: html('İphone Şarj ve Data Kablosu', 'İphone Uyumlu Şarj Kablosu Lightning To Usb Kablo 3.4a Uyumlu Hızlı Şarj Ve Data Kablosu 2m - Q5 iPhone ve diğer Lightning bağlantı tipine sahip cihazlarla tam uyumlu, hızlı şarj ve veri aktarımı için ideal bir kablo.3.4A hızlı şarj özelliği ile cihazlarınızı kısa sürede tam enerjiye kavuşturur.İthalatçı garantisi altında olup, satın alma sonrasında da güvenle kullanabilirsiniz.'),
})

test('productInfoHtml: hidden images are lazy (never fetched in the display:none block), the rest of the markup is unchanged', () => {
    const p = product({ id: 1150, name: 'onopo 67w "Şarj" Seti - M6', product_code: null, original_price: 400, images: JSON.stringify(['/api/images/a.png', 'https://images.onopostore.com/b.png']) })
    const out = seo.productInfoHtml(p)
    assert.equal(out, [
        '',
        '  <h1 id="product-name">onopo 67w &quot;Şarj&quot; Seti - M6</h1>',
        '  <span id="product-price">199,99 ₺</span>',
        '  <span id="product-original-price">399,99 ₺</span>',
        '  <span id="product-sku">ONOPO-1150</span>',
        '  <span id="product-stock">Stokta</span>',
        '  <span id="product-category">Cep Telefonu Aksesuarları</span>',
        '  <img id="product-image-1" src="https://images.onopostore.com/a.png" alt="onopo 67w &quot;Şarj&quot; Seti - M6" loading="lazy" />',
        '  <img id="product-image-2" src="https://images.onopostore.com/b.png" alt="onopo 67w &quot;Şarj&quot; Seti - M6" loading="lazy" />',
        '  <a id="add-to-cart" href="/cart?add=1150">Sepete Ekle</a>',
        '  <a id="buy-now" href="/checkout?product=1150">Hemen Al</a>',
        '',
    ].join('\n'))
    for (const tag of out.match(/<img [^>]*>/g)) assert.match(tag, / loading="lazy" \/>$/)
})

test('productJsonLd keeps brand ONOPO', () => {
    assert.deepEqual(seo.productJsonLd(F8).brand, { '@type': 'Brand', name: 'ONOPO' })
})

test('cleanDescriptionText: space after a period before a number, &le;/&ge; decoded, 3.4A untouched', () => {
    assert.equal(seo.cleanDescriptionText('bir kablo.30 watt gücünde 3.4A ve Bluetooth 5.3'), 'bir kablo. 30 watt gücünde 3.4A ve Bluetooth 5.3')
    assert.equal(seo.cleanDescriptionText('Çalışma gerilimi: &le;36V, &ge;5V'), 'Çalışma gerilimi: ≤36V, ≥5V')
})

test("productDescriptionLead: a lead starting with 'iPhone' is not taken for a cut mid-sentence (ids 1165, 1172)", () => {
    assert.match(seo.productDescriptionLead(F8), /^iPhone cihazlarınız için özel olarak tasarlanmış/)
    assert.match(seo.productDescriptionLead(Q5), /^iPhone ve diğer Lightning/)
    for (const p of [F8, Q5]) {
        const d = seo.productMetaDescription(p, SITE)
        assert.doesNotMatch(d, /priz|İthalatçı garantisi altında/)
        assert.ok(d.length <= 160, d)
    }
})

test("productDescriptionLead: no 'Model - F1' label or echoed title fragment in front", () => {
    const f1 = product({ name: 'onopo Audio 3.5MM Aux Kablosu 1,5 Metre - F1', description: html('Aux Kablosu', 'Audio 3.5mm Aux Kablosu - F1 Model - F1 Yüksek kaliteli 3.5mm jack bağlantı noktası, geniş uyumluluk sunar.Kablo uzunluğu 1 metre olup, ses aktarımını mümkün kılar.') })
    assert.match(seo.productDescriptionLead(f1), /^Yüksek kaliteli 3\.5mm jack/)
    const m2 = product({ name: 'onopo 30W Turbo PD Type-C Hızlı Şarj Cihazı Adaptör + Şarj Kablosu - M2', description: html('Type-C Şarj Cihazı', 'Android Xiaomi Ve Samsung Uyumlu 30w Turbo Pd Type-c Hızlı Şarj Cihazı Adaptör Şarj Kablosu M2 Android ve Samsung cihazlarınız için mükemmel uyumluluk sunan, Type-C bağlantı tipine sahip 30W turbo şarj cihazı ile hızlı şarj deneyimi yaşayın.M2 modeli hızlı şarj özelliğiyle zaman kazandırır.') })
    assert.match(seo.productDescriptionLead(m2), /^Android ve Samsung cihazlarınız için/)
    // A real sentence that starts with the code is kept
    const real = product({ name: 'onopo Audio Kablo - F1', description: html('Kablo', 'F1 modeli, modern tasarımı ile şık bir görünüm sunar. Uzun süre kullanılır.') })
    assert.match(seo.productDescriptionLead(real), /^F1 modeli, modern/)
})

test('productMetaDescription: siblings with the same template text get their own model phrase', () => {
    const body = 'Apple cihazlarınız için özel olarak tasarlanmış Lightning bağlantı tipine sahip, hızlı şarj ve veri aktarımı sağlar.Yüksek kaliteli malzemesi sayesinde uzun ömürlüdür.Q-serisi modeller Onopo güvencesiyle.'
    const q3 = product({ name: 'onopo İphone Apple Uyumlu Lightning To USB Mini Kablo 3.4A Hızlı Şarj ve Data Kablosu 30CM - Q3', description: html('Kablo', body) })
    const q8 = product({ name: 'onopo İphone Apple Uyumlu Lightning To USB Kablo 3.4A Uyumlu Hızlı Şarj ve Data Kablosu 1M - Q8', description: html('Kablo', body) })
    const d3 = seo.productMetaDescription(q3, SITE)
    const d8 = seo.productMetaDescription(q8, SITE)
    assert.notEqual(d3, d8)
    assert.match(d3, /^Onopo Q3 şarj kablosu: Apple cihazlarınız/)
    assert.match(d8, /^Onopo Q8 şarj kablosu: Apple cihazlarınız/)

    const tpl = 'Apple marka cihazlarınız için özel olarak tasarlanmış bu koruyucu, cihazınızın ekranını çizilmelere ve darbelere karşı etkin bir şekilde korur.12D sertlik derecesine sahiptir.'
    const pro = product({ name: 'onopo İphone 13 Pro Uyumlu Tam Kaplayan Şeffaf Seramik 12D Cam Ekran Koruyucu', description: html('CAM EKRAN KORUYUCU', tpl) })
    const max = product({ name: 'onopo İphone 13 Pro Max Uyumlu Tam Kaplayan Şeffaf Seramik 12D Cam Ekran Koruyucu', description: html('CAM EKRAN KORUYUCU', tpl) })
    assert.match(seo.productMetaDescription(pro, SITE), /^iPhone 13 Pro ekran koruyucu: Apple marka/)
    assert.match(seo.productMetaDescription(max, SITE), /^iPhone 13 Pro Max ekran koruyucu: Apple marka/)
    for (const p of [q3, q8, pro, max]) {
        const d = seo.productMetaDescription(p, SITE)
        assert.ok(d.length >= 140 && d.length <= 160, `${d.length}: ${d}`)
        assert.match(d, /500 TL üzeri kargo bedava, 14 gün iade, güvenli ödeme\.$/)
    }

    // A lead that names the model gets no phrase; "iPhone 13 Pro Max …" does not name the "iPhone 13 Pro"
    const named = product({ name: pro.name, description: html('CAM EKRAN KORUYUCU', 'İphone 13 Pro modeli ile tam uyum sağlayan şeffaf seramik cam ekran koruyucu, cihazınızın görünümünü korur.') })
    assert.match(seo.productMetaDescription(named, SITE), /^iPhone 13 Pro modeli ile tam uyum/)
    const wrong = product({ name: pro.name, description: html('CAM EKRAN KORUYUCU', 'İphone 13 Pro Max modeli ile tam uyum sağlayan şeffaf seramik cam ekran koruyucu.') })
    assert.match(seo.productMetaDescription(wrong, SITE), /^iPhone 13 Pro ekran koruyucu: iPhone 13 Pro Max modeli/)
})

test('productModelTokens', () => {
    assert.deepEqual(seo.productModelTokens('Onopo İphone 13 / 13 Pro Anti Static 9D Tam Ekran Cam Ekran Koruyucu'), { device: 'iPhone 13 / 13 Pro' })
    assert.deepEqual(seo.productModelTokens('onopo Samsung Galaxy Tab S7 T870 11 İnç Siyah Ekran Çerçeveli Seramik Cam Ekran Koruyucu'), { device: 'Samsung Galaxy Tab S7 T870' })
    assert.deepEqual(seo.productModelTokens('onopo İphone Apple Uyumlu Lightning Usb İphone 20W Hızlı Şarj Cihazı 3.4A - M4'), { code: 'M4' })
    assert.deepEqual(seo.productModelTokens('onopo BT1 Gürültü Önleyici Bluetooth 5.3 Kablosuz Kulaklık'), { code: 'BT1' })
    assert.deepEqual(seo.productModelTokens('Onopo Xiaomi Redmi 10A Anti Static 9D Tam Ekran Cam Ekran Koruyucu'), { device: 'Xiaomi Redmi 10A' })
    assert.deepEqual(seo.productModelTokens('onopo Süpürgeleri İçin Toz Haznesi Aparatı'), {})
})

test("fitDescription: a filler the text already contains is not repeated (id 1204)", () => {
    const p = product({ name: 'onopo Süpürgeleri İçin Toz Haznesi Aparatı', description: 'onopo Süpürgeleri İçin Toz Haznesi Aparatı' })
    const d = seo.productMetaDescription(p, SITE)
    assert.equal(d.split("Onopo Store'da.").length - 1, 1, d)
})

test('listing descriptions: page N keeps its page marker and differs from page 1', () => {
    const facts = { count: 109, minPrice: 79.99, productNames: ['iPhone Ekran Koruyucu', 'Type-C Şarj Kablosu', 'Hızlı Şarj Aleti', 'Araç Şarjı'] }
    const c1 = seo.categoryMetaDescription('Cep Telefonu Aksesuarları', facts, SITE, 1)
    const c2 = seo.categoryMetaDescription('Cep Telefonu Aksesuarları', facts, SITE, 2)
    assert.notEqual(c1, c2)
    assert.match(c2, /^Cep Telefonu Aksesuarları - Sayfa 2: 109 ürün, 79,99 TL'den/)
    const l1 = seo.listingMetaDescription(facts, SITE, { page: 1 })
    const l3 = seo.listingMetaDescription(facts, SITE, { page: 3 })
    assert.notEqual(l1, l3)
    assert.match(l1, /^Tüm ürünler: 109 ürün, 79,99 TL'den/)
    assert.match(l3, /^Tüm ürünler - Sayfa 3: /)
    for (const d of [c1, c2, l1, l3]) assert.ok(d.length <= 160)
})

test('titles: number and unit stay together, casing fixes, merchandising categories keep their plain name', () => {
    assert.equal(seo.productTitle('onopo Stereo Kablolu Kulaklık Extra Bass Dinleme 3.5MM Kulakiçi Kulaklık - V1'), 'Stereo Kablolu Kulaklık Extra Bass Dinleme 3.5 mm V1')
    assert.equal(seo.productTitle('onopo Pubg Oyun Konsolu 5 In 1 Tüm Telefonlara Uyumlu Oyun Konsolu'), 'PUBG Oyun Konsolu 5 in 1')
    assert.equal(seo.productTitle('onopo iPad Pro 11 İnc Siyah Ekran Çerçeveli Seramik Cam Ekran Koruyucu'), 'iPad Pro 11 inç Siyah Çerçeveli Ekran Koruyucu')
    for (let i = 0; i < 40; i++) {
        const t = seo.productTitle(`onopo ${'Çok Uzun Bir Ürün Adı '.slice(0, i)}Kablolu Kulaklık Extra Bass Dinleme Sesi 3.5MM Kulakiçi Kulaklık`)
        assert.doesNotMatch(t, /\d$/, t)
        assert.ok(t.length <= seo.PRODUCT_TITLE_MAX, t)
    }
    assert.equal(seo.categoryTitle('Çok Satanlar'), 'Çok Satanlar')
    assert.equal(seo.categoryTitle('Çok Satanlar', 2), 'Çok Satanlar - Sayfa 2')
    assert.equal(seo.categoryTitle('Cep Telefonu Aksesuarları'), 'Cep Telefonu Aksesuarları Modelleri ve Fiyatları')
})

/** Fake D1 for the resolvers: no products, pages or categories unless listed. */
function fakeDb({ categories = [], pages = [] } = {}) {
    return {
        prepare(sql) {
            let args = []
            const st = {
                bind(...a) { args = a; return st },
                async first() {
                    if (/FROM categories/.test(sql)) {
                        const key = String(args[0]).toLowerCase()
                        const c = categories.find((x) => x.slug === key || x.name.toLowerCase() === key)
                        return c ? { id: 1, name: c.name, slug: c.slug, product_count: c.count, in_stock_count: c.count } : null
                    }
                    if (/FROM pages/.test(sql)) return pages.includes(args[0]) ? { slug: args[0] } : null
                    return null
                },
                async all() { return { results: [] } },
            }
            return st
        },
    }
}

test('resolveSlug: old shop URLs and legacy listings redirect permanently', async () => {
    const db = fakeDb({ categories: [{ slug: 'new', name: 'Yeni Gelenler', count: 0 }, { slug: 'oyun-ve-oyuncu-aksesuarlari', name: 'Oyun', count: 2 }], pages: ['help'] })
    assert.deepEqual(await routing.resolveSlug('sepet', db), { kind: 'legacy-path', slug: 'sepet', path: '/odeme/', redirect: 'permanent' })
    assert.deepEqual(await routing.resolveSlug('uye-giris', db), { kind: 'legacy-path', slug: 'uye-giris', path: '/login/', redirect: 'permanent' })
    assert.deepEqual(await routing.resolveSlug('new', db), { kind: 'legacy-category', slug: 'new', path: '/products/?sort=newest', redirect: 'permanent' })
    assert.equal((await routing.resolveSlug('gaming', db)).path, '/kategori/oyun-ve-oyuncu-aksesuarlari/')
    assert.equal((await routing.resolveSlug('tech', db)).path, '/products/')
    assert.deepEqual(await routing.resolveSlug('help', db), { kind: 'legacy-path', slug: 'help', path: '/page/help/', redirect: 'permanent' })
    assert.equal(await routing.resolveSlug('yok-boyle-bir-sayfa', db), null)
    // ?category=new keeps redirecting to the plain listing (app/products appends the visitor's own query)
    assert.equal(await routing.resolveListingCategory('new', db), '/products/')
    assert.equal(routing.LEGACY_PATH_REDIRECTS.find((r) => r.source === '/new').destination, '/products/?sort=newest')
    assert.equal(routing.LEGACY_CATEGORY_TARGETS, seo.LEGACY_CATEGORY_TARGETS)
})

test('nav-data normalizeHref: legacy links go straight to their target', () => {
    assert.equal(nav.normalizeHref('/new'), '/products/?sort=newest')
    assert.equal(nav.normalizeHref('/new/'), '/products/?sort=newest')
    assert.equal(nav.normalizeHref('/NEW?utm_source=x'), '/products/?sort=newest&utm_source=x')
    assert.equal(nav.normalizeHref('/tech'), '/products/')
    assert.equal(nav.normalizeHref('/beauty/'), '/products/')
    assert.equal(nav.normalizeHref('/gaming'), '/kategori/oyun-ve-oyuncu-aksesuarlari/')
    assert.equal(nav.normalizeHref('/sepet'), '/odeme/')
    assert.equal(nav.normalizeHref('/products'), '/products/')
    assert.equal(nav.normalizeHref('/products?f=kablo'), '/products/?f=kablo')
    assert.equal(nav.normalizeHref('#categories'), '#categories')
    assert.equal(nav.normalizeHref('https://wa.me/90555'), 'https://wa.me/90555')
})

test('nav-data buildMenuTree: children of an inactive (missing) parent are dropped, not promoted', () => {
    const m = (id, parent_id) => ({ id, title: `m${id}`, url: `/m${id}`, parent_id, sort_order: id, children: [] })
    const tree = nav.buildMenuTree([m(1, null), m(2, 1), m(3, 99), m(4, 0)])
    assert.deepEqual(tree.map((t) => t.id), [1, 4])
    assert.deepEqual(tree[0].children.map((c) => c.id), [2])
})

const D1_DIR = fileURLToPath(new URL('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/', ROOT))
const dbFile = existsSync(D1_DIR) && readdirSync(D1_DIR).find((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')
test('local D1: every active product has a unique title and meta description', { skip: !dbFile && 'no local D1 copy' }, async () => {
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(D1_DIR + dbFile, { readOnly: true })
    const d1 = {
        prepare(sql) {
            let args = []
            const st = {
                bind(...a) { args = a; return st },
                async first() { return db.prepare(sql).get(...args) ?? null },
                async all() { return { results: db.prepare(sql).all(...args) } },
            }
            return st
        },
    }
    const site = await seo.loadSiteSeo(d1)
    const rows = db.prepare('SELECT * FROM products WHERE is_active = 1').all()
    assert.ok(rows.length > 0)
    const seen = (key) => {
        const map = new Map()
        for (const r of rows) {
            const v = key(r)
            assert.ok(!map.has(v), `duplicate for ids ${map.get(v)} and ${r.id}: ${v}`)
            map.set(v, r.id)
        }
    }
    seen((r) => seo.productMetaDescription(r, site))
    seen((r) => seo.productTitle(r.name))
    for (const r of rows) assert.ok(seo.productMetaDescription(r, site).length <= 160)
    db.close()
})
