// Unit tests for the Google Merchant feed (lib/google-feed.ts), the barcode helpers (lib/gtin.ts) and the barcode /
// review parts of the Product JSON-LD (lib/seo.ts productJsonLd).
// Run: node --test scripts/feeds.test.mjs   (Node 23.6+ strips the TypeScript types itself; needs node_modules for
// lib/utils.ts)
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

// The app imports '@/…' and extensionless relative paths; resolve them to the .ts files.
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
const gf = await import('../lib/google-feed.ts')
const gtin = await import('../lib/gtin.ts')
const seo = await import('../lib/seo.ts')

const CTX = { origin: 'https://onopostore.com', brand: 'Onopo', currency: 'TRY', siteName: 'Onopo', shipping: { freeThreshold: 500, shippingCost: 100 } }
const product = over => ({
    id: 1058,
    name: 'Onopo T67 USB-A to Type-C 67W Turbo Şarj ve Data Kablosu',
    slug: 'onopo-t67-kablo',
    description: '<p>Güçlü kablo</p>',
    price: 129.99,
    original_price: 169.99,
    stock: 999,
    images: JSON.stringify(Array.from({ length: 13 }, (_, i) => `/api/images/k${i}.png`)),
    category: 'Cep Telefonu Aksesuarları',
    free_shipping: 0,
    product_code: 'T67',
    gtin: null,
    ...over,
})
const tag = (xml, name) => [...xml.matchAll(new RegExp(`<g:${name}>([\\s\\S]*?)</g:${name}>`, 'g'))].map(m => m[1])

// ---------------------------------------------------------------------------------------------
// GTIN
// ---------------------------------------------------------------------------------------------

test('gtin: GS1 check digit for 8/12/13/14 digits', () => {
    for (const ok of ['73513537', '96385074', '036000291452', '4006381333931', '8690000000005', '00012345600012']) {
        assert.equal(gtin.isValidGtin(ok), true, ok)
        assert.equal(gtin.gtinError(ok), null, ok)
    }
    for (const bad of ['4006381333932', '73513538', '1234567', '123456789', '12345678901', '123456789012345', 'ABC']) {
        assert.equal(gtin.isValidGtin(bad), false, bad)
    }
    assert.equal(gtin.gtinError(''), null)
    assert.equal(gtin.gtinError(null), null)
    assert.equal(gtin.gtinError('400638133393X'), 'Barkod yalnızca rakamlardan oluşmalı.')
    assert.equal(gtin.gtinError('123456789'), 'Barkod 8, 12, 13 ya da 14 haneli olmalı.')
    assert.equal(gtin.gtinError('4006381333932'), 'Barkodun kontrol hanesi tutmuyor; rakamları kontrol edin.')
    assert.equal(gtin.normalizeGtin(' 400-6381 333931 '), '4006381333931')
    assert.equal(gtin.gtinForStorage(' 4006381333931'), '4006381333931')
    assert.equal(gtin.gtinForStorage('4006381333932'), null)
    assert.equal(gtin.gtinForStorage(''), null)
    assert.deepEqual(['73513537', '036000291452', '4006381333931', '00012345600012'].map(gtin.gtinJsonLdKey), ['gtin8', 'gtin12', 'gtin13', 'gtin14'])
    // seo.ts keeps exporting the same validator
    assert.equal(seo.isValidGtin, gtin.isValidGtin)
})

test('gtin: column check and write tolerate a database without products.gtin', async () => {
    const raw = new DatabaseSync(':memory:')
    raw.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT)')
    raw.exec("INSERT INTO products VALUES (1, 'x')")
    const db = {
        prepare: sql => ({
            bind: (...v) => ({ run: async () => raw.prepare(sql).run(...v) }),
            first: async () => raw.prepare(sql).get() ?? null,
        }),
    }
    assert.equal(await gtin.hasGtinColumn(db), false)
    assert.equal(await gtin.writeProductGtin(db, 1, '4006381333931'), 'no_column')
    raw.exec('ALTER TABLE products ADD COLUMN gtin TEXT')
    assert.equal(await gtin.hasGtinColumn(db), true)
    assert.equal(await gtin.writeProductGtin(db, 1, ' 4006381333931 '), 'saved')
    assert.equal(raw.prepare('SELECT gtin FROM products WHERE id = 1').get().gtin, '4006381333931')
    assert.equal(await gtin.writeProductGtin(db, 1, ''), 'saved')
    assert.equal(raw.prepare('SELECT gtin FROM products WHERE id = 1').get().gtin, null)
})

// ---------------------------------------------------------------------------------------------
// Google feed
// ---------------------------------------------------------------------------------------------

test('feed: core fields, prices, shipping, 10 additional images (absolute), product type and category', () => {
    const xml = gf.googleFeedItem(product(), CTX)
    assert.deepEqual(tag(xml, 'id'), ['1058'])
    assert.deepEqual(tag(xml, 'link'), ['https://onopostore.com/onopo-t67-kablo/'])
    assert.deepEqual(tag(xml, 'image_link'), ['https://images.onopostore.com/k0.png'])
    const extra = tag(xml, 'additional_image_link')
    assert.equal(extra.length, 10)
    assert.equal(extra[0], 'https://images.onopostore.com/k1.png')
    assert.equal(extra[9], 'https://images.onopostore.com/k10.png')
    assert.deepEqual(tag(xml, 'availability'), ['in_stock'])
    assert.deepEqual(tag(xml, 'price'), ['169.99 TRY', '100.00 TRY'])
    assert.deepEqual(tag(xml, 'sale_price'), ['129.99 TRY'])
    assert.deepEqual(tag(xml, 'mpn'), ['T67'])
    assert.deepEqual(tag(xml, 'gtin'), [])
    assert.deepEqual(tag(xml, 'identifier_exists'), [])
    assert.deepEqual(tag(xml, 'product_type'), ['<![CDATA[Cep Telefonu Aksesuarları > Şarj ve Data Kablosu]]>'])
    assert.deepEqual(tag(xml, 'google_product_category'), ['259'])
    assert.deepEqual(tag(xml, 'description'), ['<![CDATA[Güçlü kablo]]>'])
})

test('feed: out-of-stock products stay in the feed as out_of_stock', () => {
    const xml = gf.googleFeedXml([product({ id: 1, stock: 0 }), product({ id: 2, stock: -4 }), product({ id: 3, stock: 5 })], CTX)
    assert.deepEqual(tag(xml, 'availability'), ['out_of_stock', 'out_of_stock', 'in_stock'])
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">'))
})

test('feed: gtin only when valid; identifier_exists no only without gtin and mpn', () => {
    const withGtin = gf.googleFeedItem(product({ gtin: '4006381333931', product_code: '' }), CTX)
    assert.deepEqual(tag(withGtin, 'gtin'), ['4006381333931'])
    assert.deepEqual(tag(withGtin, 'identifier_exists'), [])
    assert.deepEqual(tag(withGtin, 'mpn'), [])

    const badGtin = gf.googleFeedItem(product({ gtin: '4006381333932', product_code: null }), CTX)
    assert.deepEqual(tag(badGtin, 'gtin'), [])
    assert.deepEqual(tag(badGtin, 'identifier_exists'), ['no'])

    const nothing = gf.googleFeedItem(product({ gtin: undefined, product_code: '  ' }), CTX)
    assert.deepEqual(tag(nothing, 'identifier_exists'), ['no'])

    const mpnOnly = gf.googleFeedItem(product({ gtin: '', product_code: 'Q7' }), CTX)
    assert.deepEqual(tag(mpnOnly, 'identifier_exists'), [])
    assert.deepEqual(tag(mpnOnly, 'mpn'), ['Q7'])
})

test('feed: XML escaping of text, links and codes; CDATA terminators split', () => {
    const xml = gf.googleFeedItem(product({
        name: 'Kablo ]]> & <b>"Süper"</b>',
        slug: 'a&b',
        product_code: 'A&B<1>',
        category: 'Ses & Görüntü',
        images: JSON.stringify(['https://cdn.example.test/x.png?a=1&b=2']),
        description: 'x ]]> y',
    }), CTX)
    assert.ok(xml.includes('<g:title><![CDATA[Kablo ]]]]><![CDATA[> & <b>"Süper"</b>]]></g:title>'))
    assert.ok(xml.includes('<g:link>https://onopostore.com/a%26b/</g:link>'))
    assert.ok(xml.includes('<g:mpn>A&amp;B&lt;1&gt;</g:mpn>'))
    assert.ok(xml.includes('<g:image_link>https://cdn.example.test/x.png?a=1&amp;b=2</g:image_link>'))
    assert.ok(xml.includes('<g:product_type><![CDATA[Ses & Görüntü > Şarj ve Data Kablosu]]></g:product_type>'))
    // Every CDATA section is closed exactly where it should be: no stray "]]>" outside CDATA
    const outside = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    assert.ok(!outside.includes(']]>'))
    assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(outside))
})

test('feed: no images → empty image_link, no additional images; free shipping over the threshold', () => {
    const xml = gf.googleFeedItem(product({ images: null, price: 600, original_price: null }), CTX)
    assert.deepEqual(tag(xml, 'image_link'), [''])
    assert.deepEqual(tag(xml, 'additional_image_link'), [])
    assert.deepEqual(tag(xml, 'sale_price'), [])
    assert.deepEqual(tag(xml, 'price'), ['599.99 TRY', '0.00 TRY'])
})

test('feed: product types and Google categories of the real catalogue names', () => {
    const cases = [
        ['Onopo iPhone 13 Pro Max Uyumlu Tam Kaplayan Şeffaf Seramik 12D Cam Ekran Koruyucu', 'Ekran Koruyucu', 5468],
        ['Onopo Samsung Galaxy Tab S7 T870 11 İnç Siyah Ekran Çerçeveli Seramik Cam Ekran Koruyucu', 'Ekran Koruyucu', 5468],
        ['Onopo 3.4A Type-C (PD) ve USB Girişli Led Işıklı Turbo Hızlı Araç Şarjı 40W - A7', 'Araç Şarj Cihazı', 505295],
        ['Onopo 20000 mAh Şarj Edilebilir Led Göstergeli Taşınabilir Powerbank', 'Powerbank', 505295],
        ['Onopo Telefon ve Tablet Uyumlu 3.5MM Yüksek Ses Kaliteli Kablolu Kulaklık - V5', 'Kulaklık', 543626],
        ['Onopo BT1 Gürültü Önleyici Bluetooth 5.3 Kablosuz Kulaklık', 'Kulaklık', 543626],
        ['Onopo Audio 3.5MM Aux Kablosu 1,5 Metre - F1', 'Ses Kablosu', 1867],
        ['Onopo 120W USB Turbo Hızlı Şarj Aleti Seti Esnek Kablo Type-C - M7', 'Şarj Aleti', 505295],
        ['Onopo 30W Turbo PD Type-C Hızlı Şarj Cihazı Adaptör + Şarj Kablosu - M2', 'Şarj Aleti', 505295],
        ['Onopo 48W Type-C ve USB Girişli Turbo Şarj Adaptörü Başlığı - M5', 'Şarj Aleti', 505295],
        ['Onopo iPhone ve Android Uyumlu 20W Type-C Girişli Şarj Başlığı - M3', 'Şarj Aleti', 505295],
        ['Onopo D880 GT-E1190 GT-E1150 GT-E1205 GT-E1207 SM-D880 Uyumlu Şarj Cihazı - X1', 'Şarj Aleti', 505295],
        ['Onopo Android Xiaomi ve Samsung Uyumlu Type-C to USB Kablo 3.4A Uyumlu Hızlı Şarj ve Data Kablosu 1M - Q7', 'Şarj ve Data Kablosu', 259],
        ['T120 USB-A to Type-C Turbo Şarj ve Data Kablosu | 120W GaN | Hızlı Şarj & Veri Aktarımı | 1 Metre', 'Şarj ve Data Kablosu', 259],
        ['Onopo Power 20000PA 3’ü 1 Arada Şarjlı El Süpürgesi Çantalı – Yüksek Emiş Gücü, Uzun Çalışma Süresi', 'El Süpürgesi', 619],
        ['Tüm Araç Süpürgeleri ile Uyumlu Yedek Hepa Filtre', 'Süpürge Yedek Parçası', 618],
        ['Onopo Süpürgeleri İçin Toz Haznesi Aparatı', 'Süpürge Yedek Parçası', 618],
        ['Taşınabilir Mini Fotoğraf Yazıcısı: USB Şarjlı, Kablosuz, Android/iOS Uyumlu Termal Etiket Yazıcısı ve 1 Rulo Termal Kağıt Dahil!', 'Taşınabilir Yazıcı', 500106],
        ['Onopo Mtp-3 Mobil Taşınabilir Termal Fiş Yazıcı 80mm Baskı Genişliği', 'Taşınabilir Yazıcı', 500106],
        ['Ally Mix Elite Plus - PUBG denetleyicisi için Gamepad mobil oyun klavye Mouse dönüştürücü Bluetooth Android oyun adaptörü', 'Mobil Oyun Aksesuarı', 8008],
        ['Onopo Tüm Telefonlarla Uyumlu PUBG Nişan Tetik Düğmesi ve Oyun Kumandası', 'Oyun Kumandası', 301],
        ['Onopo PUBG Oyun Konsolu 5 In 1 Tüm Telefonlara Uyumlu Oyun Konsolu', 'Mobil Oyun Aksesuarı', null],
    ]
    for (const [name, type, google] of cases) {
        assert.deepEqual(gf.classifyProduct(name), { type, google }, name)
    }
    assert.equal(gf.classifyProduct('Bilinmeyen bir şey'), null)
    // A selection category is not a product type; an unknown product keeps only the real category
    assert.equal(gf.productTypePath('Çok Satanlar', 'Onopo Süpürgeleri İçin Toz Haznesi Aparatı'), 'Süpürge Yedek Parçası')
    assert.equal(gf.productTypePath('Çok Satanlar', 'Bilinmeyen'), null)
    assert.equal(gf.productTypePath('Cep Telefonu Aksesuarları', 'Bilinmeyen'), 'Cep Telefonu Aksesuarları')
    const unknown = gf.googleFeedItem(product({ name: 'Onopo PUBG Oyun Konsolu 5 In 1', category: 'Oyun ve Oyuncu Aksesuarları' }), CTX)
    assert.deepEqual(tag(unknown, 'google_product_category'), [])
})

// ---------------------------------------------------------------------------------------------
// Product JSON-LD: barcode and reviews
// ---------------------------------------------------------------------------------------------

const seoProduct = over => ({ id: 1, name: 'Onopo Kablo', slug: 'x', price: 199.9, stock: 5, free_shipping: 0, images: '[]', category: 'Cep Telefonu Aksesuarları', product_code: 'Q7', ...over })

test('json-ld: products.gtin first (by length), then the spec-table barcode, invalid ones never', () => {
    assert.equal(seo.productJsonLd(seoProduct({ gtin: '4006381333931' })).gtin13, '4006381333931')
    assert.equal(seo.productJsonLd(seoProduct({ gtin: '73513537' })).gtin8, '73513537')
    const both = seo.productJsonLd(seoProduct({ gtin: '036000291452', description: 'Teknik ÖzelliklerMarkaOnopoBarkod4006381333931Desi0' }))
    assert.equal(both.gtin12, '036000291452')
    assert.equal(both.gtin13, undefined)
    const specOnly = seo.productJsonLd(seoProduct({ gtin: '4006381333932', description: 'Teknik ÖzelliklerMarkaOnopoBarkod4006381333931Desi0' }))
    assert.equal(specOnly.gtin13, '4006381333931')
    const none = seo.productJsonLd(seoProduct({ gtin: '123' }))
    assert.ok(!Object.keys(none).some(k => k.startsWith('gtin')))
})

test('json-ld: up to 5 real reviews next to aggregateRating; none without reviews', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ rating: 5 - (i % 3), comment: i === 1 ? '' : `Yorum   ${i}`, created_at: '2026-10-0' + (i + 1) + ' 10:00:00', author: i === 0 ? 'Ayşe K.' : `Kişi ${i}` }))
    const ld = seo.productJsonLd(seoProduct(), { reviews: { count: 7, average: 4.1 }, reviewItems: items })
    assert.equal(ld.aggregateRating.reviewCount, 7)
    assert.equal(ld.review.length, 5)
    assert.deepEqual(ld.review[0], {
        '@type': 'Review',
        reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5, worstRating: 1 },
        author: { '@type': 'Person', name: 'Ayşe K.' },
        datePublished: '2026-10-01',
        reviewBody: 'Yorum 0',
    })
    assert.equal(ld.review[1].reviewBody, undefined)
    // review comes after aggregateRating (new keys only after the Akakçe ones)
    const keys = Object.keys(ld)
    assert.ok(keys.indexOf('review') > keys.indexOf('aggregateRating'))
    assert.equal(seo.productJsonLd(seoProduct(), { reviews: null, reviewItems: items }).review, undefined)
    assert.equal(seo.productJsonLd(seoProduct(), { reviews: { count: 0, average: 0 }, reviewItems: [] }).review, undefined)
})
