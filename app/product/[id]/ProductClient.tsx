"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { ShoppingBag, Star, Truck, ShieldCheck, ArrowLeft, Minus, Plus, Check, CreditCard, MessageSquare, Send } from "lucide-react"
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

interface Review {
    id: number
    user_name: string
    rating: number
    comment: string
    created_at: string
}

export default function ProductClient({ id }: { id: string }) {
    const { addItem, openCart } = useCartStore()
    const [product, setProduct] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [selectedImage, setSelectedImage] = React.useState(0)
    const [quantity, setQuantity] = React.useState(1)
    const [isFavorite, setIsFavorite] = React.useState(false)
    const [addedToCart, setAddedToCart] = React.useState(false)
    const [activeTab, setActiveTab] = React.useState<'desc' | 'warranty' | 'delivery' | 'installment'>('desc')

    // Reviews state
    const [reviews, setReviews] = React.useState<Review[]>([])
    const [reviewRating, setReviewRating] = React.useState(5)
    const [reviewComment, setReviewComment] = React.useState('')
    const [submittingReview, setSubmittingReview] = React.useState(false)
    const [reviewError, setReviewError] = React.useState('')
    const [user, setUser] = React.useState<any>(null)

    React.useEffect(() => {
        // Fetch product
        fetch(`/api/products/${id}`)
            .then(res => {
                if (!res.ok) throw new Error("Not found")
                return res.json()
            })
            .then(data => {
                setProduct(data)
                setLoading(false)
            })
            .catch(() => setLoading(false))

        // Fetch reviews
        fetch(`/api/products/${id}/reviews`)
            .then(res => res.json())
            .then(data => setReviews(data || []))
            .catch(() => { })

        // Check if user is logged in
        fetch('/api/auth/me')
            .then(res => res.ok ? res.json() : null)
            .then(data => setUser(data?.user || null))
            .catch(() => { })
    }, [id])

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
                                    {/* Main Image - FIXED: object-contain for proper fit */}
                                    <motion.div
                                        key={selectedImage}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="aspect-square relative overflow-hidden rounded-2xl bg-white mb-4 flex items-center justify-center"
                                    >
                                        <img
                                            src={allImages[selectedImage] || '/placeholder.png'}
                                            alt={product.name}
                                            className="object-contain w-full h-full p-4"
                                        />
                                        {product.original_price && (
                                            <Badge className="absolute top-4 left-4 bg-red-500 text-white text-sm px-3 py-1">
                                                %{Math.round((1 - product.price / product.original_price) * 100)} İndirim
                                            </Badge>
                                        )}
                                    </motion.div>

                                    {/* Thumbnails */}
                                    {allImages.length > 1 && (
                                        <div className="flex gap-3 overflow-x-auto pb-2">
                                            {allImages.map((img: string, idx: number) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setSelectedImage(idx)}
                                                    className={`aspect-square w-20 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all bg-white ${selectedImage === idx
                                                        ? 'border-slate-900 ring-2 ring-slate-900/20'
                                                        : 'border-slate-200 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <img src={img} alt="" className="object-contain w-full h-full p-1" />
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
                                    <a href={`/${product.category?.toLowerCase() || 'products'}`}>
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer">
                                            {product.category || 'Ürün'}
                                        </Badge>
                                    </a>
                                    <div className="flex items-center gap-1">
                                        <div className="flex">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star
                                                    key={star}
                                                    className={`w-4 h-4 ${star <= Math.floor(avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-sm text-slate-500 ml-2">
                                            {avgRating.toFixed(1)} ({reviews.length} değerlendirme)
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
                                        {product.price?.toFixed(2)} ₺
                                    </span>
                                    {product.original_price && (
                                        <span className="text-xl text-slate-400 line-through">
                                            {product.original_price.toFixed(2)} ₺
                                        </span>
                                    )}
                                </div>

                                {/* Info Tabs */}
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
                                        {activeTab === 'desc' && (product.description || 'Ürün açıklaması bulunmuyor.')}
                                        {activeTab === 'warranty' && product.warranty_info}
                                        {activeTab === 'delivery' && product.delivery_info}
                                        {activeTab === 'installment' && product.installment_info}
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
                                <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-100">
                                    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-50 text-center">
                                        <Truck className="w-5 h-5 text-blue-600" />
                                        <span className="text-xs font-medium text-slate-700">Ücretsiz Kargo</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-50 text-center">
                                        <ShieldCheck className="w-5 h-5 text-green-600" />
                                        <span className="text-xs font-medium text-slate-700">Garanti</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-50 text-center">
                                        <CreditCard className="w-5 h-5 text-purple-600" />
                                        <span className="text-xs font-medium text-slate-700">Taksit</span>
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
                </div>
            </main>
        </div>
    )
}
