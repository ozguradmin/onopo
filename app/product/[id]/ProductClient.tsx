"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { ShoppingBag, Star, Truck, ShieldCheck, ArrowLeft, Minus, Plus, Check, CreditCard, MessageSquare, Send, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/store/cart-store"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/formatPrice"
import { getImageUrl } from "@/lib/utils"
import Link from "next/link"
import Image from "next/image"
import ProductShowcase from "@/components/home/ProductShowcase"
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer"
import DescriptionRenderer from "@/components/products/DescriptionRenderer"
import InstallmentModal from "@/components/product/InstallmentModal"

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






interface Review {
    id: number
    user_name: string
    rating: number
    comment: string
    created_at: string
}

export default function ProductClient({ id, freeShippingThreshold = 500 }: { id: string, freeShippingThreshold?: number }) {
    const { addItem, openCart } = useCartStore()
    const [product, setProduct] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [selectedImage, setSelectedImage] = React.useState(0)
    const [quantity, setQuantity] = React.useState(1)
    const [isFavorite, setIsFavorite] = React.useState(false)
    const [togglingFavorite, setTogglingFavorite] = React.useState(false)
    const [addedToCart, setAddedToCart] = React.useState(false)
    const [activeTab, setActiveTab] = React.useState<'desc' | 'warranty' | 'delivery' | 'installment'>('desc')

    // Reviews state
    const [reviews, setReviews] = React.useState<Review[]>([])
    const [reviewRating, setReviewRating] = React.useState(5)
    const [reviewComment, setReviewComment] = React.useState('')
    const [submittingReview, setSubmittingReview] = React.useState(false)
    const [reviewError, setReviewError] = React.useState('')
    const [user, setUser] = React.useState<any>(null)

    // Variations state
    interface ProductVariation {
        id: number
        name: string
        value: string
        price_modifier: number
        stock: number
        sku: string
        image_url: string
    }
    const [variations, setVariations] = React.useState<ProductVariation[]>([])
    const [selectedVariations, setSelectedVariations] = React.useState<Record<string, ProductVariation>>({}) // by variation name

    // Installment modal state
    const [showInstallmentModal, setShowInstallmentModal] = React.useState(false)

    React.useEffect(() => {
        // Auto slide
        if (!product) return
        const images = product.images && product.images.length > 0 ? product.images : (product.image ? [product.image] : [])
        if (images.length <= 1) return

        const timer = setInterval(() => {
            setSelectedImage(prev => (prev + 1) % images.length)
        }, 5000)
        return () => clearInterval(timer)
    }, [product])

    React.useEffect(() => {
        // Combined fetch: product + reviews + variations in ONE worker call
        fetch(`/api/product-page-data/${id}`)
            .then(res => {
                if (!res.ok) throw new Error("Not found")
                return res.json()
            })
            .then(data => {
                setProduct(data.product)
                setReviews(Array.isArray(data.reviews) ? data.reviews : [])
                setVariations(Array.isArray(data.variations) ? data.variations : [])
                setLoading(false)
            })
            .catch(() => setLoading(false))

        // Auth check stays separate (user-specific, not cacheable)
        fetch('/api/auth/me')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                setUser(data?.user || null)
                // If logged in, check if this product is favorited
                if (data?.user) {
                    fetch('/api/favorites')
                        .then(res => res.json())
                        .then(favData => {
                            const isFav = favData.favorites?.some((f: any) => f.product_id === parseInt(id))
                            setIsFavorite(isFav)
                        })
                        .catch(() => { })
                }
            })
            .catch(() => { })
    }, [id])

    // Calculate price with selected variations
    const variationPriceModifier = Object.values(selectedVariations).reduce((sum, v) => sum + (v?.price_modifier || 0), 0)
    const finalPrice = product ? product.price + variationPriceModifier : 0

    const handleAddToCart = () => {
        if (!product) return
        const variantName = Object.values(selectedVariations).map(v => v.value).join(' / ')

        // Generate unique ID for cart item based on variations to prevent merging
        const variationIds = Object.values(selectedVariations).map(v => v.id).sort().join('-')
        const uniqueId = variationIds ? `${product.id}-${variationIds}` : product.id

        for (let i = 0; i < quantity; i++) {
            addItem({
                id: uniqueId,
                name: variantName ? `${product.name} (${variantName})` : product.name,
                price: finalPrice,
                image: getImageUrl(Object.values(selectedVariations).find(v => v.image_url)?.image_url || (product.images && product.images.length > 0 ? product.images[0] : product.image)),
                category: product.category,
                slug: product.slug,
                free_shipping: !!product.free_shipping
            })
        }
        setAddedToCart(true)
        openCart()
        setTimeout(() => setAddedToCart(false), 2000)
    }



    const handleBuyNow = () => {
        if (!product) return
        const variantName = Object.values(selectedVariations).map(v => v.value).join(' / ')
        for (let i = 0; i < quantity; i++) {
            addItem({
                id: product.id,
                name: variantName ? `${product.name} (${variantName})` : product.name,
                price: finalPrice,
                image: getImageUrl(Object.values(selectedVariations).find(v => v.image_url)?.image_url || (product.images && product.images.length > 0 ? product.images[0] : product.image)),
                category: product.category,
                free_shipping: !!product.free_shipping
            })
        }
        // Direct redirect without opening cart
        window.location.href = '/odeme'
    }

    // Similar products state
    const [similarProducts, setSimilarProducts] = React.useState<any[]>([])

    React.useEffect(() => {
        if (product && product.category) {
            fetch(`/api/products?category=${encodeURIComponent(product.category)}`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        // Filter out current product and limit to 8
                        const similar = data.filter((p: any) => p.id !== product.id).slice(0, 8)
                        setSimilarProducts(similar)
                    }
                })
                .catch(() => { })
        }
    }, [product])

    const handleSubmitReview = async () => {
        if (!user) {
            window.location.href = '/login?redirect=/product/' + id
            return
        }

        setSubmittingReview(true)
        setReviewError('')

        try {
            const res = await fetch(`/api/products/${id}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating: reviewRating, comment: reviewComment })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Yorum gönderilemedi')
            }

            // Refresh reviews
            const reviewsRes = await fetch(`/api/products/${id}/reviews`)
            const reviewsData = await reviewsRes.json()
            setReviews(reviewsData || [])
            setReviewComment('')
            setReviewRating(5)
        } catch (err: any) {
            setReviewError(err.message)
        } finally {
            setSubmittingReview(false)
        }
    }

    const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 5

    if (loading) return <div className="min-h-screen pt-24 text-center">Yükleniyor...</div>
    if (!product) return <div className="min-h-screen pt-24 text-center">Ürün bulunamadı</div>

    const allImages = product.images && product.images.length > 0
        ? product.images
        : (product.image ? [product.image] : [])

    return (
        <div className="min-h-screen bg-slate-50">
            <main className="pt-2 lg:pt-24 pb-8 lg:pb-12">
                <div className="container mx-auto px-2 lg:px-4">
                    {/* Breadcrumb - Hidden on mobile */}
                    <div className="mb-4 hidden lg:block">
                        <Button
                            variant="ghost"
                            className="pl-0 hover:pl-2 transition-all text-slate-600 hover:text-slate-900"
                            onClick={() => window.history.back()}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" /> Geri Dön
                        </Button>
                    </div>

                    <div className="bg-white rounded-2xl lg:rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="grid grid-cols-1 lg:grid-cols-2">
                            {/* Image Gallery */}
                            {/* Image Gallery */}
                            <div className="p-3 lg:p-10 bg-slate-50">
                                <div className="lg:sticky lg:top-24">
                                    {/* Main Image - FIXED: object-contain for proper fit */}
                                    <div className="relative group">
                                        <motion.div
                                            key={selectedImage}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.3 }}
                                            className="aspect-square relative overflow-hidden rounded-xl lg:rounded-2xl bg-white mb-2 lg:mb-4 flex items-center justify-center max-h-[220px] lg:max-h-[500px]"
                                            onTouchStart={(e) => {
                                                const touch = e.touches[0]
                                                // @ts-ignore
                                                e.target.dataset.touchStartX = touch.clientX
                                            }}
                                            onTouchEnd={(e) => {
                                                const touch = e.changedTouches[0]
                                                // @ts-ignore
                                                const startX = parseFloat(e.target.dataset.touchStartX)
                                                const diff = startX - touch.clientX
                                                if (Math.abs(diff) > 50) {
                                                    if (diff > 0) {
                                                        // Swipe Left -> Next
                                                        setSelectedImage((prev) => (prev + 1) % allImages.length)
                                                    } else {
                                                        // Swipe Right -> Prev
                                                        setSelectedImage((prev) => (prev - 1 + allImages.length) % allImages.length)
                                                    }
                                                }
                                            }}
                                        >
                                            <div className="relative w-full h-full p-4">
                                                <Image
                                                    src={getImageUrl(allImages[selectedImage]) || '/placeholder.svg'}
                                                    alt={product.name}
                                                    fill
                                                    sizes="(max-width: 768px) 100vw, 50vw"
                                                    priority={selectedImage === 0}
                                                    className="object-contain"
                                                    onError={(e) => {
                                                        // Fallback to unoptimized img if optimization fails
                                                        const target = e.target as HTMLImageElement;
                                                        target.srcset = ""
                                                        target.src = allImages[selectedImage] || '/placeholder.svg'
                                                    }}
                                                />
                                            </div>
                                            <div className="absolute top-4 left-4 flex flex-col gap-2">
                                                {product.original_price && product.original_price > product.price && Math.round((1 - product.price / product.original_price) * 100) > 0 && (
                                                    <Badge className="bg-red-500 text-white text-sm px-3 py-1">
                                                        %{Math.round((1 - product.price / product.original_price) * 100)} İndirim
                                                    </Badge>
                                                )}
                                                {(!!product.free_shipping || product.price >= freeShippingThreshold) && (
                                                    <Badge className="bg-blue-600 text-white text-sm px-3 py-1 flex items-center gap-1">
                                                        <Truck className="w-3 h-3" /> Kargo Bedava
                                                    </Badge>
                                                )}
                                            </div>
                                        </motion.div>

                                        {/* Navigation Arrows (Desktop) */}
                                        {allImages.length > 1 && (
                                            <>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setSelectedImage((prev) => (prev - 1 + allImages.length) % allImages.length)
                                                    }}
                                                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-md text-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <ChevronLeft className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setSelectedImage((prev) => (prev + 1) % allImages.length)
                                                    }}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-md text-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    {/* Thumbnails */}
                                    {allImages.length > 1 && (
                                        <div className="flex gap-2 overflow-x-auto pb-2 px-1">
                                            {allImages.map((img: string, idx: number) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setSelectedImage(idx)}
                                                    className={`aspect-square w-14 lg:w-20 flex-shrink-0 rounded-lg lg:rounded-xl overflow-hidden border-2 transition-all bg-white relative ${selectedImage === idx
                                                        ? 'border-slate-900 ring-2 ring-slate-900/20'
                                                        : 'border-slate-200 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <Image
                                                        src={getImageUrl(img)}
                                                        alt={`Thumbnail ${idx}`}
                                                        fill
                                                        sizes="60px"
                                                        className="object-contain p-1"
                                                    />
                                                    {selectedImage === idx && (
                                                        <div className="absolute inset-0 bg-slate-900/10" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Product Info */}
                            <div className="p-3 lg:p-10 flex flex-col">
                                {/* Category & Info */}
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2 lg:mb-4">
                                    <div className="flex items-center gap-2">
                                        <a href={`/products?category=${encodeURIComponent(product.category || '')}`}>
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer text-xs">
                                                {product.category || 'Ürün'}
                                            </Badge>
                                        </a>
                                        <div className="flex items-center gap-1">
                                            <div className="flex">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <Star
                                                        key={star}
                                                        className={`w-3 h-3 lg:w-4 lg:h-4 ${star <= Math.floor(avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-xs text-slate-500 ml-1">
                                                {avgRating.toFixed(1)} ({reviews.length})
                                            </span>
                                        </div>
                                    </div>
                                    {product.product_code && (
                                        <span id="product-sku" className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                                            KOD: {product.product_code}
                                        </span>
                                    )}
                                </div>

                                {/* Title */}
                                <h1 id="product-name" className="text-lg lg:text-4xl font-bold font-heading text-slate-900 tracking-tight mb-1 lg:mb-4">
                                    {product.name}
                                </h1>

                                {/* Price */}
                                <div id="product-pricing" className="flex items-baseline gap-2 mb-3 lg:mb-6">
                                    <span id="product-price" data-price={finalPrice} data-currency="TRY" className="text-2xl lg:text-3xl font-bold text-slate-900">
                                        {formatPrice(finalPrice)}
                                    </span>
                                    {product.original_price && product.original_price > product.price && (
                                        <span id="product-original-price" data-price={product.original_price} className="text-base lg:text-xl text-slate-400 line-through">
                                            {formatPrice(product.original_price)}
                                        </span>
                                    )}
                                    {variationPriceModifier > 0 && (
                                        <span className="text-xs text-green-600">(+{formatPrice(variationPriceModifier)})</span>
                                    )}
                                    {variationPriceModifier < 0 && (
                                        <span className="text-xs text-red-600">({formatPrice(variationPriceModifier)})</span>
                                    )}
                                </div>

                                {/* Variations Selector */}
                                {variations.length > 0 && (() => {
                                    // Group variations by name
                                    const groupedVars = variations.reduce((acc, v) => {
                                        if (!acc[v.name]) acc[v.name] = []
                                        acc[v.name].push(v)
                                        return acc
                                    }, {} as Record<string, typeof variations>)

                                    return (
                                        <div className="mb-6 space-y-4">
                                            {Object.entries(groupedVars).map(([typeName, opts]) => (
                                                <div key={typeName}>
                                                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                                                        {typeName}: {selectedVariations[typeName]?.value && (
                                                            <span className="text-slate-500 font-normal">{selectedVariations[typeName].value}</span>
                                                        )}
                                                    </label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {opts.map((opt) => {
                                                            const isSelected = selectedVariations[typeName]?.id === opt.id
                                                            const isOutOfStock = opt.stock <= 0
                                                            return (
                                                                <button
                                                                    key={opt.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (!isOutOfStock) {
                                                                            setSelectedVariations(prev => ({
                                                                                ...prev,
                                                                                [typeName]: opt
                                                                            }))
                                                                        }
                                                                    }}
                                                                    disabled={isOutOfStock}
                                                                    className={`
                                                                        flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all
                                                                        ${isSelected
                                                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                                            : isOutOfStock
                                                                                ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed line-through'
                                                                                : 'border-slate-200 hover:border-slate-400 text-slate-700'
                                                                        }
                                                                    `}
                                                                >
                                                                    {opt.image_url && (
                                                                        <img
                                                                            src={opt.image_url}
                                                                            alt={opt.value}
                                                                            className="w-6 h-6 rounded object-cover"
                                                                        />
                                                                    )}
                                                                    <span className="font-medium">{opt.value}</span>
                                                                    {opt.price_modifier !== 0 && (
                                                                        <span className={`text-xs ${opt.price_modifier > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                            {opt.price_modifier > 0 ? '+' : ''}{formatPrice(opt.price_modifier)}
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                })()}

                                {/* Stock + Quantity + Favorites - ONE COMPACT ROW */}
                                <div className="mb-4 lg:mb-6 flex flex-wrap items-center gap-2 lg:gap-4">
                                    {/* Stock Status - Compact */}
                                    {(product.stock > 0) ? (
                                        <div id="product-stock" data-stock={product.stock} data-availability="InStock" className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs lg:text-sm">
                                            <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-green-500 animate-pulse" />
                                            <span className="font-medium">Stok: {product.stock > 20 ? '+20' : product.stock}</span>
                                        </div>
                                    ) : (
                                        <div id="product-stock" data-stock="0" data-availability="OutOfStock" className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs lg:text-sm">
                                            <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-red-500" />
                                            <span className="font-medium">Tükendi</span>
                                        </div>
                                    )}

                                    {/* Quantity Selector - Compact */}
                                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white text-sm">
                                        <button
                                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                            className="px-2 py-1 lg:px-3 lg:py-2 hover:bg-slate-50"
                                        >
                                            <Minus className="w-3 h-3 lg:w-4 lg:h-4 text-slate-600" />
                                        </button>
                                        <span className="px-2 lg:px-4 py-1 lg:py-2 font-medium text-slate-900 min-w-[30px] lg:min-w-[40px] text-center">
                                            {quantity}
                                        </span>
                                        <button
                                            onClick={() => setQuantity(q => q + 1)}
                                            className="px-2 py-1 lg:px-3 lg:py-2 hover:bg-slate-50"
                                        >
                                            <Plus className="w-3 h-3 lg:w-4 lg:h-4 text-slate-600" />
                                        </button>
                                    </div>

                                    {/* Favorites - Compact */}
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className={`h-8 w-8 lg:h-11 lg:w-11 rounded-lg lg:rounded-xl border-slate-200 ${isFavorite ? 'text-red-500 border-red-200 bg-red-50' : 'text-slate-400 hover:text-red-500'}`}
                                        disabled={togglingFavorite}
                                        onClick={async () => {
                                            if (!user) {
                                                window.location.href = '/login?redirect=/product/' + id
                                                return
                                            }
                                            setTogglingFavorite(true)
                                            try {
                                                const res = await fetch('/api/favorites', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ productId: parseInt(id) })
                                                })
                                                const data = await res.json()
                                                setIsFavorite(data.favorited)
                                            } catch (err) { } finally {
                                                setTogglingFavorite(false)
                                            }
                                        }}
                                    >
                                        <HeartIcon filled={isFavorite} />
                                    </Button>
                                </div>

                                <div className="flex flex-col gap-3 mb-8">
                                    <div className="flex gap-3">
                                        <Button
                                            id="add-to-cart"
                                            size="lg"
                                            className={`flex-1 h-14 text-base rounded-xl gap-2 transition-all ${addedToCart
                                                ? 'bg-green-500 hover:bg-green-600'
                                                : 'bg-slate-900 hover:bg-slate-800'
                                                }`}
                                            onClick={handleAddToCart}
                                            disabled={product.stock <= 0}
                                        >
                                            {addedToCart ? (
                                                <>
                                                    <Check className="w-5 h-5" />
                                                    Eklendi!
                                                </>
                                            ) : (
                                                <>
                                                    <ShoppingBag className="w-5 h-5" />
                                                    {product.stock > 0 ? 'Sepete Ekle' : 'Stokta Yok'}
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            id="buy-now"
                                            size="lg"
                                            onClick={handleBuyNow}
                                            disabled={product.stock <= 0}
                                            className="flex-1 h-14 text-base rounded-xl gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
                                        >
                                            <CreditCard className="w-5 h-5" />
                                            Hemen Al
                                        </Button>
                                    </div>

                                    {!!product.whatsapp_order_enabled && (
                                        <a
                                            href={`https://wa.me/${product.whatsapp_number}?text=${encodeURIComponent(`Merhaba, ${product.name} (Kod: ${product.product_code || '-'}) siparişi vermek istiyorum.`)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Button
                                                size="lg"
                                                className="w-full h-14 text-base rounded-xl gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white shadow-md shadow-green-100"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                                WhatsApp ile Sipariş Ver
                                            </Button>
                                        </a>
                                    )}


                                </div>

                                {/* Info Tabs - MOVED DOWN */}
                                <div className="mb-6">
                                    <div className="flex gap-2 border-b border-slate-200 mb-4 overflow-x-auto">
                                        {[
                                            { key: 'desc', label: 'Açıklama', show: true },
                                            { key: 'warranty', label: 'Garanti', show: !!product.warranty_info },
                                            { key: 'delivery', label: 'Teslimat', show: !!product.delivery_info },
                                            { key: 'installment', label: 'Taksit', show: !!product.installment_info },
                                        ].filter(tab => tab.show).map(tab => (
                                            <button
                                                key={tab.key}
                                                onClick={() => setActiveTab(tab.key as any)}
                                                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[2px] transition-colors whitespace-nowrap ${activeTab === tab.key
                                                    ? 'border-slate-900 text-slate-900'
                                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="text-slate-600 leading-relaxed min-h-[60px]">
                                        {activeTab === 'desc' && (
                                            product.description
                                                ? <DescriptionRenderer text={product.description} />
                                                : 'Ürün açıklaması bulunmuyor.'
                                        )}
                                        {activeTab === 'warranty' && product.warranty_info}
                                        {activeTab === 'delivery' && product.delivery_info && (
                                            <div dangerouslySetInnerHTML={{ __html: product.delivery_info }} />
                                        )}
                                        {activeTab === 'installment' && product.installment_info}
                                    </div>
                                </div>

                                {/* Shipping & Guarantee */}
                                <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-100">
                                    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-50 text-center">
                                        <Truck className={`w-5 h-5 ${!!product.free_shipping || product.price >= freeShippingThreshold ? 'text-blue-600' : 'text-slate-400'}`} />
                                        <span className="text-xs font-medium text-slate-700">
                                            {!!product.free_shipping || product.price >= freeShippingThreshold ? 'Ücretsiz Kargo' : 'Hızlı Kargo'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-50 text-center">
                                        <ShieldCheck className="w-5 h-5 text-green-600" />
                                        <span className="text-xs font-medium text-slate-700">Garanti</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-50 text-center cursor-pointer hover:bg-purple-50 hover:ring-2 ring-purple-200 transition-all" onClick={() => setShowInstallmentModal(true)}>
                                        <CreditCard className="w-5 h-5 text-purple-600" />
                                        <span className="text-xs font-medium text-slate-700">Taksit</span>
                                        <span className="text-[10px] text-purple-600 -mt-1">Tıkla, Gör</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Installment Modal */}
                    <InstallmentModal
                        isOpen={showInstallmentModal}
                        onClose={() => setShowInstallmentModal(false)}
                        productPrice={finalPrice}
                    />

                    {/* Reviews Section */}
                    <div className="mt-8 bg-white rounded-3xl shadow-sm border border-slate-100 p-6 lg:p-10">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <MessageSquare className="w-6 h-6" />
                            Müşteri Yorumları ({reviews.length})
                        </h2>

                        {/* Add Review Form */}
                        <div className="mb-8 p-6 bg-slate-50 rounded-2xl">
                            <h3 className="font-semibold text-slate-900 mb-4">Yorum Yap</h3>
                            {!user ? (
                                <p className="text-slate-500">
                                    Yorum yapmak için <a href={`/login?redirect=/product/${id}`} className="text-slate-900 font-semibold underline">giriş yapın</a>.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Puanınız</label>
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <button
                                                    key={star}
                                                    onClick={() => setReviewRating(star)}
                                                    className="p-1"
                                                >
                                                    <Star className={`w-6 h-6 ${star <= reviewRating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Yorumunuz</label>
                                        <textarea
                                            value={reviewComment}
                                            onChange={e => setReviewComment(e.target.value)}
                                            placeholder="Ürün hakkında düşüncelerinizi yazın..."
                                            className="w-full p-3 border border-slate-200 rounded-xl resize-none h-24 focus:outline-none focus:ring-2 focus:ring-slate-900"
                                        />
                                    </div>
                                    {reviewError && (
                                        <p className="text-red-500 text-sm">{reviewError}</p>
                                    )}
                                    <Button
                                        onClick={handleSubmitReview}
                                        disabled={submittingReview}
                                        className="bg-slate-900 text-white hover:bg-slate-800 gap-2"
                                    >
                                        <Send className="w-4 h-4" />
                                        {submittingReview ? 'Gönderiliyor...' : 'Yorumu Gönder'}
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Reviews List */}
                        {reviews.length === 0 ? (
                            <p className="text-slate-500 text-center py-8">Henüz yorum yapılmamış. İlk yorumu siz yapın!</p>
                        ) : (
                            <div className="space-y-4">
                                {reviews.map(review => (
                                    <div key={review.id} className="p-4 border border-slate-100 rounded-xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold">
                                                    {review.user_name?.[0]?.toUpperCase() || 'U'}
                                                </div>
                                                <span className="font-medium text-slate-900">{review.user_name || 'Anonim'}</span>
                                            </div>
                                            <div className="flex">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <Star
                                                        key={star}
                                                        className={`w-4 h-4 ${star <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        {review.comment && (
                                            <p className="text-slate-600">{review.comment}</p>
                                        )}
                                        <p className="text-xs text-slate-400 mt-2">
                                            {new Date(review.created_at).toLocaleDateString('tr-TR')}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Similar Products */}
                    {similarProducts.length > 0 && (
                        <div className="mt-8 lg:mt-12">
                            <ProductShowcase title="Benzer Ürünler" products={similarProducts} />
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
