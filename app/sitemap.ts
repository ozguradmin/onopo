
import { MetadataRoute } from 'next'
import { getDB } from '@/lib/db'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://onopo.com'
    const db = await getDB()

    // 1. Static Routes
    const routes = [
        '',
        '/about',
        '/contact',
        '/category',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 1,
    }))

    // 2. Products
    const products = await db.prepare('SELECT id, updated_at FROM products WHERE is_active = 1').all() as any[]
    const productUrls = products.map((product) => ({
        url: `${baseUrl}/product/${product.id}`,
        lastModified: new Date(product.updated_at || Date.now()),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
    }))

    // 3. Categories
    const categories = await db.prepare('SELECT slug FROM categories').all() as any[]
    const categoryUrls = categories.map((cat) => ({
        url: `${baseUrl}/category/${cat.slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
    }))

    return [...routes, ...productUrls, ...categoryUrls]
}
