// Unit tests for the home page campaign banners: lib/campaigns.ts.
// Run: node --test scripts/campaigns.test.mjs   (Node 23.6+ strips the TypeScript types itself)
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

// The app imports '@/…' and extensionless relative paths ('./format'); resolve them to the .ts files.
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
const { buildCampaigns } = await import('../lib/campaigns.ts')

let n = 0
const p = (name, price, discount = 0, over = {}) => ({ name, display_price: price, discount_percent: discount, in_stock: true, images: [`/api/images/${++n}.png`], ...over })

const GLASS = ['İphone 16', 'İphone 15', 'Samsung S24', 'Redmi Note 13', 'İphone 13', 'İphone 11'].map(m => p(`Onopo ${m} Anti Static 9D Tam Ekran Cam Ekran Koruyucu`, 129.99, 18))
const CERAMIC = [
    p('onopo Iphone 13 Pro Max Uyumlu Tam Kaplayan Şeffaf Seramik 12D Cam Ekran Koruyucu', 99.99, 32),
    p('onopo Redmi 13 Uyumlu Tam Kaplayan Şeffaf Seramik 12D Cam Ekran Koruyucu', 79.99),
]
const CHARGERS = [
    p('Onopo 120W USB Turbo Hızlı Şarj Aleti Seti Esnek Kablo Type-C - M7', 349.99, 19),
    p('onopo 67w Usb Turbo Hızlı Şarj Aleti Seti Esnek Kablo Type-c - M6', 299.99, 22),
    p('onopo 30W Turbo PD Type-C Hızlı Şarj Cihazı Adaptör + Şarj Kablosu', 259.99, 41),
]
const CABLE = p('onopo Android Xiaomi Ve Samsung Uyumlu 60W PD Type-C to Type-C Kablo', 109.99, 40)
const ALL = [...GLASS, ...CERAMIC, ...CHARGERS, CABLE]

const byKey = list => Object.fromEntries(list.map(c => [c.key, c]))

test('all four banners from real data, in slider order', () => {
    const list = buildCampaigns({ products: ALL, freeShippingThreshold: 500, dispatchText: "Saat 18:00'ya kadar aynı gün kargo", maxInstallments: 12 })
    assert.deepEqual(list.map(c => c.key), ['firsatlar', 'ekran-koruyucu', 'turbo-sarj', 'kargo-bedava'])
    const c = byKey(list)
    assert.equal(c.firsatlar.title, "%41'e varan indirim")
    assert.equal(c.firsatlar.subtitle, `${ALL.filter(x => x.discount_percent >= 10).length} üründe indirim`)
    assert.equal(c.firsatlar.href, '/products/?sort=discount')
    assert.equal(c['ekran-koruyucu'].kicker, 'Tek fiyat')
    assert.equal(c['ekran-koruyucu'].title, '9D cam ekran koruyucu')
    assert.equal(c['ekran-koruyucu'].highlight, '129,99 TL')
    assert.equal(c['ekran-koruyucu'].subtitle, "6 telefon modeli · Seramik 79,99 ₺'den")
    assert.equal(c['turbo-sarj'].title, "120W'a kadar hızlı şarj")
    assert.equal(c['turbo-sarj'].subtitle, "Şarj aletleri 259,99 ₺'den")
    assert.equal(c['kargo-bedava'].title, '500 ₺ üzeri kargo bedava')
    assert.equal(c['kargo-bedava'].subtitle, "Saat 18:00'ya kadar aynı gün kargo")
    for (const x of list) assert.ok(x.productImages.length >= 1 && x.productImages.length <= 3, x.key)
})

test('no "tek fiyat" when one 9D model costs more', () => {
    const products = [...GLASS.slice(0, 5), p('Onopo İphone 16 Pro Anti Static 9D Tam Ekran Cam Ekran Koruyucu', 149.99), ...CERAMIC]
    const c = byKey(buildCampaigns({ products, freeShippingThreshold: 0 }))
    assert.equal(c['ekran-koruyucu'].kicker, 'Ekran koruyucu')
    assert.equal(c['ekran-koruyucu'].title, 'Ekran koruyucular')
    assert.equal(c['ekran-koruyucu'].highlight, "79,99 TL'den")
})

test('sold-out products and too few discounts never make a banner', () => {
    const soldOut = ALL.map(x => ({ ...x, in_stock: false }))
    assert.deepEqual(buildCampaigns({ products: soldOut, freeShippingThreshold: 500 }).map(c => c.key), ['kargo-bedava'])
    const twoOnSale = [p('a Kablo', 100, 30), p('b Kablo', 100, 20), p('c Kablo', 100, 5)]
    assert.equal(byKey(buildCampaigns({ products: twoOnSale, freeShippingThreshold: 0 })).firsatlar, undefined)
})

test('shipping banner: no threshold, no banner; installments when there is no dispatch line', () => {
    assert.equal(byKey(buildCampaigns({ products: ALL, freeShippingThreshold: 0 }))['kargo-bedava'], undefined)
    const c = byKey(buildCampaigns({ products: ALL, freeShippingThreshold: 750, maxInstallments: 12 }))
    assert.equal(c['kargo-bedava'].title, '750 ₺ üzeri kargo bedava')
    assert.equal(c['kargo-bedava'].subtitle, 'Kredi kartına 12 taksit')
})

test('charger banner needs at least 30W', () => {
    const small = [p('Onopo S2 12W 2.4A USB Şarj Adaptörü', 139.99), p('onopo 22w Usb Hızlı Şarj Aleti Seti', 199.99)]
    assert.equal(byKey(buildCampaigns({ products: small, freeShippingThreshold: 0 }))['turbo-sarj'], undefined)
})

test('a photo with printed text is used only while its claims are still true', () => {
    const photos = {
        firsatlar: { name: 'firsatlar', text: "FIRSATLAR %41'e varan indirim", claims: { minMaxDiscount: 41 } },
        'ekran-koruyucu': { name: 'ekran', text: '9D cam ekran koruyucu 129,99 TL', claims: { onePrice: 129.99 } },
        'turbo-sarj': { name: 'turbo', text: "120W'a kadar hızlı şarj", claims: { minTopWatt: 120 } },
        'kargo-bedava': { name: 'kargo', text: '500 TL üzeri kargo bedava', claims: { freeShippingThreshold: 500, dispatchMentions: '18:00' } },
    }
    const now = byKey(buildCampaigns({ products: ALL, freeShippingThreshold: 500, dispatchText: "Saat 18:00'ya kadar aynı gün kargo", photos }))
    for (const k of Object.keys(photos)) assert.equal(now[k].photo?.name, photos[k].name, k)

    // Discount fell to 40%, a 9D model got another price, the 120W charger sold out, the threshold went up
    const later = ALL.map(x => {
        if (x.discount_percent === 41) return { ...x, discount_percent: 40 }
        if (/120W/.test(x.name)) return { ...x, in_stock: false }
        return x
    }).concat(p('Onopo İphone 17 Anti Static 9D Tam Ekran Cam Ekran Koruyucu', 139.99))
    const c = byKey(buildCampaigns({ products: later, freeShippingThreshold: 750, dispatchText: "Saat 18:00'ya kadar aynı gün kargo", photos }))
    for (const k of Object.keys(photos)) assert.equal(c[k].photo, null, k)
    assert.equal(c.firsatlar.title, "%40'a varan indirim")

    // With a text-free twin the banner keeps the photo and gets the live text instead
    const withPlain = Object.fromEntries(Object.entries(photos).map(([k, v]) => [k, { ...v, plain: `${v.name}-yazisiz` }]))
    const d = byKey(buildCampaigns({ products: later, freeShippingThreshold: 750, dispatchText: "Saat 18:00'ya kadar aynı gün kargo", photos: withPlain }))
    for (const k of Object.keys(photos)) {
        assert.equal(d[k].photo?.name, `${photos[k].name}-yazisiz`, k)
        assert.equal(d[k].photo?.text, undefined, k)
    }
})
