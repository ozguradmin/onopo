"use client"

import * as React from "react"
import { ShoppingBag, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useCartStore } from "@/store/cart-store"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/formatPrice"

interface ProductShowcaseProps {
    title?: string
    description?: string
    products?: any[]
    category?: string
}

export default function ProductShowcase({ title = "Trend Ürünler", description, products: initialProducts, category }: ProductShowcaseProps) {
    const { addItem, openCart } = useCartStore()
    const [products, setProducts] = React.useState<any[]>(initialProducts || [])
    const [loading, setLoading] = React.useState(!initialProducts)

    React.useEffect(() => {
        if (initialProducts) return
        setLoading(true)
        fetch('/api/products')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setProducts(data)
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    // Auto Scroll Logic
    React.useEffect(() => {
        const container = document.getElementById(`carousel-${title.replace(/\s/g, '')}`)
        if (!container) return

        const scrollInterval = setInterval(() => {
            if (container.scrollLeft + container.clientWidth >= container.scrollWidth) {
                container.scrollTo({ left: 0, behavior: 'smooth' })
            } else {
                container.scrollBy({ left: 300, behavior: 'smooth' })
            }
        }, 7000)

        return () => clearInterval(scrollInterval)
    }, [title, products])

    if (loading) {
        return <div className="py-12 text-center">Yükleniyor...</div>
    }

    return (
        <section className="py-12 bg-slate-50">
            <div className="container mx-auto px-4 mb-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-3xl md:text-3xl font-bold font-heading text-slate-900 tracking-tight mb-2">
                            {title}
                        </h2>
                        <p className="text-slate-500 text-base md:text-lg">
                            {description || "Bu sezonun en popüler teknoloji ve aksesuar ürünlerini keşfedin."}
                        </p>
                    </div>

                    {/* See All Button - Header Position for both Mobile and Desktop */}
                    href={category ? `/products?category=${encodeURIComponent(category)}` : '/products'}
                    className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors self-end mt-2 md:mt-0"
                    >
                    Tümünü Gör <ArrowRight className="w-4 h-4" />
                </a>
            </div>
        </div>

            {/* Carousel Layout for Desktop & Mobile */ }
    <div className="relative container mx-auto px-4 group/carousel">
        {/* Scroll Buttons - Visible on hover (Desktop) */}
        <button
            onClick={() => {
                const container = document.getElementById(`carousel-${title.replace(/\s/g, '')}`);
                if (container) container.scrollBy({ left: -300, behavior: 'smooth' });
            }}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 backdrop-blur shadow-lg border border-slate-100 p-3 rounded-full text-slate-800 opacity-0 group-hover/carousel:opacity-100 transition-all hover:scale-110 -ml-4"
        >
            <ArrowRight className="w-5 h-5 rotate-180" />
        </button>

        <button
            onClick={() => {
                const container = document.getElementById(`carousel-${title.replace(/\s/g, '')}`);
                if (container) container.scrollBy({ left: 300, behavior: 'smooth' });
            }}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 backdrop-blur shadow-lg border border-slate-100 p-3 rounded-full text-slate-800 opacity-0 group-hover/carousel:opacity-100 transition-all hover:scale-110 -mr-4"
        >
            <ArrowRight className="w-5 h-5" />
        </button>

        <div
            id={`carousel-${title.replace(/\s/g, '')}`}
            className="flex gap-4 md:gap-6 overflow-x-auto pb-8 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide scroll-smooth"
        >
            {products.map((product) => (
                <div key={product.id} className="min-w-[160px] md:min-w-[280px] snap-start">
                    <div className="relative bg-white rounded-2xl md:rounded-3xl p-3 md:p-4 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 h-full flex flex-col group">
                        {/* Image Area */}
                        <a href={`/${product.slug}`} className="block relative aspect-square rounded-xl md:rounded-2xl overflow-hidden bg-slate-100 mb-3 md:mb-4">
                            <img
                                src={product.images && product.images.length > 0 ? product.images[0] : product.image}
                                alt={product.name}
                                className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-500"
                                loading="lazy"
                            />
                            {/* Badge Logic */}
                            {(product.original_price > product.price) && (
                                <div className="absolute top-2 left-2 z-10">
                                    <Badge className="bg-red-500 text-white text-[10px] md:text-xs px-2 md:px-3 py-1 font-medium border-0 shadow-sm">
                                        İndirim
                                    </Badge>
                                </div>
                            )}
                        </a>

                        {/* Details */}
                        <div className="flex flex-col flex-1">
                            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                                {product.category}
                            </p>
                            <a href={`/${product.slug}`} className="block group-hover:text-primary transition-colors">
                                <h3 className="font-heading font-bold text-sm md:text-base lg:text-lg text-slate-900 mb-2 line-clamp-2 min-h-[40px] md:min-h-[56px]">
                                    {product.name}
                                </h3>
                            </a>

                            <div className="mt-auto flex items-center justify-between pt-2 gap-2">
                                <span className="text-base md:text-lg lg:text-xl font-bold text-slate-900">
                                    {formatPrice(product.price)}
                                </span>
                                <Button
                                    size="icon"
                                    className="rounded-full bg-slate-900 text-white h-8 w-8 md:h-10 md:w-10 shrink-0 hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all shadow-md"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        addItem({
                                            id: product.id,
                                            name: product.name,
                                            price: product.price,
                                            image: product.images && product.images.length > 0 ? product.images[0] : product.images,
                                            category: product.category,
                                            slug: product.slug
                                        });
                                        openCart();
                                    }}
                                >
                                    <ShoppingBag className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
        </section >
    )
}
