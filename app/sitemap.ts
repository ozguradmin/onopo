import { MetadataRoute } from 'next'
import { getDB } from '@/lib/db'
import {
    canonicalUrl,
    categoryPath,
    cmsPagePath,
    d1DateToIso,
    parseImages,
    productPath,
    resolveImageUrl,
    xmlSafeUrl,
    type D1Like,
} from '@/lib/seo'

// Read from D1 on every request (the database is not available at build time)
export const dynamic = 'force-dynamic'

/**
 * Image entries (<image:image>) are off: Google finds product images in the page HTML and JSON-LD,
 * and Akakçe reads this file, so it keeps the <url><loc><lastmod><changefreq><priority> shape it parses today.
 */
const INCLUDE_IMAGES = false

type ProductRow = { slug: string; images: string | null; updated_at: string | null; created_at: string | null }
type CategoryRow = { slug: string; lastmod: string | null }
type PageRow = { slug: string; updated_at: string | null }

function latest(dates: Array<string | null>): string | undefined {
    let best: string | undefined
    for (const d of dates) if (d && (!best || d > best)) best = d
    return best
}

/**
 * https://onopostore.com/sitemap.xml (read by Google, Bing and the Akakçe crawler, which fetches it on www):
 * - home and /products/ (lastmod = newest product change)
 * - /kategori/<slug>/ for categories with at least one active product (lastmod = newest product change in it)
 * - every active product, in stock or not, at its canonical /<slug>/ (lastmod = updated_at, else created_at)
 * - CMS pages at /page/<slug>/ (lastmod = updated_at)
 * No utility pages, no query-string URLs, no lastmod = "now".
 * On a database error this throws (HTTP 500) so crawlers retry later instead of reading a truncated list.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const db = (await getDB()) as unknown as D1Like

    const [products, categories, pages] = await Promise.all([
        db.prepare(
            "SELECT slug, images, updated_at, created_at FROM products WHERE is_active = 1 AND slug IS NOT NULL AND slug != '' ORDER BY id"
        ).all<ProductRow>(),
        db.prepare(
            `SELECT c.slug AS slug, MAX(COALESCE(p.updated_at, p.created_at)) AS lastmod
             FROM categories c
             JOIN products p ON (LOWER(p.category) = LOWER(c.name) OR LOWER(p.category) = LOWER(c.slug)) AND p.is_active = 1
             WHERE c.slug IS NOT NULL AND c.slug != ''
             GROUP BY c.id
             ORDER BY c.name`
        ).all<CategoryRow>(),
        db.prepare('SELECT slug, updated_at FROM pages ORDER BY slug').all<PageRow>(),
    ])

    const productRows = products.results || []
    const newestProduct = d1DateToIso(latest(productRows.map((p) => p.updated_at || p.created_at)) || null) || undefined

    const entries: MetadataRoute.Sitemap = [
        { url: canonicalUrl('/'), ...(newestProduct ? { lastModified: newestProduct } : {}), changeFrequency: 'daily', priority: 1 },
        { url: canonicalUrl('/products/'), ...(newestProduct ? { lastModified: newestProduct } : {}), changeFrequency: 'daily', priority: 0.8 },
    ]

    for (const c of categories.results || []) {
        const lastModified = d1DateToIso(c.lastmod)
        entries.push({ url: xmlSafeUrl(canonicalUrl(categoryPath(c.slug))), ...(lastModified ? { lastModified } : {}), changeFrequency: 'weekly', priority: 0.7 })
    }

    for (const p of productRows) {
        const lastModified = d1DateToIso(p.updated_at) || d1DateToIso(p.created_at)
        const images = INCLUDE_IMAGES
            ? parseImages(p.images).slice(0, 5).map((i) => resolveImageUrl(i)).filter((x): x is string => Boolean(x)).map(xmlSafeUrl)
            : []
        entries.push({
            url: xmlSafeUrl(canonicalUrl(productPath(p.slug))),
            ...(lastModified ? { lastModified } : {}),
            changeFrequency: 'weekly',
            priority: 0.8,
            ...(images.length ? { images } : {}),
        })
    }

    for (const pg of pages.results || []) {
        const lastModified = d1DateToIso(pg.updated_at)
        entries.push({ url: xmlSafeUrl(canonicalUrl(cmsPagePath(pg.slug))), ...(lastModified ? { lastModified } : {}), changeFrequency: 'monthly', priority: 0.3 })
    }

    // De-duplicate (a slug could appear twice only through bad data)
    const seen = new Set<string>()
    return entries.filter((e) => (seen.has(e.url) ? false : (seen.add(e.url), true)))
}
