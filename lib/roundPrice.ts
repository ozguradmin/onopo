/**
 * Fiyatları profesyonel görünecek şekilde yuvarlar.
 * 
 * Kural: 
 * - Fiyatı en yakın 5 TL'ye yuvarla
 * - Kuruşu .99 yap
 * - Maksimum 3-4 TL değişim
 * 
 * Örnekler:
 * - 137,46 → 139,99
 * - 122,12 → 124,99  
 * - 100,07 → 99,99
 * - 48,50 → 49,99
 */
export function roundPrice(price: number | string | null | undefined): number {
    if (price === null || price === undefined || price === '') return 0

    const num = typeof price === 'number' ? price : parseFloat(String(price))
    if (isNaN(num) || num <= 0) return 0

    // DÜŞÜK FİYAT KONTROLÜ (yeni eklendi)
    // 20 TL altındaki fiyatları direkt bir üst tam sayıya yuvarlayıp .99 yap
    // Bu sayede 2.30 -> 0.99 olması engellenir, 2.30 -> 2.99 olur.
    // 0.57 -> 0.99 olur.
    if (num < 20) {
        return Math.ceil(num) - 0.01
    }

    // Tam TL kısmını al
    const wholePart = Math.floor(num)
    const decimal = num - wholePart

    // En yakın 5'in katına yuvarla (2.5 eşik)
    const remainder = wholePart % 5
    let roundedWhole: number

    if (remainder < 2.5) {
        // Aşağı yuvarla
        roundedWhole = wholePart - remainder
    } else {
        // Yukarı yuvarla  
        roundedWhole = wholePart + (5 - remainder)
    }

    // Kuruş .99 olacak şekilde ayarla
    let finalPrice = roundedWhole - 0.01

    // Fark kontrolü: maksimum 4 TL değişim
    const diff = Math.abs(finalPrice - num)
    if (diff > 4) {
        if (num > finalPrice) {
            finalPrice = Math.ceil(num) - 0.01
        } else {
            finalPrice = Math.floor(num) - 0.01
        }
    }

    // Minimum fiyat kontrolü
    if (finalPrice < 0.99) {
        finalPrice = 0.99
    }

    return finalPrice
}

/**
 * Yuvarlanmış fiyatı formatlı string olarak döndürür.
 * Örnek: 139.99 → "139,99 ₺"
 */
export function formatRoundedPrice(price: number | string | null | undefined): string {
    const rounded = roundPrice(price)
    if (rounded === 0) return '0,00 ₺'

    return rounded.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + ' ₺'
}
