"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import { ShoppingBag, Star, Truck, ShieldCheck, ArrowLeft, Minus, Plus, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/store/cart-store"
import { Badge } from "@/components/ui/badge"

const HeartIcon = ({ filled = false }: { filled?: boolean }) => (
    <div className="w-6 h-6 flex items-center justify-center">
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill={filled ? "#ef4444" : "none"}
            stroke={filled ? "#ef4444" : "#475569"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: 'block' }}
        >
            <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
        </svg>
    </div>
)

export default function ProductPage() {
    const params = useParams()
    const { addItem, openCart } = useCartStore()
    const [product, setProduct] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [selectedImage, setSelectedImage] = React.useState(0)
    const [quantity, setQuantity] = React.useState(1)
    const [isFavorite, setIsFavorite] = React.useState(false)
    const [addedToCart, setAddedToCart] = React.useState(false)

    React.useEffect(() => {
        if (params.id) {
            fetch(`/api/products/${params.id}`)
                .then(res => {
                    if (!res.ok) throw new Error("Not found");
                    return res.json();
                })
                .then(data => {
                    setProduct({ ...data, features: [], rating: 5, reviews: 0 }) // Defaults
                    setLoading(false)
                })
                .catch(() => setLoading(false))
        }
    }, [params.id])

    const handleAddToCart = () => {
        if (!product) return
        for (let i = 0; i < quantity; i++) {
            addItem({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.images && product.images.length > 0 ? product.images[0] : product.image,
                category: product.category
            })
        }
        setAddedToCart(true)
        openCart()
        setTimeout(() => setAddedToCart(false), 2000)
    }

    if (loading) return <div className="min-h-screen pt-24 text-center">Yükleniyor...</div>
    if (!product) return <div className="min-h-screen pt-24 text-center">Ürün bulunamadı</div>

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Reduced padding: pt-6 instead of pt-24 */}
            <main className="pt-6 pb-20">
                <div className="container mx-auto px-4">
                    {/* Breadcrumb */}
                    <div className="mb-6">
                        <Button
                            variant="ghost"
                            className="pl-0 hover:pl-2 transition-all text-slate-600 hover:text-slate-900"
                            onClick={() => window.history.back()}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" /> Geri Dön
                        </Button>
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="grid grid-cols-1 lg:grid-cols-2">
                            {/* Image Gallery */}
                            <div className="p-6 lg:p-10 bg-slate-50">
                                <div className="sticky top-24">
                                    {/* Main Image */}
                                    <motion.div
                                        key={selectedImage}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="aspect-square relative overflow-hidden rounded-2xl bg-white mb-4"
                                    >
                                        <img
                                            src={product.images && product.images.length > 0 ? product.images[selectedImage] : product.image}
                                            alt={product.name}
                                            className="object-cover w-full h-full"
                                        />
                                        {product.original_price && (
                                            <Badge className="absolute top-4 left-4 bg-red-500 text-white text-sm px-3 py-1">
                                                %{Math.round((1 - product.price / product.original_price) * 100)} İndirim
                                            </Badge>
                                        )}
                                    </motion.div>

                                    {/* Thumbnails */}
                                    {product.images && product.images.length > 1 && (
                                        <div className="flex gap-3">
                                            {product.images.map((img: string, idx: number) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setSelectedImage(idx)}
                                                    className={`aspect-square w-20 rounded-xl overflow-hidden border-2 transition-all ${selectedImage === idx
                                                        ? 'border-slate-900 ring-2 ring-slate-900/20'
                                                        : 'border-slate-200 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <img src={img} alt="" className="object-cover w-full h-full" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Product Info */}
                            <div className="p-6 lg:p-10 flex flex-col">
                                {/* Category & Rating */}
                                <div className="flex flex-wrap items-center gap-3 mb-4">
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-100">
                                        {product.category}
                                    </Badge>
                                    <div className="flex items-center gap-1">
                                        <div className="flex">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star
                                                    key={star}
                                                    className={`w-4 h-4 ${star <= Math.floor(product.rating || 5) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-sm text-slate-500 ml-2">
                                            {product.rating} ({product.reviews} değerlendirme)
                                        </span>
                                    </div>
                                </div>

                                {/* Title */}
                                <h1 className="text-3xl lg:text-4xl font-bold font-heading text-slate-900 tracking-tight mb-4">
                                    {product.name}
                                </h1>

                                {/* Price */}
                                <div className="flex items-baseline gap-3 mb-6">
                                    <span className="text-3xl font-bold text-slate-900">
                                        {product.price.toFixed(2)} ₺
                                    </span>
                                    {product.original_price && (
                                        <span className="text-xl text-slate-400 line-through">
                                            {product.original_price.toFixed(2)} ₺
                                        </span>
                                    )}
                                </div>

                                {/* Description */}
                                <p className="text-slate-600 text-lg leading-relaxed mb-8">
                                    {product.description}
                                </p>

                                {/* Features (MOCK for now, schema doesn't have features) */}
                                <div className="mb-8">
                                    <h3 className="font-bold text-slate-900 mb-4">Öne Çıkan Özellikler</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {["Premium Kalite", "Hızlı Kargo", "Garantili"].map((feature) => (
                                            <div key={feature} className="flex items-center gap-2 text-slate-600">
                                                <Check className="w-4 h-4 text-green-500" />
                                                <span className="text-sm">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Quantity Selector */}
                                <div className="flex items-center gap-4 mb-6">
                                    <span className="text-sm font-medium text-slate-700">Adet:</span>
                                    <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
                                        <button
                                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                            className="px-4 py-3 hover:bg-slate-50 transition-colors"
                                        >
                                            <Minus className="w-4 h-4 text-slate-600" />
                                        </button>
                                        <span className="px-6 py-3 font-medium text-slate-900 min-w-[60px] text-center">
                                            {quantity}
                                        </span>
                                        <button
                                            onClick={() => setQuantity(q => q + 1)}
                                            className="px-4 py-3 hover:bg-slate-50 transition-colors"
                                        >
                                            <Plus className="w-4 h-4 text-slate-600" />
                                        </button>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3 mb-8">
                                    <Button
                                        size="lg"
                                        className={`flex-1 h-14 text-base rounded-xl gap-2 transition-all ${addedToCart
                                            ? 'bg-green-500 hover:bg-green-600'
                                            : 'bg-slate-900 hover:bg-slate-800'
                                            }`}
                                        onClick={handleAddToCart}
                                    >
                                        {addedToCart ? (
                                            <>
                                                <Check className="w-5 h-5" />
                                                Eklendi!
                                            </>
                                        ) : (
                                            <>
                                                <ShoppingBag className="w-5 h-5" />
                                                Sepete Ekle
                                            </>
                                        )}
                                    </Button>

                                    {/* Favorite Button - Using SVG with hardcoded colors */}
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        className={`h-14 w-14 rounded-xl border-2 transition-all ${isFavorite
                                            ? 'bg-red-50 border-red-300'
                                            : 'bg-white border-slate-200 hover:bg-red-50 hover:border-red-300'
                                            }`}
                                        onClick={() => setIsFavorite(!isFavorite)}
                                    >
                                        <HeartIcon filled={isFavorite} />
                                    </Button>
                                </div>

                                {/* Shipping & Guarantee */}
                                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                                    <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                            <Truck className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-slate-900">Ücretsiz Kargo</p>
                                            <p className="text-xs text-slate-500">2-3 iş günü</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50">
                                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                            <ShieldCheck className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-slate-900">2 Yıl Garanti</p>
                                            <p className="text-xs text-slate-500">Resmi distribütör</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Stock Status */}
                                {(product.stock > 0) && (
                                    <div className="mt-6 flex items-center gap-2 text-green-600">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-sm font-medium">Stokta var - Hemen kargoya verilir</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
