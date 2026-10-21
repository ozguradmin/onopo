/**
 * Server data for the product page (/<slug>/). Builds on lib/catalog.ts (product, related products,
 * settings) and adds what only the product page needs: reviews (+ stats for the star row and the
 * JSON-LD aggregateRating), variations, the delivery promise and the category link.
 *
 * Error policy (edge-cache contract):
 * - The product itself is read with getProductById(): a D1 failure THROWS, so the page answers 500
 *   and nothing is cached. A page without price/stock must never be served as a normal 200.
 * - Secondary data (reviews, variations, related products, delivery text, category link) degrades:
 *   the page renders without it and `partial` is true, so the page adds the data-onopo-nocache marker
 *   and the worker does not store that response.
 */
import 'server-only'
import { cache } from 'react'
import { getDB } from '@/lib/db'
import {
    getMaxInstallments,
    getProductById,
    getRelatedProducts,
    getShippingSettings,
    getSiteSettings,
    type Product,
    type ProductDetail,
    type PublicSiteSettings,
    type ShippingSettings,
} from '@/lib/catalog'
import { resolveCategory } from '@/lib/seo-routing'

export interface ProductReview {
    id: number
    rating: number
    comment: string
    created_at: string | null
    /** "Ünal M." — first name + initial of the last name; the full name never leaves the server. */
    author: string
}

export interface ReviewStats {
    count: number
    /** Real average (1–5) when count > 0, else 0. */
    average: number
}

export interface ProductVariation {
    id: number
    name: string
    value: string
    price_modifier: number
    stock: number
    sku: string | null
    image_url: string | null
}

export interface ProductPageData {
    product: ProductDetail
    reviews: ProductReview[]
    reviewStats: ReviewStats
    variations: ProductVariation[]
    related: Product[]
    /** Category listing link for the breadcrumb, or null (then "Tüm Ürünler" is used). */
    category: { name: string; slug: string } | null
    /** Admin's features item "Hızlı Teslimat" text (Ana Sayfa › Neden Onopo), if any. */
    featuresDelivery: string | null
    shipping: ShippingSettings
    maxInstallments: number | null
    settings: PublicSiteSettings
    /** Some secondary data failed to load: render without it and mark the HTML as not cacheable. */
    partial: boolean
}

interface D1Stmt {
    bind(...values: unknown[]): D1Stmt
    all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>
    first<T = Record<string, unknown>>(): Promise<T | null>
}
interface D1Like {
    prepare(sql: string): D1Stmt
}

async function db(): Promise<D1Like> {
    return (await getDB()) as unknown as D1Like
}

/** First name + last-name initial ("Ünal Mert" → "Ünal M."); "Onopo müşterisi" when unknown. */
export function maskReviewerName(fullName: unknown): string {
    const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean)
    if (!parts.length) return 'Onopo müşterisi'
    const first = parts[0]
    const firstNice = first === first.toLocaleUpperCase('tr-TR') && first.length > 1
        ? first.charAt(0) + first.slice(1).toLocaleLowerCase('tr-TR')
        : first
    if (parts.length === 1) return firstNice
    const last = parts[parts.length - 1]
    return `${firstNice} ${last.charAt(0).toLocaleUpperCase('tr-TR')}.`
}

const loadReviews = cache(async (productId: number): Promise<ProductReview[]> => {
    const d = await db()
    const { results } = await d
        .prepare(
            `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name
             FROM reviews r LEFT JOIN users u ON r.user_id = u.id
             WHERE r.product_id = ?
             ORDER BY r.created_at DESC, r.id DESC`,
        )
        .bind(productId)
        .all<{ id: number; rating: number; comment: string | null; created_at: string | null; full_name: string | null }>()
    return (results ?? [])
        .map(r => ({
            id: Number(r.id),
            rating: Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0))),
            comment: String(r.comment ?? '').trim(),
            created_at: r.created_at ? String(r.created_at) : null,
            author: maskReviewerName(r.full_name),
        }))
        .filter(r => Number.isFinite(r.rating) && r.rating >= 1)
})

export function reviewStatsOf(reviews: ProductReview[]): ReviewStats {
    if (!reviews.length) return { count: 0, average: 0 }
    const sum = reviews.reduce((s, r) => s + r.rating, 0)
    return { count: reviews.length, average: Math.round((sum / reviews.length) * 10) / 10 }
}

const loadVariations = cache(async (productId: number): Promise<ProductVariation[]> => {
    const d = await db()
    const { results } = await d
        .prepare('SELECT id, name, value, price_modifier, stock, sku, image_url FROM product_variations WHERE product_id = ? ORDER BY name, value')
        .bind(productId)
        .all<Record<string, unknown>>()
    return (results ?? []).map(r => ({
        id: Number(r.id),
        name: String(r.name ?? ''),
        value: String(r.value ?? ''),
        price_modifier: Number(r.price_modifier) || 0,
        stock: Math.trunc(Number(r.stock) || 0),
        sku: r.sku ? String(r.sku) : null,
        image_url: r.image_url ? String(r.image_url) : null,
    }))
})

/** Description of the active "features" homepage item with the truck icon (e.g. "Saat 18:00'ya kadar aynı gün kargo"). */
const loadFeaturesDelivery = cache(async (): Promise<string | null> => {
    const d = await db()
    const row = await d
        .prepare("SELECT config FROM homepage_sections WHERE type = 'features' AND is_active = 1 ORDER BY display_order ASC LIMIT 1")
        .first<{ config: string | null }>()
    if (!row?.config) return null
    try {
        const cfg = JSON.parse(row.config) as { items?: Array<{ icon?: string; title?: string; description?: string }> }
        const item = (cfg.items ?? []).find(i => i && (i.icon === 'truck' || /kargo|teslim/i.test(`${i.title ?? ''} ${i.description ?? ''}`)))
        const text = String(item?.description ?? '').trim()
        return text || null
    } catch {
        return null
    }
})

async function settle<T>(label: string, p: Promise<T>, fallback: T): Promise<{ value: T; ok: boolean }> {
    try {
        return { value: await p, ok: true }
    } catch (err) {
        console.error(`[product-data] ${label} unavailable:`, err)
        return { value: fallback, ok: false }
    }
}

/**
 * Everything the product page renders, for an ACTIVE product id (from resolveSlug()).
 * Returns null when the product is not active (any more). Throws when D1 cannot read the product.
 */
export const getProductPageData = cache(async (id: number): Promise<ProductPageData | null> => {
    const product = await getProductById(id) // throws on D1 failure -> 500, never cached
    if (!product) return null

    // Settings, shipping and installments come from the layout's cached base data and never throw.
    const [reviews, variations, related, category, featuresDelivery, shipping, maxInstallments, settings] = await Promise.all([
        settle('reviews', loadReviews(product.id), [] as ProductReview[]),
        settle('variations', loadVariations(product.id), [] as ProductVariation[]),
        settle('related', getRelatedProducts(product, { limit: 12 }), [] as Product[]),
        settle('category', product.category ? resolveCategory(product.category) : Promise.resolve(null), null),
        settle('features', loadFeaturesDelivery(), null),
        getShippingSettings(),
        getMaxInstallments(),
        getSiteSettings(),
    ])

    const partial = [reviews, variations, related, category, featuresDelivery].some(r => !r.ok)

    return {
        product,
        reviews: reviews.value,
        reviewStats: reviewStatsOf(reviews.value),
        variations: variations.value,
        related: related.value,
        category: category.value && category.value.productCount > 0 ? { name: category.value.name, slug: category.value.slug } : null,
        featuresDelivery: featuresDelivery.value,
        shipping,
        maxInstallments,
        settings,
        partial,
    }
})
