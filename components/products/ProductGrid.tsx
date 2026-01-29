import { getDB } from "@/lib/db"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/formatPrice"

interface ProductGridProps {
    category?: string
    query?: string
}

async function getProducts(category?: string, query?: string) {
    const db = await getDB()
    let sql = 'SELECT * FROM products WHERE is_active = 1'
    const params: any[] = []

    if (category) {
        sql += ' AND category LIKE ?'
        params.push(`%${category}%`)
    }

    if (query) {
        sql += ' AND (name LIKE ? OR description LIKE ?)'
        params.push(`%${query}%`, `%${query}%`)
    }

    sql += ' ORDER BY created_at DESC LIMIT 50'

    const { results } = await db.prepare(sql).bind(...params).all()

    return results.map((p: any) => {
        let images: string[] = []
        try {
            images = p.images ? JSON.parse(p.images) : []
        } catch {
            images = []
        }
        return { ...p, images }
    })
}

export async function ProductGrid({ category, query }: ProductGridProps) {
    const products = await getProducts(category, query)

    if (products.length === 0) {
        return (
            <div className="text-center py-20">
                <p className="text-xl text-slate-500">Ürün bulunamadı.</p>
                <Link href="/products" className="text-slate-900 underline mt-2 inline-block">
                    Tüm ürünleri gör
                </Link>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
                <Link key={product.id} href={`/product/${product.id}`} className="group block">
                    <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 group-hover:shadow-lg transition-all">
                        <div className="aspect-[4/5] relative bg-slate-100">
                            {product.images[0] && (
                                <img
                                    src={product.images[0]}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                />
                            )}
                            {product.stock <= 0 && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <span className="bg-white text-black px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                        Tükendi
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="p-4">
                            <h3 className="font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                {product.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="font-bold text-slate-900">
                                    {formatPrice(product.price)}
                                </span>
                                {product.original_price > product.price && (
                                    <span className="text-xs text-slate-400 line-through">
                                        {formatPrice(product.original_price)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    )
}
