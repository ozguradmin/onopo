import { roundPrice } from './roundPrice'

// Turkish locale price formatter
// By default, rounds prices to look professional (.99 endings)
export function formatPrice(price: number | string | null | undefined, useRounding: boolean = true): string {
    if (price === null || price === undefined || price === '') return '0,00 ₺'

    let num = typeof price === 'number' ? price : parseFloat(String(price))
    if (isNaN(num)) return '0,00 ₺'

    // Apply rounding for customer-facing prices
    if (useRounding && num > 0) {
        num = roundPrice(num)
    }

    // Format with Turkish locale: 123.456,78
    return num.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + ' ₺'
}

// Format without rounding - for admin/internal use
export function formatPriceRaw(price: number | string | null | undefined): string {
    return formatPrice(price, false)
}
