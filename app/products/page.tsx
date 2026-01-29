import { Suspense } from 'react'
import { getDB } from '@/lib/db'
import ProductsClient from '@/components/products/ProductsClient'

export const dynamic = 'force-dynamic'

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
               FROM products WHERE is_active = 1`
    const params: any[] = []

    if (category) {
        sql += ` AND (category = ? OR category = ?)`
        // Support both name and slug matching
        params.push(category, category)
    }

    if (query) {
        sql += ` AND (name LIKE ? OR description LIKE ?)`
        params.push(`%${query}%`, `%${query}%`)
    }

    sql += ` ORDER BY id DESC`

    const { results } = await db.prepare(sql).bind(...params).all()

    return (results || []).map((p: any) => ({
        ...p,
        images: typeof p.images === 'string' ? JSON.parse(p.images) : p.images || []
    }))
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

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
    const resolvedParams = await searchParams
    const products = await getProducts(resolvedParams.category, resolvedParams.q)
    const categories = await getCategories()
    const brands = await getBrands(products)

    return (
        <Suspense fallback={<div className="text-center py-20">Yükleniyor...</div>}>
            <ProductsClient
                initialProducts={products}
                initialCategories={categories as any}
                initialBrands={brands}
                searchParams={resolvedParams}
            />
        </Suspense>
    )
}
