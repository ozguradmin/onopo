/**
 * "Sık sorulan sorular" on the product page (components/pdp/ProductFaq.tsx) and its FAQPage JSON-LD.
 *
 * Every answer is built from real data only, and a question whose data is missing is left out:
 *   - "Hangi modellerle uyumlu?": only when the product NAME itself lists the device model(s) ("iPhone 13 / 13 Pro");
 *     the answer repeats what the name says, nothing is inferred
 *   - stock: the live stock flag (products.stock > 0), never a quantity
 *   - "Siparişim ne zaman kargoya verilir?": the handling days parsed from the CMS shipping page (lib/seo.ts
 *     parseHandlingTime)
 *   - shipping cost: shipping_settings (threshold, cost) and the product's own free_shipping flag / price
 *   - returns: the return window parsed from the CMS shipping page (parseReturnPolicy)
 *   - payment and installments: lib/catalog getMaxInstallments (null = no card payment configured: left out)
 * Pure and isomorphic, so scripts/product-faq.test.mjs can check it. The JSON-LD must carry exactly these items.
 */
import { formatTL } from './format'

export interface ProductFaqItem {
    question: string
    answer: string
}

export interface ProductFaqInput {
    product: {
        name: string
        /** What one unit costs at checkout (lib/pricing unitPrice). */
        price: number
        in_stock: boolean
        free_shipping: boolean
        /** Admin text that replaces the installment line (Ürünler › Taksit bilgisi), already plain text. */
        installment_info?: string | null
    }
    /** shipping_settings; null when the row could not be read (the shipping question is then left out). */
    shipping: { freeShippingThreshold: number | null; shippingCost: number | null } | null
    handlingTime: { minDays: number; maxDays: number } | null
    returnPolicy: { days: number; freeReturn: boolean } | null
    maxInstallments: number | null
}

// ---- device models in the product name -----------------------------------------------------------------

// Words that start a device name. "Android" and "Apple" are not models; "Galaxy" / "Mi" may follow a brand.
const DEVICE_BRANDS = /^(iphone|ipad|samsung|galaxy|xiaomi|redmi|poco|huawei|mediapad|matepad|honor|oppo|realme|vivo|oneplus|pixel|reeder|tecno|infinix|nokia|lenovo|tab)$/i
// Words that may belong to a model name besides the brand and the model number
const MODEL_WORDS = /^(pro|max|plus|mini|ultra|lite|fe|note|air|se|edge|prime|mi|galaxy|tab|redmi|neo)$/i
// A model number ("13", "10A", "13T", "S24", "A55", "S24+", a screen size "10.9"); units and specs ("3.0A",
// "1mt", "20W", "9D") are not models. Only words right after a device brand are looked at.
const MODEL_NUMBER = /^(?:[a-z]{0,2}\d{1,4}[a-z]?\+?|\d{1,2}[.,]\d)$/i
const SPEC_TOKEN = /^(?:\d+[.,]\d+a|\d+(?:[.,]\d+)?(?:w|v|mt|m|cm|mm|mah|gb|tb|d|k|hz|ma))$/i
// A screen size in inches after the model ("iPad Pro 11 İnç") stays with it
const INCH = /^(inç|inc|inch|"|'')$/i

// "İnfinix": the dotted capital İ does not match /i in JS
function plain(word: string): string {
    return word.replace(/İ/g, 'I')
}

function isModelNumber(word: string): boolean {
    return MODEL_NUMBER.test(word) && !SPEC_TOKEN.test(word)
}

function isModelWord(word: string): boolean {
    const w = plain(word)
    return DEVICE_BRANDS.test(w) || MODEL_WORDS.test(w) || isModelNumber(w)
}

/**
 * The device models a product name lists, as written: "Onopo iPhone 13 / 13 Pro Anti Static …" →
 * ["iPhone 13", "13 Pro"]; "… iPad Air 5 / 6 Siyah …" → ["iPad Air 5", "6"]; "… iPhone 15 Pro Max Seramik …" →
 * ["iPhone 15 Pro Max"]. Null when the name names no device model (a brand alone, "Android/iOS Uyumlu",
 * "3.0A / 1mt" are not models).
 */
export function deviceModelsFromName(name: string): string[] | null {
    const words = String(name || '').replace(/\s*\/\s*/g, ' / ').split(/\s+/).filter(Boolean)
    for (let i = 0; i < words.length; i++) {
        if (!DEVICE_BRANDS.test(plain(words[i]))) continue
        // The run of model words from the brand on, with '/' between alternatives
        const parts: string[][] = [[]]
        let j = i
        for (; j < words.length; j++) {
            const w = words[j]
            if (w === '/') {
                if (!parts[parts.length - 1].length) break
                parts.push([])
                continue
            }
            if (!isModelWord(w)) {
                const current = parts[parts.length - 1]
                if (INCH.test(plain(w)) && current.length && /\d$/.test(current[current.length - 1])) current.push(w)
                break
            }
            parts[parts.length - 1].push(w)
        }
        if (!parts[parts.length - 1].length) parts.pop() // a trailing '/'
        // Every alternative needs its own model number ("iPhone Apple Uyumlu" has none)
        if (parts.length && parts.every(p => p.some(isModelNumber))) return parts.map(p => p.join(' '))
    }
    return null
}

// ---- questions ------------------------------------------------------------------------------------------

function joinTr(items: string[]): string {
    if (items.length <= 1) return items[0] || ''
    return `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`
}

function money(n: number): string {
    return formatTL(n)
}

/** The questions with their answers, in page order (4–6 when the data is there). */
export function buildProductFaq(input: ProductFaqInput): ProductFaqItem[] {
    const { product, shipping, handlingTime, returnPolicy, maxInstallments } = input
    const items: ProductFaqItem[] = []

    const models = deviceModelsFromName(product.name)
    if (models) {
        items.push(models.length > 1
            ? { question: 'Hangi modellerle uyumlu?', answer: `Ürün adında belirtilen modellerle uyumlu: ${joinTr(models)}.` }
            : { question: 'Hangi modelle uyumlu?', answer: `Ürün adında belirtilen modelle uyumlu: ${models[0]}.` })
    }

    items.push(product.in_stock
        ? { question: 'Stokta var mı?', answer: 'Evet, bu ürün şu an stokta. Sepete ekleyip hemen sipariş verebilirsin.' }
        : { question: 'Stokta var mı?', answer: 'Bu ürün şu an stokta yok, bu yüzden şu anda sipariş verilemiyor.' })

    if (handlingTime) {
        items.push({
            question: 'Siparişim ne zaman kargoya verilir?',
            answer: `Siparişin, ödeme onayından sonra ${handlingTime.minDays}-${handlingTime.maxDays} iş günü içinde hazırlanıp kargoya verilir.`,
        })
    }

    const threshold = shipping?.freeShippingThreshold ?? null
    const cost = shipping?.shippingCost ?? null
    let shippingAnswer: string | null = null
    if (product.free_shipping || cost === 0) shippingAnswer = 'Bu üründe kargo bedava.'
    else if (cost != null && threshold != null && threshold > 0) {
        shippingAnswer = product.price >= threshold
            ? `Bu ürünün fiyatı ${money(threshold)} sınırını tek başına geçtiği için kargo bedava.`
            : `${money(threshold)} ve üzeri siparişlerde kargo bedava. Sepet tutarı bunun altındaysa kargo ücreti ${money(cost)}.`
    } else if (cost != null) shippingAnswer = `Kargo ücreti ${money(cost)}.`
    if (shippingAnswer) items.push({ question: 'Kargo ücreti ne kadar?', answer: shippingAnswer })

    if (returnPolicy) {
        items.push({
            question: 'İade edebilir miyim?',
            answer: `Teslimattan itibaren ${returnPolicy.days} gün içinde iade talebinde bulunabilirsin.${returnPolicy.freeReturn ? ' Anlaşmalı kargo firmasıyla gönderilen iadelerde kargo ücretini biz karşılarız.' : ''} Koşulların tamamı Kargo ve İade sayfasında.`,
        })
    }

    if (maxInstallments) {
        const installments = String(product.installment_info || '').replace(/\s+/g, ' ').trim()
        items.push({
            question: 'Taksitle alabilir miyim?',
            answer: installments
                ? `Kredi kartı veya banka kartıyla güvenli ödeme yapabilirsin. ${/[.!?]$/.test(installments) ? installments : `${installments}.`}`
                : `Evet. Kredi kartına ${maxInstallments} aya varan taksit seçeneği var; taksitler ödeme adımında kartının bankasına göre gösterilir.`,
        })
    }

    return items
}
