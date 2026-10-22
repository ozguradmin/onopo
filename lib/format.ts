/**
 * Display formatting for the storefront. Isomorphic and deterministic: the output never depends on
 * the ICU data of the runtime, so server HTML (Cloudflare Worker) and client hydration always agree.
 *
 * Prices: the database stores raw prices; customers see and pay `roundPrice(price)` per unit
 * (lib/roundPrice.ts, the same function app/api/orders/route.ts charges with). Use `displayPrice()`
 * for a unit price and `formatTL()` to print an amount that is already final (sums, shipping).
 */
import { roundPrice } from './roundPrice'

/** The per-unit price a customer sees and is charged (".99" rounding). 0 for missing/invalid. */
export function displayPrice(raw: number | string | null | undefined): number {
    return roundPrice(raw)
}

/** "1234.5" → "1.234,50" (Turkish separators, always 2 decimals). */
export function formatNumberTR(value: number, fractionDigits = 2): string {
    if (!Number.isFinite(value)) value = 0
    const negative = value < 0
    const fixed = Math.abs(value).toFixed(fractionDigits)
    const [whole, frac] = fixed.split('.')
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return (negative ? '-' : '') + grouped + (frac ? ',' + frac : '')
}

/**
 * Format an amount as Turkish lira: 1234.5 → "1.234,50 ₺".
 * Does NOT round to .99 — pass `displayPrice(raw)` for a product unit price.
 */
export function formatTL(value: number | string | null | undefined): string {
    const num = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
    return formatNumberTR(Number.isFinite(num) ? num : 0) + ' ₺'
}

/** Unit price as customers see it: formatTL(displayPrice(raw)). */
export function formatProductPrice(raw: number | string | null | undefined): string {
    return formatTL(displayPrice(raw))
}

/**
 * Discount percentage between two DISPLAY prices, rounded. 0 when there is no real discount.
 * Product cards show the badge only when the result is >= MIN_DISCOUNT_BADGE_PERCENT.
 */
export function discountPercent(price: number, originalPrice: number | null | undefined): number {
    if (!originalPrice || originalPrice <= 0 || !(originalPrice > price) || price <= 0) return 0
    return Math.round((1 - price / originalPrice) * 100)
}

export const MIN_DISCOUNT_BADGE_PERCENT = 5

/** "500 ₺", "1.250 ₺", "79,99 ₺": whole amounts without decimals. */
export function formatAmount(n: number): string {
    return `${formatNumberTR(n, Number.isInteger(n) ? 0 : 2)} ₺`
}

/** Turkish dative suffix for a number read aloud: 40 → "a" (kırk'a), 20 → "ye" (yirmi'ye), 15 → "e". */
export function dativeSuffixTr(n: number): string {
    const i = Math.abs(Math.trunc(n))
    if (i === 0) return 'a' // sıfır'a
    if (i % 1000000 === 0) return 'a' // milyon'a
    if (i % 1000 === 0) return 'e' // bin'e
    if (i % 100 === 0) return 'e' // yüz'e
    const ones: Record<number, string> = { 1: 'e', 2: 'ye', 3: 'e', 4: 'e', 5: 'e', 6: 'ya', 7: 'ye', 8: 'e', 9: 'a' }
    const tens: Record<number, string> = { 1: 'a', 2: 'ye', 3: 'a', 4: 'a', 5: 'ye', 6: 'a', 7: 'e', 8: 'e', 9: 'a' }
    if (i % 10 !== 0) return ones[i % 10]
    return tens[Math.trunc(i / 10) % 10] ?? 'a'
}

/** "12 ürün" — Turkish does not pluralise after numbers. */
export function formatCount(n: number, noun = 'ürün'): string {
    return `${formatNumberTR(n, 0)} ${noun}`
}

/** "2026-03-19 16:59:58" (UTC, D1 CURRENT_TIMESTAMP) → "19.03.2026" in Turkey time (UTC+3). */
export function formatDateTR(value: string | null | undefined): string {
    if (!value) return ''
    const iso = /Z|[+-]\d\d:?\d\d$/.test(value) ? value : value.replace(' ', 'T') + 'Z'
    const date = new Date(iso)
    if (isNaN(date.getTime())) return ''
    const tr = new Date(date.getTime() + 3 * 60 * 60 * 1000)
    const dd = String(tr.getUTCDate()).padStart(2, '0')
    const mm = String(tr.getUTCMonth() + 1).padStart(2, '0')
    return `${dd}.${mm}.${tr.getUTCFullYear()}`
}
