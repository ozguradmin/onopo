"use client"

import * as React from "react"
import { ShoppingBag, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useCartStore } from "@/store/cart-store"
import { cn } from "@/lib/utils"

export default function ProductShowcase() {
    const { addItem, openCart } = useCartStore()
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

    if (loading) {
        return <div className="py-20 text-center">Yükleniyor...</div>
    }

    return (
        <section className="py-20 bg-slate-50">
            <div className="container mx-auto px-4 mb-12 flex flex-col md:flex-row items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl md:text-4xl font-bold font-heading text-slate-900 tracking-tight mb-3">
                        Trend Ürünler
                    </h2>
                    <p className="text-slate-500 text-lg">
                        Bu sezonun en popüler teknoloji ve aksesuar ürünlerini keşfedin.
                    </p>
                </div>
                <a href="/products">
                    <Button variant="outline" className="hidden md:flex rounded-full border-slate-300 px-6 hover:bg-white">
                        Tümünü Gör <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                </a>
            </div>

            {/* Grid layout for desktop, scroll for mobile - MAX WIDTH APPLIED */}
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                    {products.map((product) => (
                        <div key={product.id} className="group">
                            <div className="relative bg-white rounded-2xl md:rounded-3xl p-3 md:p-4 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 h-full flex flex-col">
                                {/* Image Area - MAX SIZE CONSTRAINED */}
                                <a href={`/product/${product.id}`} className="block relative aspect-square rounded-xl md:rounded-2xl overflow-hidden bg-slate-100 mb-3 md:mb-4">
                                    <img
                                        src={product.images && product.images.length > 0 ? product.images[0] : product.image}
                                        alt={product.name}
                                        className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-500"
                                    />
                                    {/* Badge Logic Simplified */}
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
                                    <a href={`/product/${product.id}`} className="block group-hover:text-primary transition-colors">
                                        <h3 className="font-heading font-bold text-sm md:text-base lg:text-lg text-slate-900 mb-2 line-clamp-2">
                                            {product.name}
                                        </h3>
                                    </a>

                                    <div className="mt-auto flex items-center justify-between pt-2 gap-2">
                                        <span className="text-base md:text-lg lg:text-xl font-bold text-slate-900">
                                            {product.price.toFixed(2)} ₺
                                        </span>
                                        {/* ALWAYS VISIBLE ADD BUTTON - Adds to cart AND opens drawer */}
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
                                                    category: product.category
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

            <div className="container mx-auto px-4 mt-8 md:hidden">
                <a href="/products">
                    <Button variant="outline" className="w-full rounded-full border-slate-300 h-12 hover:bg-white">
                        Tüm Ürünleri Gör
                    </Button>
                </a>
            </div>
        </section >
    )
}
