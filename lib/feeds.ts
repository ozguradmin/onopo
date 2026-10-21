// Helpers shared by the product feeds (app/api/feeds/*, app/api/feed/*).
// Feed consumers (Google Merchant, Akakçe, marketplaces) need absolute, canonical URLs and the
// exact price the checkout charges (lib/pricing.ts).
import { getImageUrl } from './utils'
import { unitPrice } from './pricing'

export const CANONICAL_ORIGIN = 'https://onopostore.com'

// https + apex form of site_settings.site_url (feeds used to emit whatever was stored there)
export function canonicalOrigin(siteUrl?: string | null): string {
    try {
        const url = new URL(siteUrl || CANONICAL_ORIGIN)
        return `https://${url.host.replace(/^www\./, '')}`
    } catch {
        return CANONICAL_ORIGIN
    }
}

// Canonical product page: /<slug>/ with the trailing slash (what the sitemap and Akakçe use)
export function productPageUrl(origin: string, slug: string | null | undefined, id: number | string): string {
    return slug ? `${origin}/${encodeURIComponent(slug)}/` : `${origin}/product/${id}/`
}

// Stored images are '/api/images/<key>'; feeds get the absolute R2 custom-domain URL (same bytes,
// same URL as the product page JSON-LD)
export function absoluteImageUrl(image: string | null | undefined, origin: string): string {
    const value = typeof image === 'string' ? image.trim() : ''
    if (!value) return ''
    const url = getImageUrl(value)
    return url.startsWith('/') ? `${origin}${url}` : url
}

export function parseImages(images: unknown): string[] {
    if (Array.isArray(images)) return images.filter(i => typeof i === 'string')
    if (typeof images !== 'string' || !images) return []
    try {
        const parsed = JSON.parse(images)
        return Array.isArray(parsed) ? parsed.filter(i => typeof i === 'string') : []
    } catch {
        return []
    }
}

// The charged price and, only when it is really higher, the crossed-out list price
export function feedPrices(price: number | string, originalPrice: number | string | null | undefined): { price: number, listPrice: number | null } {
    const charged = unitPrice(price)
    const list = originalPrice ? unitPrice(originalPrice) : 0
    return { price: charged, listPrice: list > charged ? list : null }
}

export function escapeXml(str: string): string {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}
