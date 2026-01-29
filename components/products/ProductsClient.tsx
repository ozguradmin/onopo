"use client"

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShoppingBag, SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/formatPrice'
import { useCartStore } from '@/store/cart-store'

interface Product {
    id: number
    name: string
    slug: string
    price: number
    original_price: number | null
    stock: number
    category: string
    images: string[]
}

interface ProductsClientProps {
    initialProducts: Product[]
    initialCategories: { name: string; slug: string; count: number }[]
    initialBrands: string[]
    searchParams: { category?: string; q?: string; page?: string; sort?: string; minPrice?: string; maxPrice?: string; brand?: string }
}

const ITEMS_PER_PAGE = 40

export default function ProductsClient({
    initialProducts,
    initialCategories,
    initialBrands,
    searchParams
}: ProductsClientProps) {
    const { addItem, openCart } = useCartStore()
    const [showFilters, setShowFilters] = useState(false)
    const [addedProducts, setAddedProducts] = useState<Set<number>>(new Set())

    // Filter states
    const [minPrice, setMinPrice] = useState(searchParams.minPrice || '')
    const [maxPrice, setMaxPrice] = useState(searchParams.maxPrice || '')
    const [selectedBrand, setSelectedBrand] = useState(searchParams.brand || '')
    const [sortBy, setSortBy] = useState(searchParams.sort || 'newest')

    const currentPage = parseInt(searchParams.page || '1')

    const router = useRouter()

    // Search state
    const [searchQuery, setSearchQuery] = useState(searchParams.q || '')

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery !== (searchParams.q || '')) {
                updateUrl({ q: searchQuery, page: '1' })
            }
        }, 500)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const updateUrl = (updates: any) => {
        const params = new URLSearchParams(window.location.search)
        Object.entries(updates).forEach(([key, value]) => {
            if (value) params.set(key, String(value))
            else params.delete(key)
        })
        router.push(`/products?${params.toString()}`)
    }

    // Apply client-side filtering
    const filteredProducts = useMemo(() => {
        let result = [...initialProducts]

        // Price filter
        if (minPrice) {
            result = result.filter(p => p.price >= parseFloat(minPrice))
        }
        if (maxPrice) {
            result = result.filter(p => p.price <= parseFloat(maxPrice))
        }

        // Brand filter (from product name)
        if (selectedBrand) {
            result = result.filter(p => p.name.toLowerCase().includes(selectedBrand.toLowerCase()))
        }

        // Sorting
        switch (sortBy) {
            case 'price-asc':
                result.sort((a, b) => a.price - b.price)
                break
            case 'price-desc':
                result.sort((a, b) => b.price - a.price)
                break
            case 'name':
                result.sort((a, b) => a.name.localeCompare(b.name))
                break
            case 'newest':
            default:
                // Already sorted by newest from API
                break
        }

        return result
    }, [initialProducts, minPrice, maxPrice, selectedBrand, sortBy])

    // Pagination
    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    )

    const handleAddToCart = (product: Product, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        addItem({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.images[0] || '/placeholder.svg'
        })

        setAddedProducts(prev => new Set([...prev, product.id]))
        setTimeout(() => {
            setAddedProducts(prev => {
                const next = new Set(prev)
                next.delete(product.id)
                return next
            })
        }, 2000)
    }

    const clearFilters = () => {
        setMinPrice('')
        setMaxPrice('')
        setSelectedBrand('')
        setSortBy('newest')
        window.location.href = '/products'
    }

    const applyFilters = () => {
        const params = new URLSearchParams()
        if (searchParams.category) params.set('category', searchParams.category)
        if (searchParams.q) params.set('q', searchParams.q)
        if (minPrice) params.set('minPrice', minPrice)
        if (maxPrice) params.set('maxPrice', maxPrice)
        if (selectedBrand) params.set('brand', selectedBrand)
        if (sortBy !== 'newest') params.set('sort', sortBy)
        window.location.href = `/products?${params.toString()}`
    }

    const getPageUrl = (page: number) => {
        const params = new URLSearchParams()
        if (searchParams.category) params.set('category', searchParams.category)
        if (searchParams.q) params.set('q', searchParams.q)
        if (minPrice) params.set('minPrice', minPrice)
        if (maxPrice) params.set('maxPrice', maxPrice)
        if (selectedBrand) params.set('brand', selectedBrand)
        if (sortBy !== 'newest') params.set('sort', sortBy)
        params.set('page', String(page))
        return `/products?${params.toString()}`
    }

    const hasDiscount = (product: Product) => {
        return product.original_price && product.original_price > product.price
    }

    const getDiscountPercent = (product: Product) => {
        if (!hasDiscount(product)) return 0
        return Math.round((1 - product.price / product.original_price!) * 100)
    }

    return (

        <div className="container mx-auto px-4 py-8 mt-20">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">
                            {searchParams.category || (searchParams.q ? `Sonuçlar: "${searchParams.q}"` : 'Tüm Ürünler')}
                        </h1>
                        <p className="text-slate-500 mt-1">
                            Toplam <strong>{filteredProducts.length}</strong> ürün bulunmaktadır
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search Input */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Ürün ara..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm w-[150px] md:w-[200px] focus:outline-none focus:border-slate-400"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Category Select */}
                        <select
                            value={searchParams.category || ''}
                            onChange={(e) => updateUrl({ category: e.target.value, page: '1' })}
                            className="px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm max-w-[150px]"
                        >
                            <option value="">Tüm Kategoriler</option>
                            {initialCategories.map(cat => (
                                <option key={cat.slug} value={cat.name}>{cat.name} ({cat.count})</option>
                            ))}
                        </select>

                        {/* Sort dropdown */}
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm"
                        >
                            <option value="newest">En Yeni</option>
                            <option value="price-asc">Fiyat Artan</option>
                            <option value="price-desc">Fiyat Azalan</option>
                            <option value="name">İsim (A-Z)</option>
                        </select>

                        <Button
                            variant="outline"
                            onClick={() => setShowFilters(!showFilters)}
                            className="gap-2 lg:hidden"
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                            Filtrele
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Filters */}
                <aside className={`w-full lg:w-64 shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}>
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-900">Filtreler</h3>
                            <button onClick={clearFilters} className="text-sm text-red-500 hover:underline">
                                Temizle
                            </button>
                        </div>

                        {/* Categories */}
                        <div>
                            <h4 className="font-semibold text-slate-700 mb-3">Kategoriler</h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                <Link
                                    href="/products"
                                    className={`block text-sm transition-colors ${!searchParams.category
                                        ? 'text-black font-bold'
                                        : 'text-slate-600 hover:text-black'
                                        }`}
                                >
                                    Tüm Ürünler
                                </Link>
                                {initialCategories.map((cat) => (
                                    <Link
                                        key={cat.slug}
                                        href={`/products?category=${encodeURIComponent(cat.name)}`}
                                        className={`block text-sm transition-colors ${searchParams.category === cat.name || searchParams.category === cat.slug
                                            ? 'text-black font-bold'
                                            : 'text-slate-600 hover:text-black'
                                            }`}
                                    >
                                        {cat.name} <span className="text-slate-400">({cat.count})</span>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Price Range */}
                        <div>
                            <h4 className="font-semibold text-slate-700 mb-3">Fiyat Aralığı</h4>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    placeholder="Min"
                                    value={minPrice}
                                    onChange={(e) => setMinPrice(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                />
                                <span className="text-slate-400">-</span>
                                <input
                                    type="number"
                                    placeholder="Max"
                                    value={maxPrice}
                                    onChange={(e) => setMaxPrice(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                />
                            </div>
                        </div>

                        {/* Brand Filter */}
                        {initialBrands.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-slate-700 mb-3">Marka</h4>
                                <select
                                    value={selectedBrand}
                                    onChange={(e) => setSelectedBrand(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                >
                                    <option value="">Tüm Markalar</option>
                                    {initialBrands.map((brand) => (
                                        <option key={brand} value={brand}>{brand}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <Button onClick={applyFilters} className="w-full bg-slate-900 text-white">
                            Filtreleri Uygula
                        </Button>
                    </div>
                </aside>

                {/* Products Grid */}
                <main className="flex-1">
                    {paginatedProducts.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border">
                            <p className="text-xl text-slate-500 mb-4">Ürün bulunamadı.</p>
                            <Button onClick={clearFilters} variant="outline">
                                Filtreleri Temizle
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                                {paginatedProducts.map((product) => (
                                    <div key={product.id} className="group bg-white rounded-2xl overflow-hidden border border-slate-100 hover:shadow-lg transition-all">
                                        <Link href={`/${product.slug}`} className="block">
                                            <div className="aspect-[4/5] relative bg-slate-100">
                                                {product.images[0] && (
                                                    <img
                                                        src={product.images[0]}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                    />
                                                )}
                                                {product.stock <= 0 && (
                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                        <span className="bg-white text-black px-3 py-1 rounded-full text-xs font-bold">
                                                            Tükendi
                                                        </span>
                                                    </div>
                                                )}
                                                {hasDiscount(product) && getDiscountPercent(product) > 0 && (
                                                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
                                                        %{getDiscountPercent(product)} İndirim
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                        <div className="p-4">
                                            <Link href={`/${product.slug}`}>
                                                <h3 className="font-medium text-slate-900 line-clamp-2 text-sm group-hover:text-blue-600 transition-colors mb-2">
                                                    {product.name}
                                                </h3>
                                            </Link>
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="font-bold text-slate-900">
                                                    {formatPrice(product.price)}
                                                </span>
                                                {hasDiscount(product) && (
                                                    <span className="text-xs text-slate-400 line-through">
                                                        {formatPrice(product.original_price!)}
                                                    </span>
                                                )}
                                            </div>
                                            <Button
                                                size="sm"
                                                className={`w-full gap-2 transition-all ${addedProducts.has(product.id)
                                                    ? 'bg-green-500 hover:bg-green-600'
                                                    : 'bg-slate-900 hover:bg-slate-800'
                                                    }`}
                                                onClick={(e) => handleAddToCart(product, e)}
                                                disabled={product.stock <= 0}
                                            >
                                                <ShoppingBag className="w-4 h-4" />
                                                {addedProducts.has(product.id) ? 'Eklendi!' : product.stock > 0 ? 'Sepete Ekle' : 'Tükendi'}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-2 mt-8">
                                    <Link
                                        href={getPageUrl(Math.max(1, currentPage - 1))}
                                        className={`p-2 rounded-lg border ${currentPage === 1 ? 'opacity-50 pointer-events-none' : 'hover:bg-slate-100'}`}
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </Link>

                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let page: number
                                        if (totalPages <= 5) {
                                            page = i + 1
                                        } else if (currentPage <= 3) {
                                            page = i + 1
                                        } else if (currentPage >= totalPages - 2) {
                                            page = totalPages - 4 + i
                                        } else {
                                            page = currentPage - 2 + i
                                        }
                                        return (
                                            <Link
                                                key={page}
                                                href={getPageUrl(page)}
                                                className={`px-4 py-2 rounded-lg ${currentPage === page
                                                    ? 'bg-slate-900 text-white'
                                                    : 'border hover:bg-slate-100'
                                                    }`}
                                            >
                                                {page}
                                            </Link>
                                        )
                                    })}

                                    <Link
                                        href={getPageUrl(Math.min(totalPages, currentPage + 1))}
                                        className={`p-2 rounded-lg border ${currentPage === totalPages ? 'opacity-50 pointer-events-none' : 'hover:bg-slate-100'}`}
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </Link>
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}
