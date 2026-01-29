import { getDB } from '@/lib/db'
import Link from 'next/link'
import { Search } from 'lucide-react'

async function getCategories() {
    try {
        const db = await getDB()
        // Improve query: Count products per category (by slug match) and filter > 0
        const { results } = await db.prepare(`
            SELECT c.name, c.slug, COUNT(p.id) as count
            FROM categories c
            JOIN products p ON p.category = c.slug
            WHERE p.is_active = 1
            GROUP BY c.slug
            HAVING count > 0
            ORDER BY c.name ASC
        `).all()
        return results || []
    } catch (e) {
        console.error("Category fetch error:", e)
        return []
    }
}

interface ProductFiltersProps {
    searchParams?: { category?: string; q?: string }
}

export async function ProductFilters({ searchParams }: ProductFiltersProps) {
    const categories = await getCategories()
    const activeCategory = searchParams?.category

    return (
        <div className="space-y-8">
            {/* Search */}
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4">Ara</h3>
                <form action="/products" className="relative">
                    <input
                        type="search"
                        name="q"
                        defaultValue={searchParams?.q}
                        placeholder="Ürün ara..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </form>
            </div>

            {/* Categories */}
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4">Kategoriler</h3>
                <div className="space-y-2">
                    <Link
                        href="/products"
                        className={`block text-sm transition-colors ${!activeCategory
                            ? 'text-black font-bold'
                            : 'text-slate-600 hover:text-black'
                            }`}
                    >
                        Tüm Ürünler
                    </Link>
                    {categories.map((cat: any) => (
                        <Link
                            key={cat.id || cat.slug}
                            href={`/products?category=${cat.slug}`}
                            className={`block text-sm transition-colors ${activeCategory === cat.slug
                                ? 'text-black font-bold'
                                : 'text-slate-600 hover:text-black'
                                }`}
                        >
                            {cat.name}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
