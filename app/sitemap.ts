
import { MetadataRoute } from 'next'
import { getDB } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://onopostore.com'

    try {
        const db = await getDB()

        // 1. Static Routes (SEO-valuable pages only, no login/register)
        const routes = [
            '',
            '/products',
        ].map((route) => ({
            url: `${baseUrl}${route}/`,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: route === '' ? 1 : 0.8,
        }))

        // 2. Products - use slug for SEO-friendly URLs
        const { results: products } = await db.prepare(
            'SELECT id, slug, updated_at FROM products WHERE is_active = 1 AND stock > 0'
        ).all() as { results: any[] }

        const productUrls = (products || []).map((product: any) => ({
            url: `${baseUrl}/${product.slug}/`,
            lastModified: new Date(product.updated_at || Date.now()),
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        }))

        // Categories removed from sitemap — category pages have display issues
        // and Akakçe only needs product URLs

        return [...routes, ...productUrls]
    } catch (error) {
        console.error("Sitemap generation error:", error)
        // Return basic routes if DB fails
        return [{
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 1,
        }]
    }
}
