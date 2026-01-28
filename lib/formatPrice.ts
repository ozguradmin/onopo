// Turkish locale price formatter
export function formatPrice(price: number | string | null | undefined): string {
    if (price === null || price === undefined || price === '') return '0,00 ₺'

    const num = typeof price === 'number' ? price : parseFloat(String(price))
    if (isNaN(num)) return '0,00 ₺'

    // Format with Turkish locale: 123.456,78
    return num.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + ' ₺'
}
