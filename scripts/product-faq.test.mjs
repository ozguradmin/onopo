// Product page FAQ (lib/product-faq.ts) and /llms.txt (lib/llms-txt.ts): built from real data only, a question
// or fact whose data is missing is left out, nothing invented.
// Run: node --test scripts/product-faq.test.mjs   (Node 23.6+ strips the TypeScript types itself)
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = new URL('../', import.meta.url)
registerHooks({
    resolve(specifier, context, next) {
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

const { buildProductFaq, deviceModelsFromName } = await import('../lib/product-faq.ts')
const { buildLlmsTxt, storeFacts } = await import('../lib/llms-txt.ts')
const { faqPageJsonLd, parseHandlingTime, parseReturnPolicy } = await import('../lib/seo.ts')

// The live CMS "Kargo ve İade" text (2026-10-22), as lib/seo.ts loadSiteSeo parses it
const SHIPPING_PAGE = 'Siparişleriniz, ödeme onayının alınmasını takiben 1-3 iş günü içerisinde hazırlanarak kargo firmasına teslim edilmektedir. Teslimat tarihinden itibaren 14 gün içinde, kullanılmamış ve etiketi sökülmemiş ürünler için iade talebinde bulunabilirsiniz. Anlaşmalı kargo firmamız ile gönderdiğiniz iadelerde kargo ücreti tarafımızca karşılanmaktadır.'
const HANDLING = parseHandlingTime(SHIPPING_PAGE)
const RETURNS = parseReturnPolicy(SHIPPING_PAGE)

const base = (over = {}) => ({
    product: { name: 'Onopo T67 USB-A to Type-C 67W Turbo Şarj ve Data Kablosu', price: 129.99, in_stock: true, free_shipping: false, installment_info: null, ...(over.product ?? {}) },
    shipping: 'shipping' in over ? over.shipping : { freeShippingThreshold: 500, shippingCost: 100 },
    handlingTime: 'handlingTime' in over ? over.handlingTime : HANDLING,
    returnPolicy: 'returnPolicy' in over ? over.returnPolicy : RETURNS,
    maxInstallments: 'maxInstallments' in over ? over.maxInstallments : 12,
})
const questions = items => items.map(i => i.question)

// ---------------------------------------------------------------------------------------------
// Device models in the name
// ---------------------------------------------------------------------------------------------

test('deviceModelsFromName: the models the name lists, as written', () => {
    assert.deepEqual(deviceModelsFromName('Onopo iPhone 13 / 13 Pro Anti Static 9D Tam Ekran Cam Ekran Koruyucu'), ['iPhone 13', '13 Pro'])
    assert.deepEqual(deviceModelsFromName('Onopo Xiaomi Redmi Mi 13T / Mi 13T Pro Anti Static 9D Tam Ekran Cam Ekran Koruyucu'), ['Xiaomi Redmi Mi 13T', 'Mi 13T Pro'])
    assert.deepEqual(deviceModelsFromName('Onopo iPad Air 5 / 6 Siyah Ekran Çerçeveli Seramik Cam Ekran Koruyucu'), ['iPad Air 5', '6'])
    assert.deepEqual(deviceModelsFromName('Onopo iPhone 15 Pro Max Uyumlu Tam Kaplayan Şeffaf Seramik 12D Cam Ekran Koruyucu'), ['iPhone 15 Pro Max'])
    assert.deepEqual(deviceModelsFromName('Onopo Xiaomi Redmi 10A Anti Static 9D Tam Ekran Cam Ekran Koruyucu'), ['Xiaomi Redmi 10A'])
    assert.deepEqual(deviceModelsFromName('Onopo İnfinix Note 30 Pro Anti Static 9D Tam Ekran Cam Ekran Koruyucu'), ['İnfinix Note 30 Pro'])
    assert.deepEqual(deviceModelsFromName('Onopo iPad Pro 11 İnç Siyah Ekran Çerçeveli Seramik Cam Ekran Koruyucu'), ['iPad Pro 11 İnç'])
})

test('deviceModelsFromName: brands, platforms and specs are not models', () => {
    for (const name of [
        'Onopo iPhone Apple Uyumlu Lightning USB Hızlı Şarj ve Data Kablosu 3.0A / 1mt - D8',
        'Onopo Android Xiaomi ve Samsung Uyumlu Type-C USB Hızlı Şarj ve Data Kablosu 3.0A / 1MT - D7',
        'Taşınabilir Mini Fotoğraf Yazıcısı: USB Şarjlı, Kablosuz, Android/iOS Uyumlu Termal Etiket Yazıcısı',
        'Onopo iPhone ve Android Uyumlu 20W Type-C Girişli Şarj Başlığı - M3',
        'Onopo 10000 mAh Şarj Edilebilir Led Göstergeli Taşınabilir Powerbank',
        'Onopo T67 USB-A to Type-C 67W Turbo Şarj ve Data Kablosu',
        'Onopo Tüm Telefonlarla Uyumlu PUBG Nişan Tetik Düğmesi ve Oyun Kumandası',
        '',
    ]) assert.equal(deviceModelsFromName(name), null, name)
})

test('deviceModelsFromName on the real catalogue: only names that start a device model, never a spec', () => {
    const catalog = JSON.parse(readFileSync(new URL('fixtures/guide-catalog.json', import.meta.url), 'utf8'))
    let found = 0
    for (const p of catalog) {
        const models = deviceModelsFromName(p.name)
        if (!models) continue
        found++
        for (const m of models) {
            assert.ok(p.name.includes(m), `${m} is not written in "${p.name}"`)
            assert.doesNotMatch(m, /\b\d+(?:[.,]\d+)?(W|mAh|MT|CM|D)\b/i, p.name)
        }
        // only screen protectors name devices in today's catalogue
        assert.match(p.name, /Ekran Koruyucu/, p.name)
    }
    assert.ok(found >= 40, `found ${found}`)
})

// ---------------------------------------------------------------------------------------------
// FAQ builder
// ---------------------------------------------------------------------------------------------

test('FAQ: all questions when every piece of data is there (6 with a device model)', () => {
    const faq = buildProductFaq(base({ product: { name: 'Onopo iPhone 13 / 13 Pro Anti Static 9D Tam Ekran Cam Ekran Koruyucu' } }))
    assert.deepEqual(questions(faq), [
        'Hangi modellerle uyumlu?',
        'Stokta var mı?',
        'Siparişim ne zaman kargoya verilir?',
        'Kargo ücreti ne kadar?',
        'İade edebilir miyim?',
        'Taksitle alabilir miyim?',
    ])
    const a = Object.fromEntries(faq.map(i => [i.question, i.answer]))
    assert.equal(a['Hangi modellerle uyumlu?'], 'Ürün adında belirtilen modellerle uyumlu: iPhone 13 ve 13 Pro.')
    assert.match(a['Stokta var mı?'], /^Evet, bu ürün şu an stokta\./)
    assert.equal(a['Siparişim ne zaman kargoya verilir?'], 'Siparişin, ödeme onayından sonra 1-3 iş günü içinde hazırlanıp kargoya verilir.')
    assert.equal(a['Kargo ücreti ne kadar?'], '500,00 ₺ ve üzeri siparişlerde kargo bedava. Sepet tutarı bunun altındaysa kargo ücreti 100,00 ₺.')
    assert.match(a['İade edebilir miyim?'], /^Teslimattan itibaren 14 gün içinde iade talebinde bulunabilirsin\. Anlaşmalı kargo/)
    assert.match(a['Taksitle alabilir miyim?'], /12 aya varan taksit/)
    for (const i of faq) assert.doesNotMatch(i.answer, /vade farksız|faizsiz|ertesi gün|garanti/i, i.question)
})

test('FAQ: no device model in the name, no compatibility question', () => {
    const faq = buildProductFaq(base())
    assert.equal(faq.length, 5)
    assert.ok(!questions(faq).some(q => /uyumlu/i.test(q)))
})

test('FAQ: missing data leaves the question out (handling time, returns, installments, shipping)', () => {
    const faq = buildProductFaq(base({ handlingTime: null, returnPolicy: null, maxInstallments: null, shipping: null }))
    assert.deepEqual(questions(faq), ['Stokta var mı?'])
    assert.deepEqual(questions(buildProductFaq(base({ shipping: { freeShippingThreshold: null, shippingCost: null } }))).includes('Kargo ücreti ne kadar?'), false)
    // A CMS text without a return window or handling days parses to null: nothing is claimed
    assert.equal(parseReturnPolicy('İade için bize yazın.'), null)
    assert.equal(parseHandlingTime('Siparişler hızlıca kargolanır.'), null)
})

test('FAQ: shipping answer follows the product and the settings', () => {
    const ship = over => buildProductFaq(base(over)).find(i => i.question === 'Kargo ücreti ne kadar?')?.answer
    assert.equal(ship({ product: { free_shipping: true } }), 'Bu üründe kargo bedava.')
    assert.equal(ship({ product: { price: 649.99 } }), 'Bu ürünün fiyatı 500,00 ₺ sınırını tek başına geçtiği için kargo bedava.')
    assert.equal(ship({ product: { price: 500 } }), 'Bu ürünün fiyatı 500,00 ₺ sınırını tek başına geçtiği için kargo bedava.')
    assert.equal(ship({ shipping: { freeShippingThreshold: 500, shippingCost: 0 } }), 'Bu üründe kargo bedava.')
    assert.equal(ship({ shipping: { freeShippingThreshold: 0, shippingCost: 79.99 } }), 'Kargo ücreti 79,99 ₺.')
})

test('FAQ: sold out says so; returns without free return shipping do not promise it', () => {
    const faq = buildProductFaq(base({ product: { in_stock: false }, returnPolicy: { days: 14, freeReturn: false } }))
    assert.equal(faq.find(i => i.question === 'Stokta var mı?').answer, 'Bu ürün şu an stokta yok, bu yüzden şu anda sipariş verilemiyor.')
    assert.doesNotMatch(faq.find(i => i.question === 'İade edebilir miyim?').answer, /kargo ücretini biz/)
})

test('FAQ: the admin installment text is used as written', () => {
    const faq = buildProductFaq(base({ product: { installment_info: 'Peşin fiyatına 3 taksit' } }))
    assert.equal(faq.find(i => i.question === 'Taksitle alabilir miyim?').answer, 'Kredi kartı veya banka kartıyla güvenli ödeme yapabilirsin. Peşin fiyatına 3 taksit.')
})

test('FAQ: the handling answer repeats the delivery line the page shows (product text), never a second promise', () => {
    // The live "Teslimat" text of 115 products (after components/pdp/description-parser infoText)
    const own = 'Ürünü sipariş verdiğiniz gün saat 18:00 ve öncesi ise siparişiniz aynı gün kargoya verilir ve ertesi gün teslim edilir.'
    const a = Object.fromEntries(buildProductFaq({ ...base(), deliveryText: own }).map(i => [i.question, i.answer]))
    assert.equal(a['Siparişim ne zaman kargoya verilir?'], own)
    assert.ok(!Object.values(a).some(t => /1-3 iş günü/.test(t)), 'the CMS days are not shown next to it')
    // No product text: the CMS days; a blank text counts as none; a missing period is added
    assert.match(Object.fromEntries(buildProductFaq({ ...base(), deliveryText: '  ' }).map(i => [i.question, i.answer]))['Siparişim ne zaman kargoya verilir?'], /1-3 iş günü/)
    assert.equal(buildProductFaq({ ...base({ handlingTime: null }), deliveryText: 'Aynı gün kargo' }).find(i => /kargoya verilir/.test(i.question)).answer, 'Aynı gün kargo.')
    const page = readFileSync(new URL('../components/pdp/ProductPage.tsx', import.meta.url), 'utf8')
    assert.match(page, /deliveryText: infoText\(product\.delivery_info\) \|\| data\.featuresDelivery \|\| null,/)
})

test('FAQ JSON-LD: exactly the visible questions and answers', () => {
    const faq = buildProductFaq(base())
    const ld = faqPageJsonLd(faq)
    assert.equal(ld['@type'], 'FAQPage')
    assert.deepEqual(ld.mainEntity.map(q => [q.name, q.acceptedAnswer.text]), faq.map(i => [i.question, i.answer]))
})

test('ProductPage renders the FAQ block and its JSON-LD from the same list', () => {
    const page = readFileSync(new URL('../components/pdp/ProductPage.tsx', import.meta.url), 'utf8')
    assert.match(page, /faq\.length > 0 && <JsonLd data=\{faqPageJsonLd\(faq\)\} \/>/)
    assert.match(page, /<ProductFaq items=\{faq\} \/>/)
    const block = readFileSync(new URL('../components/pdp/ProductFaq.tsx', import.meta.url), 'utf8')
    assert.doesNotMatch(block, /'use client'/)
    assert.match(block, /<details/)
})

// ---------------------------------------------------------------------------------------------
// /llms.txt
// ---------------------------------------------------------------------------------------------

const llmsData = (over = {}) => ({
    siteName: 'Onopo Store',
    productTypes: ['ekran koruyucular', 'şarj ve data kabloları', 'hızlı şarj aletleri'],
    freeShippingThreshold: 500,
    shippingCost: 100,
    freeShippingProducts: 1,
    handlingTime: HANDLING,
    returnPolicy: RETURNS,
    maxInstallments: 12,
    contact: { whatsapp: '905550000000', phone: '+90 555 000 00 00', email: 'destek@example.com' },
    categories: [{ label: 'Cep Telefonu Aksesuarları', path: '/kategori/cep-telefonu-aksesuarlari/', note: '109 ürün' }],
    guides: [{ label: 'Powerbank seçimi', path: '/rehber/powerbank-secimi-mah-ve-cikis-gucu/', note: 'mAh ve çıkış gücü.' }],
    products: [{ name: 'Onopo T67 [67W] Kablo', path: '/onopo-t67-kablo/', price: 129.99 }],
    productTotal: 118,
    pages: [{ label: 'Kargo ve İade', path: '/page/shipping/' }],
    ...over,
})

test('llms.txt: llmstxt.org shape (H1, blockquote, sections of absolute links)', () => {
    const txt = buildLlmsTxt(llmsData())
    const lines = txt.split('\n')
    assert.equal(lines[0], '# Onopo Store')
    assert.match(lines[2], /^> Onopo Store \(https:\/\/onopostore\.com\/\), .*ekran koruyucular, şarj ve data kabloları ve hızlı şarj aletleri\./)
    for (const h of ['## Kategoriler', '## Alışveriş rehberleri', '## Ürünler', '## Mağaza sayfaları', '## Optional']) assert.ok(lines.includes(h), h)
    assert.ok(lines.includes('- [Cep Telefonu Aksesuarları](https://onopostore.com/kategori/cep-telefonu-aksesuarlari/): 109 ürün'))
    // brackets in a product name never break the link
    assert.ok(lines.includes('- [Onopo T67 67W Kablo](https://onopostore.com/onopo-t67-kablo/): 129,99 TL'))
    assert.ok(lines.includes('- [Site haritası](https://onopostore.com/sitemap.xml)'))
    assert.ok(txt.endsWith('\n'))
    // every link is absolute on the canonical host
    for (const m of txt.matchAll(/\]\(([^)]+)\)/g)) assert.match(m[1], /^https:\/\/onopostore\.com\//)
})

test('llms.txt: store facts come from the data and are left out when it is missing', () => {
    const facts = storeFacts(llmsData()).join('\n')
    assert.match(facts, /500 TL ve üzeri siparişlerde kargo bedava; altındaki siparişlerde kargo ücreti 100 TL\./)
    assert.match(facts, /1-3 iş günü/)
    assert.match(facts, /14 gün içinde/)
    assert.match(facts, /12 aya varan taksit/)
    assert.match(facts, /İletişim: WhatsApp 905550000000, telefon \+90 555 000 00 00, e-posta destek@example\.com\./)

    const bare = storeFacts(llmsData({ freeShippingThreshold: null, shippingCost: null, handlingTime: null, returnPolicy: null, maxInstallments: null, contact: {} })).join('\n')
    assert.doesNotMatch(bare, /Kargo:|Kargoya veriliş|İade|taksit|İletişim/)
    // the price statement is always true (lib/pricing: the shown unit price is what checkout charges)
    assert.match(bare, /ödemede alınan tutardır/)
    assert.doesNotMatch(buildLlmsTxt(llmsData()), /vade farksız|faizsiz|ertesi gün teslim|garanti/i)
})

test('llms.txt: empty sections are left out; extra sections (device pages) slot in after the guides', () => {
    const txt = buildLlmsTxt(llmsData({ guides: [], extraSections: [{ title: 'Cihaza göre aksesuarlar', links: [{ label: 'iPhone 15', path: '/cihaz/iphone-15/' }] }] }))
    assert.ok(!txt.includes('## Alışveriş rehberleri'))
    assert.ok(txt.indexOf('## Kategoriler') < txt.indexOf('## Cihaza göre aksesuarlar'))
    assert.ok(txt.indexOf('## Cihaza göre aksesuarlar') < txt.indexOf('## Ürünler'))
})

test('llms.txt route: lists the indexable device pages (lib/devices deviceLlmsLinks) after the guides', () => {
    const route = readFileSync(new URL('../app/llms.txt/route.ts', import.meta.url), 'utf8')
    assert.match(route, /const devices = deviceLlmsLinks\(products\)/)
    assert.match(route, /extraSections\.push\(\{\s*title: 'Cihaza göre'/)
    const txt = buildLlmsTxt(llmsData({ extraSections: [{ title: 'Cihaza göre', intro: 'Telefon ve tablet markasına ya da modeline göre ürün sayfaları.', links: [
        { label: 'Cihaza göre aksesuarlar', path: '/cihaz/', note: '5 cihaz sayfası, 70 ürün' },
        { label: 'iPhone aksesuarları', path: '/cihaz/iphone/', note: '36 ürün' },
    ] }] }))
    assert.ok(txt.includes([
        '## Cihaza göre',
        '',
        'Telefon ve tablet markasına ya da modeline göre ürün sayfaları.',
        '',
        '- [Cihaza göre aksesuarlar](https://onopostore.com/cihaz/): 5 cihaz sayfası, 70 ürün',
        '- [iPhone aksesuarları](https://onopostore.com/cihaz/iphone/): 36 ürün',
    ].join('\n')), txt)
})

test('llms.txt route: not in the sitemap, allowed by robots.txt', () => {
    const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
    assert.doesNotMatch(sitemap, /llms/)
    const robots = readFileSync(new URL('../app/robots.ts', import.meta.url), 'utf8')
    assert.doesNotMatch(robots, /llms/)
    assert.match(robots, /allow: \[\s*'\/',/)
})
