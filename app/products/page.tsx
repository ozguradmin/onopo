import { Suspense } from 'react'
import { Metadata } from 'next'
import { getDB } from '@/lib/db'
import ProductsClient from '@/components/products/ProductsClient'

// CDN caching handled via Cache-Control headers
export const dynamic = 'force-dynamic'

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }): Promise<Metadata> {
    const params = await searchParams
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://onopostore.com'

    let title = 'Tüm Ürünler'
    let description = 'Onopo Store\'da en yeni teknoloji ürünleri, aksesuarlar ve yaşam ürünlerini keşfedin. Uygun fiyatlar, hızlı kargo.'

    if (params.category) {
        title = `${params.category} Ürünleri`
        description = `${params.category} kategorisindeki en iyi ürünleri Onopo Store'da bulun. Güvenli ödeme ve hızlı teslimat.`
    }

    if (params.q) {
        title = `"${params.q}" Arama Sonuçları`
        description = `"${params.q}" araması için ürün sonuçları. Onopo Store'da aradığınız ürünü bulun.`
    }

    return {
        title,
        description,
        openGraph: {
            title: `${title} | Onopo Store`,
            description,
            url: `${baseUrl}/products`,
            type: 'website',
            images: [{ url: `${baseUrl}/og-products.jpg`, width: 1200, height: 630 }]
        },
        twitter: {
            card: 'summary_large_image',
            title: `${title} | Onopo Store`,
            description
        },
        alternates: {
            canonical: `${baseUrl}/products`
        }
    }
}

interface SearchParams {
    category?: string
    q?: string
    page?: string
    sort?: string
    minPrice?: string
    maxPrice?: string
    brand?: string
}

async function getProducts(category?: string, query?: string) {
    const db = await getDB()
    let sql = `SELECT id, name, slug, price, original_price, stock, category, images 
               FROM products WHERE is_active = 1 AND stock > 0`
    const params: any[] = []

    if (category) {
        sql += ` AND (category = ? OR category = ?)`
        // Support both name and slug matching
        params.push(category, category)
    }

    if (query) {
        // AGGRESSIVE SANITIZATION to prevent "LIKE pattern too complex" error
        // 1. Normalize Turkish characters to ASCII
        let sanitizedQuery = query
            .replace(/ü/gi, 'u')
            .replace(/ö/gi, 'o')
            .replace(/ş/gi, 's')
            .replace(/ğ/gi, 'g')
            .replace(/ı/gi, 'i')
            .replace(/İ/g, 'I')
            .replace(/ç/gi, 'c')
            .replace(/[%_\\'"]/g, ' ')  // Remove SQL wildcards and quotes
            .replace(/[^\w\s]/g, ' ')    // Remove special chars
            .replace(/\s+/g, ' ')        // Normalize whitespace
            .trim()

        // 2. Split into words and take only first 2 meaningful words (3+ chars)
        const words = sanitizedQuery.split(' ').filter(w => w.length >= 3).slice(0, 2)

        if (words.length > 0) {
            // Search for each word separately (AND logic)
            const conditions = words.map(() => `(name LIKE ? OR slug LIKE ?)`).join(' AND ')
            sql += ` AND (${conditions})`
            words.forEach(word => {
                params.push(`%${word}%`, `%${word}%`)
            })
        }
    }

    sql += ` ORDER BY id DESC`

    const { results } = await db.prepare(sql).bind(...params).all()

    return (results || []).map((p: any) => {
        let images = []
        try {
            images = typeof p.images === 'string' ? JSON.parse(p.images) : p.images || []
        } catch (e) {
            console.error('JSON parse error for product images:', p.id, e)
            images = []
        }
        return {
            ...p,
            images
        }
    })
}

async function getCategories() {
    const db = await getDB()
    const { results } = await db.prepare(`
        SELECT c.name, c.slug, 
               (SELECT COUNT(*) FROM products p WHERE p.is_active = 1 AND (p.category = c.name OR p.category = c.slug)) as count
        FROM categories c
        WHERE (SELECT COUNT(*) FROM products p WHERE p.is_active = 1 AND (p.category = c.name OR p.category = c.slug)) > 0
        ORDER BY c.name ASC
    `).all()
    return results || []
}

async function getBrands(products: any[]) {
    // Extract brands from product names (first word typically)
    // Case-insensitive deduplication, prefer capitalized version
    const brandMap = new Map<string, string>()
    products.forEach(p => {
        const firstWord = (p.name || '').split(' ')[0]
        if (firstWord && firstWord.length > 2) {
            const lowerKey = firstWord.toLowerCase()
            // Keep the capitalized version if exists
            if (!brandMap.has(lowerKey) || firstWord[0] === firstWord[0].toUpperCase()) {
                brandMap.set(lowerKey, firstWord)
            }
        }
    })

    // Convert to array and sort with Onopo first
    let brands = Array.from(brandMap.values())
    brands = brands.filter(b => b.toLowerCase() !== 'onopo') // Remove Onopo temporarily
    brands.sort((a, b) => a.localeCompare(b))

    // Add Onopo at the beginning if it exists
    if (brandMap.has('onopo')) {
        brands.unshift(brandMap.get('onopo')!)
    }

    return brands.slice(0, 20) // Limit to 20 brands
}

async function getSiteSettings() {
    try {
        const db = await getDB()
        const { results } = await db.prepare('SELECT key, value FROM site_settings').all()
        const settings: Record<string, string> = {}
        for (const row of (results || [])) {
            settings[(row as any).key] = (row as any).value
        }
        return settings
    } catch {
        return {}
    }
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
    const resolvedParams = await searchParams
    const [products, categories, settings] = await Promise.all([
        getProducts(resolvedParams.category, resolvedParams.q),
        getCategories(),
        getSiteSettings()
    ])
    const brands = await getBrands(products)
    const productsPerPage = parseInt(settings.products_per_page || '40', 10)

    return (
        <Suspense fallback={<div className="text-center py-20">Yükleniyor...</div>}>
            <ProductsClient
                initialProducts={products}
                initialCategories={categories as any}
                initialBrands={brands}
                searchParams={resolvedParams}
                itemsPerPage={productsPerPage}
            />
        </Suspense>
    )
}
