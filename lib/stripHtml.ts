/**
 * Strip HTML tags and clean text for SEO meta descriptions.
 * Removes all HTML tags, normalizes whitespace, and truncates to specified length.
 */
export function stripHtml(html: string | null | undefined, maxLength: number = 160): string {
    if (!html) return ''

    // Remove HTML tags
    let text = html.replace(/<[^>]*>?/gm, '')

    // Decode common HTML entities
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')

    // Normalize whitespace (multiple spaces/newlines to single space)
    text = text.replace(/\s+/g, ' ').trim()

    // Truncate to max length (for SEO - Google typically shows ~155-160 chars)
    if (text.length > maxLength) {
        text = text.substring(0, maxLength - 3) + '...'
    }

    return text
}
