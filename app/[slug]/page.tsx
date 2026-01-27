"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingBag, ArrowRight, Filter, ChevronDown } from "lucide-react"
import { useCartStore } from "@/store/cart-store"

// More products for variety
// Mock data removed

const CATEGORY_INFO: Record<string, { title: string; desc: string }> = {
    tech: { title: "Teknoloji", desc: "En son teknoloji harikası ürünleri keşfedin." },
    gaming: { title: "Oyun & Eğlence", desc: "Pro oyuncular için tasarlanmış yüksek performanslı ekipmanlar." },
    beauty: { title: "Kozmetik & Bakım", desc: "Kendinizi şımartmanız için premium kişisel bakım ürünleri." },
    products: { title: "Tüm Ürünler", desc: "Tüm kategorilerdeki ürünlerimizi keşfedin." },
    default: { title: "Tüm Ürünler", desc: "Aradığınız her şey burada." }
}

const CATEGORIES = [
    { id: "all", label: "Tümü" },
    { id: "tech", label: "Teknoloji" },
    { id: "gaming", label: "Oyun" },
    { id: "beauty", label: "Kozmetik" },
]

const PRICE_RANGES = [
    { id: "all", label: "Tüm Fiyatlar" },
    { id: "0-50", label: "0 - $50", min: 0, max: 50 },
    { id: "50-100", label: "$50 - $100", min: 50, max: 100 },
    { id: "100-200", label: "$100 - $200", min: 100, max: 200 },
    { id: "200+", label: "$200+", min: 200, max: Infinity },
]

const SORT_OPTIONS = [
    { id: "featured", label: "Öne Çıkanlar" },
    { id: "price-asc", label: "Fiyat: Düşükten Yükseğe" },
    { id: "price-desc", label: "Fiyat: Yüksekten Düşüğe" },
    { id: "name", label: "İsme Göre" },
]

export default function CategoryPage() {
    const params = useParams()
    const slug = typeof params.slug === 'string' ? params.slug : 'default'
    const info = CATEGORY_INFO[slug] || CATEGORY_INFO.default

    const { addItem, openCart } = useCartStore()

    // Filter states
    const [selectedCategory, setSelectedCategory] = React.useState(slug === 'products' ? 'all' : slug)
    const [selectedPriceRange, setSelectedPriceRange] = React.useState('all')
    const [selectedSort, setSelectedSort] = React.useState('featured')
    const [products, setProducts] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        setLoading(true)
        fetch('/api/products')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setProducts(data)
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    // Filter and sort products
    const filteredProducts = React.useMemo(() => {
        let result = [...products]

        // Category filter
        if (selectedCategory !== 'all') {
            result = result.filter(p => p.category === selectedCategory || (slug !== 'products' && p.category === slug))
        }

        // Price filter
        const priceRange = PRICE_RANGES.find(r => r.id === selectedPriceRange)
        if (priceRange && priceRange.id !== 'all') {
            result = result.filter(p => p.price >= (priceRange.min || 0) && p.price <= (priceRange.max || Infinity))
        }

        // Sort
        switch (selectedSort) {
            case 'price-asc':
                result.sort((a, b) => a.price - b.price)
                break
            case 'price-desc':
                result.sort((a, b) => b.price - a.price)
                break
            case 'name':
                result.sort((a, b) => a.name.localeCompare(b.name))
                break
        }

        return result
    }, [products, selectedCategory, selectedPriceRange, selectedSort, slug])

    const handleAddToCart = (e: React.MouseEvent, product: any) => {
        e.preventDefault()
        e.stopPropagation()
        addItem(product)
        openCart()
    }

    return (
        <div className="min-h-screen bg-white">
            <main className="pt-6 pb-20 container mx-auto px-4">
                {/* Header */}
                <div className="max-w-4xl mx-auto text-center mb-12">
                    <Badge variant="outline" className="mb-4 px-4 py-1 border-slate-300 text-slate-500 uppercase tracking-widest text-xs">Koleksiyon</Badge>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading text-slate-900 tracking-tight mb-6">
                        {info.title}
                    </h1>
                    <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                        {info.desc}
                    </p>
                </div>

                {/* Filters Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    {/* Category Pills */}
                    <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${selectedCategory === cat.id
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Filter Toggles */}
                    <div className="flex items-center gap-3">
                        {/* Price Filter */}
                        <select
                            value={selectedPriceRange}
                            onChange={(e) => setSelectedPriceRange(e.target.value)}
                            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-300"
                        >
                            {PRICE_RANGES.map(range => (
                                <option key={range.id} value={range.id}>{range.label}</option>
                            ))}
                        </select>

                        {/* Sort */}
                        <select
                            value={selectedSort}
                            onChange={(e) => setSelectedSort(e.target.value)}
                            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-300"
                        >
                            {SORT_OPTIONS.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Results Count */}
                <p className="text-slate-500 mb-6">{filteredProducts.length} ürün bulundu</p>

                {/* Products Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    {filteredProducts.length > 0 ? filteredProducts.map((product) => (
                        <div key={product.id} className="group">
                            <div className="relative bg-white rounded-2xl md:rounded-3xl p-3 md:p-4 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 h-full flex flex-col">
                                {/* Image */}
                                <a href={`/product/${product.id}`} className="block relative aspect-square rounded-xl md:rounded-2xl overflow-hidden bg-slate-100 mb-3 md:mb-4">
                                    <img
                                        src={product.images && product.images.length > 0 ? product.images[0] : product.image}
                                        alt={product.name}
                                        className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-500"
                                    />
                                    {product.original_price > product.price && (
                                        <div className="absolute top-2 left-2 z-10">
                                            <Badge className="bg-slate-900 text-white text-xs px-2 py-0.5">İndirim</Badge>
                                        </div>
                                    )}
                                </a>

                                {/* Details */}
                                <div className="flex flex-col flex-1">
                                    <a href={`/product/${product.id}`} className="block">
                                        <h3 className="font-heading font-bold text-sm md:text-base text-slate-900 line-clamp-2 mb-2 hover:text-primary transition-colors">{product.name}</h3>
                                    </a>
                                    <div className="mt-auto flex items-center justify-between pt-2 gap-2">
                                        <span className="text-base md:text-lg font-bold text-slate-900">
                                            {product.price.toFixed(2)} ₺
                                        </span>
                                        {/* ALWAYS VISIBLE Add to Cart Button */}
                                        <Button
                                            size="icon"
                                            className="rounded-full bg-slate-900 text-white h-9 w-9 md:h-10 md:w-10 shrink-0 hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all shadow-md"
                                            onClick={(e) => {
                                                e.preventDefault(); e.stopPropagation();
                                                addItem({
                                                    id: product.id,
                                                    name: product.name,
                                                    price: product.price,
                                                    image: product.images && product.images.length > 0 ? product.images[0] : product.images,
                                                    category: product.category
                                                })
                                                openCart();
                                            }}
                                        >
                                            <ShoppingBag className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="col-span-full text-center py-20 bg-slate-50 rounded-3xl">
                            <p className="text-slate-400 text-lg">Bu filtrelere uygun ürün bulunamadı.</p>
                            <Button variant="link" className="mt-4" onClick={() => { setSelectedCategory('all'); setSelectedPriceRange('all'); }}>
                                Filtreleri Temizle <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
