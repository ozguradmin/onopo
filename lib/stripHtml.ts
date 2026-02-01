/**
 * Strip HTML tags and clean text for SEO meta descriptions.
 * Removes all HTML tags, normalizes whitespace, and truncates to specified length.
 */
export function stripHtml(html: string | null | undefined, maxLength: number = 160): string {
    if (!html) return ''

    let text = html

    // 1. ADIM: Blok elementler bittiğinde (</div>, </p>) araya boşluk koy.
    // Bu sayede kelimeler birbirine yapışmaz.
    text = text.replace(/<\/(div|p|h[1-6]|li|ul|ol|br|table|tr|td)>/gi, ' ')

    // 2. ADIM: Tüm HTML etiketlerini sil.
    text = text.replace(/<[^>]*>?/gm, '')

    // Decode common HTML entities
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&lsquo;/g, "'")
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        // Turkish characters
        .replace(/&ouml;/g, 'ö').replace(/&Ouml;/g, 'Ö')
        .replace(/&ccedil;/g, 'ç').replace(/&Ccedil;/g, 'Ç')
        .replace(/&uuml;/g, 'ü').replace(/&Uuml;/g, 'Ü')
        .replace(/&deg;/g, '°')

    // 3. ADIM: İstemediğin sabit kelimeleri metinden çıkar.
    const unwantedWords = ["Ürün Açıklaması", "Detaylı Bilgi", "Teknik Özellikler", "Varyant", "Ürün Kodu", "Barkod", "Desi"]
    unwantedWords.forEach(word => {
        // Büyük/küçük harf duyarsız (gi) olarak sil
        text = text.replace(new RegExp(word, "gi"), " ")
    })

    // 4. ADIM: Oluşan fazla boşlukları (çift boşlukları) teke indir.
    text = text.replace(/\s+/g, ' ').trim()

    // 5. ADIM: SEO için ideal uzunlukta kes (Default 160, ama parametre ile değişebilir)
    if (text.length > maxLength) {
        text = text.substring(0, maxLength - 3) + '...'
    }

    return text
}
