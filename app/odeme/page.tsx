'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useCartStore, CartItem } from '@/store/cart-store'
import { formatPrice } from '@/lib/formatPrice'
import { ArrowLeft, ShoppingBag, Check, Truck, CreditCard, User, Mail, Phone, MapPin, FileText, Ticket, X, Building2 } from 'lucide-react'

export default function CheckoutPage() {
    const router = useRouter()
    const { items, totalPrice, clearCart, coupon, applyCoupon, removeCoupon } = useCartStore()
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')
    const [orderComplete, setOrderComplete] = React.useState(false)
    const [orderId, setOrderId] = React.useState<number | null>(null)
    const [user, setUser] = React.useState<any>(null)

    // Payment settings
    const [paymentSettings, setPaymentSettings] = React.useState<any>(null)
    const [paymentMethod, setPaymentMethod] = React.useState<'card' | 'transfer'>('card')

    // Coupon State
    const [couponCode, setCouponCode] = React.useState('')
    const [verifying, setVerifying] = React.useState(false)
    const [couponError, setCouponError] = React.useState('')

    // Payment Iframe State
    const [iframeUrl, setIframeUrl] = React.useState<string | null>(null)

    // Calculations
    const calculateSubtotal = () => items.reduce((total, item) => total + (item.price || 0) * item.quantity, 0)

    const calculateDiscount = () => {
        if (!coupon) return 0
        const subtotal = calculateSubtotal()
        if (coupon.discountType === 'percent') {
            return subtotal * (coupon.discountValue / 100)
        }
        return coupon.discountValue
    }

    const handleApplyCoupon = async () => {
        if (!couponCode) return
        setVerifying(true)
        setCouponError('')
        try {
            const res = await fetch('/api/coupons/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: couponCode, cartTotal: calculateSubtotal() })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            applyCoupon(data.code, data.discount_type, data.discount_value)
            setCouponCode('')
        } catch (err: any) {
            setCouponError(err.message)
        } finally {
            setVerifying(false)
        }
    }

    // Form state
    const [formData, setFormData] = React.useState({
        fullName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        district: '',
        postalCode: '',
        note: ''
    })

    React.useEffect(() => {
        // Check if user is logged in and pre-fill data
        fetch('/api/auth/me')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data?.user) {
                    setUser(data.user)
                    setFormData(prev => ({
                        ...prev,
                        fullName: data.user.full_name || '',
                        email: data.user.email || '',
                        phone: data.user.phone || ''
                    }))
                }
            })
            .catch(() => { })

        // Fetch payment settings
        fetch('/api/admin/payment-settings')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data) {
                    setPaymentSettings(data)
                    // If no card payment available, default to transfer
                    if (!data.is_active || data.provider === 'offline') {
                        setPaymentMethod('transfer')
                    }
                }
            })
            .catch(() => { })
    }, [])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            // Validate
            if (!formData.fullName.trim()) throw new Error('Ad soyad zorunlu')
            if (!formData.email.trim()) throw new Error('E-posta zorunlu')
            if (!formData.phone.trim()) throw new Error('Telefon zorunlu')

            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: items.map(item => ({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity
                    })),
                    customerInfo: formData
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Sipariş oluşturulamadı')

            // Handle Payment
            if (data.payment && data.payment.status === 'success' && data.payment.iframeUrl) {
                // If payment required (PayTR), show iframe
                setOrderId(data.orderId)
                setIframeUrl(data.payment.iframeUrl)
                window.scrollTo(0, 0)
                return
            }

            // If offline payment or no payment required
            setOrderId(data.orderId)
            setOrderComplete(true)
            clearCart()
            window.scrollTo(0, 0) // Scroll to top for success message

        } catch (err: any) {
            setError(err.message)
            window.scrollTo(0, 0)
        } finally {
            setLoading(false)
        }
    }

    // Empty cart check
    if (items.length === 0 && !orderComplete) {
        return (
            <div className="min-h-screen bg-slate-50 py-12">
                <div className="container mx-auto px-4 max-w-2xl text-center">
                    <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-100">
                        <ShoppingBag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">Sepetiniz Boş</h1>
                        <p className="text-slate-500 mb-6">Ödeme yapmak için önce sepetinize ürün ekleyin.</p>
                        <Link href="/products">
                            <Button className="bg-slate-900 text-white hover:bg-slate-800">
                                Alışverişe Başla
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // Order complete
    if (orderComplete) {
        return (
            <div className="min-h-screen bg-slate-50 py-12">
                <div className="container mx-auto px-4 max-w-2xl text-center">
                    <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-100">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Check className="w-10 h-10 text-green-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">Siparişiniz Alındı!</h1>
                        <p className="text-slate-500 mb-4">
                            Sipariş numaranız: <span className="font-bold text-slate-900">#{orderId}</span>
                        </p>
                        <p className="text-slate-500 mb-2">
                            Sipariş detaylarınız <span className="font-medium">{formData.email}</span> adresine gönderilecektir.
                        </p>
                        <p className="text-sm text-amber-600 mb-6">
                            📧 Mail gelmezse lütfen spam/gereksiz klasörünü kontrol edin.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <Link href="/">
                                <Button variant="outline">Ana Sayfaya Dön</Button>
                            </Link>
                            <Link href="/products">
                                <Button className="bg-slate-900 text-white hover:bg-slate-800">
                                    Alışverişe Devam Et
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Payment Iframe (PayTR)
    if (iframeUrl) {
        return (
            <div className="min-h-screen bg-slate-50 pt-24 pb-8">
                <div className="container mx-auto px-4 max-w-4xl">
                    <div className="mb-6">
                        <p className="text-slate-500 mb-2 text-center">Ödeme İşlemi - Sipariş #{orderId}</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <iframe
                            src={iframeUrl}
                            className="w-full min-h-[600px] border-0"
                            title="Ödeme Ekranı"
                        ></iframe>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 py-8">
            <div className="container mx-auto px-4 max-w-6xl">
                {/* Back button */}
                <div className="mb-6">
                    <Button
                        variant="ghost"
                        className="pl-0 hover:pl-2 transition-all text-slate-600 hover:text-slate-900"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Geri
                    </Button>
                </div>

                <h1 className="text-2xl font-bold text-slate-900 mb-8">Ödeme</h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Form */}
                    <div className="lg:col-span-2 space-y-6">
                        <form onSubmit={handleSubmit}>
                            {/* Customer Info */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                        <User className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-900">Müşteri Bilgileri</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Ad Soyad <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                type="text"
                                                name="fullName"
                                                value={formData.fullName}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none"
                                                placeholder="Adınız Soyadınız"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            E-posta <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none"
                                                placeholder="email@example.com"
                                            />
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Telefon <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                type="tel"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none"
                                                placeholder="05XX XXX XX XX"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Shipping Address */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                                        <Truck className="w-5 h-5 text-green-600" />
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-900">Teslimat Adresi</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">İl</label>
                                        <input
                                            type="text"
                                            name="city"
                                            value={formData.city}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none"
                                            placeholder="İstanbul"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">İlçe</label>
                                        <input
                                            type="text"
                                            name="district"
                                            value={formData.district}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none"
                                            placeholder="Kadıköy"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Adres</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                            <textarea
                                                name="address"
                                                value={formData.address}
                                                onChange={handleInputChange}
                                                rows={2}
                                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none resize-none"
                                                placeholder="Mahalle, Sokak, Bina No, Daire No"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Posta Kodu</label>
                                        <input
                                            type="text"
                                            name="postalCode"
                                            value={formData.postalCode}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none"
                                            placeholder="34000"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Sipariş Notu</label>
                                        <input
                                            type="text"
                                            name="note"
                                            value={formData.note}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none"
                                            placeholder="Opsiyonel not..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                        <CreditCard className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-900">Ödeme Yöntemi</h2>
                                </div>

                                <div className="space-y-3">
                                    {/* Card Payment - Always shown when PayTR is active */}
                                    {paymentSettings?.is_active && paymentSettings?.provider !== 'offline' ? (
                                        <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-purple-500 bg-purple-50">
                                            <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-semibold text-slate-900">Kredi / Banka Kartı</p>
                                                <p className="text-sm text-slate-500">
                                                    {paymentSettings.provider === 'paytr' ? 'PayTR' : 'Iyzico'} güvenli ödeme ile ödeyin
                                                </p>
                                            </div>
                                            <CreditCard className="w-6 h-6 text-purple-600" />
                                        </div>
                                    ) : (
                                        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                                            <p className="text-sm text-amber-800">
                                                <strong>Ödeme sistemi henüz aktif değil.</strong> Lütfen daha sonra tekrar deneyin.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-6">
                                    {error}
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 text-lg bg-slate-900 text-white hover:bg-slate-800 rounded-xl"
                            >
                                {loading ? 'İşleniyor...' : `Siparişi Tamamla - ${formatPrice(totalPrice())}`}
                            </Button>
                        </form>
                    </div>

                    {/* Right: Order Summary */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 sticky top-24">
                            <h2 className="text-lg font-bold text-slate-900 mb-4">Sipariş Özeti</h2>

                            <div className="space-y-4 mb-6">
                                {items.map((item, idx) => (
                                    <div key={idx} className="flex gap-3">
                                        <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                                            <img
                                                src={item.image || '/placeholder.svg'}
                                                alt={item.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                                            <p className="text-sm text-slate-500">Adet: {item.quantity}</p>
                                            <p className="text-sm font-bold text-slate-900">{formatPrice(item.price * item.quantity)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Coupon Input */}
                            <div className="mb-6 border-b border-slate-100 pb-6">
                                {coupon ? (
                                    <div className="flex items-center justify-between bg-green-50 p-3 rounded-xl border border-green-100">
                                        <div className="flex items-center gap-2">
                                            <Ticket className="w-4 h-4 text-green-600" />
                                            <div>
                                                <p className="text-sm font-bold text-green-700">{coupon.code}</p>
                                                <p className="text-xs text-green-600">
                                                    {coupon.discountType === 'percent' ? `%${coupon.discountValue} İndirim` : `${coupon.discountValue} TL İndirim`}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={removeCoupon}
                                            className="text-red-500 hover:text-red-700 p-1"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            placeholder="Kupon Kodu"
                                            value={couponCode}
                                            onChange={e => setCouponCode(e.target.value)}
                                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-900"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={verifying}
                                            onClick={handleApplyCoupon}
                                        >
                                            {verifying ? '...' : 'Uygula'}
                                        </Button>
                                    </div>
                                )}
                                {couponError && <p className="text-xs text-red-500 mt-2">{couponError}</p>}
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Ara Toplam</span>
                                    <span className="text-slate-900">{formatPrice(calculateSubtotal())}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Kargo</span>
                                    <span className="text-green-600">Ücretsiz</span>
                                </div>
                                {coupon && (
                                    <div className="flex justify-between text-sm text-green-600">
                                        <span>İndirim ({coupon.code})</span>
                                        <span>-{formatPrice(calculateDiscount())}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-100">
                                    <span className="text-slate-900">Toplam</span>
                                    <span className="text-slate-900">{formatPrice(totalPrice())}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
