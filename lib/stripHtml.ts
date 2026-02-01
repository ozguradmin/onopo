/**
 * Strip HTML tags and clean text for SEO meta descriptions.
 * Removes all HTML tags, normalizes whitespace, and truncates to specified length.
 */
export function stripHtml(html: string | null | undefined, maxLength: number = 160): string {
    if (!html) return ''

    // Remove HTML tags - replacing with space to prevent word concatenation (e.g. </h1>next)
    let text = html.replace(/<[^>]*>?/gm, ' ')

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

    // Normalize whitespace (multiple spaces/newlines to single space)
    text = text.replace(/\s+/g, ' ').trim()

    // Remove redundant "Ürün Açıklaması" prefix if present
    text = text.replace(/^Ürün Açıklaması\s*/i, '')

    // Truncate to max length (for SEO - Google typically shows ~155-160 chars)
    if (text.length > maxLength) {
        text = text.substring(0, maxLength - 3) + '...'
    }

    return text
}
