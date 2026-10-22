'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button, buttonClasses } from '@/components/ui/button'
import { useCartStore, CartItem, COUPONS_ENABLED, cartLineTotal } from '@/store/cart-store'
import { formatNumberTR, formatTL } from '@/lib/format'
import { unitPrice } from '@/lib/pricing'
import { originalImageUrl, productImageUrl } from '@/lib/images'
import { cn } from '@/lib/utils'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { Field, FormAlert, checkboxClass, inputClass, textareaClass } from '@/components/forms/Field'
import { CheckoutSkeleton } from '@/components/checkout/CheckoutSkeleton'
import { TrustNote } from '@/components/checkout/TrustNote'
import { ShoppingBag, Check, CreditCard, Lock, ChevronDown, Ticket, X, Truck, RefreshCw } from 'lucide-react'

/*
 * Checkout (/odeme/). Design spec §13: VISUALS ONLY.
 * The state, validation, payload to POST /api/orders, the PayTR iframe + 3 s polling of
 * GET /api/orders/<id>/ and the success/failure handling below are unchanged; only the markup is new.
 * Two additions: the phone number must look like a Turkish number before anything is sent (the value
 * is still sent as typed), and the payment step shows the order API's totalAmount (what PayTR charges).
 * Totals come from the cart store, which uses lib/pricing.ts (exactly what the order API charges).
 */

// The order API's lenient phone check answers with the same text (no-break spaces keep the example on one line)
const PHONE_INVALID = 'Geçerli bir telefon numarası gir (örn. 0532\u00a0123\u00a045\u00a067)'

// Validation messages (client and /api/orders use the same texts) → the field they belong to,
// so the message can also be shown under that field. Display only.
const FIELD_FOR_ERROR: Record<string, string> = {
    'Ad soyad zorunlu': 'fullName',
    'E-posta zorunlu': 'email',
    'E-posta adresi zorunlu': 'email',
    'Telefon zorunlu': 'phone',
    'Telefon numarası zorunlu': 'phone',
    'Teslimat adresi için il zorunlu': 'city',
    'Teslimat adresi için ilçe zorunlu': 'district',
    'Fatura ili zorunlu': 'billingCity',
    'Fatura ilçesi zorunlu': 'billingDistrict',
    'Fatura adresi zorunlu': 'billingAddress',
    [PHONE_INVALID]: 'phone',
}

/**
 * Turkish phone number, checked before the order is sent (the value itself is sent exactly as typed).
 * After removing spaces, dashes, dots and parentheses: 10 digits starting with 5 (mobile) or 2–4
 * (landline), or the same number after a leading 0 or +90.
 */
function isValidTurkishPhone(value: string): boolean {
    return /^(?:\+90|0)?[2-5]\d{9}$/.test(value.replace(/[\s().-]/g, ''))
}

/** 500 → "500 ₺", 499.9 → "499,90 ₺" */
function formatThreshold(amount: number): string {
    return Number.isInteger(amount) ? `${formatNumberTR(amount, 0)} ₺` : formatTL(amount)
}

const STEPS = ['Bilgiler', 'Ödeme', 'Onay'] as const

function CheckoutSteps({ current }: { current: 1 | 2 | 3 }) {
    return (
        <ol className="flex items-center gap-2 text-[13px] font-semibold" aria-label="Ödeme adımları">
            {STEPS.map((label, i) => {
                const n = i + 1
                const done = n < current
                const active = n === current
                return (
                    <li key={label} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
                        <span
                            className={cn(
                                'flex h-6 w-6 items-center justify-center rounded-full text-[12px]',
                                done && 'bg-success text-white',
                                active && 'bg-ink text-white',
                                !done && !active && 'border border-line-strong bg-white text-muted',
                            )}
                            aria-hidden="true"
                        >
                            {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
                        </span>
                        <span className={cn(active ? 'text-ink' : 'text-muted')}>
                            {label}
                            {done && <span className="sr-only"> (tamamlandı)</span>}
                        </span>
                        {n < STEPS.length && <span className="h-px w-5 bg-line-strong sm:w-8" aria-hidden="true" />}
                    </li>
                )
            })}
        </ol>
    )
}

function StepCard({ step, title, description, children }: { step: number; title: string; description?: string; children: React.ReactNode }) {
    const titleId = `checkout-step-${step}`
    return (
        <section aria-labelledby={titleId} className="rounded-sheet border border-line bg-white p-4 shadow-card sm:p-6">
            <div className="mb-5 flex items-start gap-3">
                <span className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-white" aria-hidden="true">
                    {step}
                </span>
                <div className="min-w-0">
                    <h2 id={titleId} className="type-h3 text-ink">
                        {title}
                    </h2>
                    {description && <p className="mt-0.5 text-[13px] leading-5 text-muted">{description}</p>}
                </div>
            </div>
            {children}
        </section>
    )
}

function SubHeading({ children }: { children: React.ReactNode }) {
    return <h3 className="type-micro mb-3 text-muted">{children}</h3>
}

export default function CheckoutPage() {
    const { items, getSubtotal, clearCart, coupon, applyCoupon, removeCoupon, fetchShippingSettings, getShippingCost } = useCartStore()
    const [hydrated, setHydrated] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')
    const [orderComplete, setOrderComplete] = React.useState(false)

    // Calculate totals safe for render
    // Use hydration check to avoid hydration mismatch
    // Same pricing as the order API (lib/pricing.ts): this is exactly what PayTR charges (coupons are not applied)
    const subtotal = hydrated ? getSubtotal() : 0
    const shippingCost = hydrated ? getShippingCost() : 0
    const finalTotal = subtotal + shippingCost

    React.useEffect(() => {
        useCartStore.persist.rehydrate()
        setHydrated(true)
        fetchShippingSettings()
    }, [])
    const [orderId, setOrderId] = React.useState<number | null>(null)
    const [user, setUser] = React.useState<any>(null)

    // Payment settings - Default to active/offline to prevent flash of "not active"
    const [paymentSettings, setPaymentSettings] = React.useState<any>({ is_active: true, provider: 'offline' })
    const [paymentMethod, setPaymentMethod] = React.useState<'card' | 'transfer'>('card')

    // Coupon State
    const [couponCode, setCouponCode] = React.useState('')
    const [verifying, setVerifying] = React.useState(false)
    const [couponError, setCouponError] = React.useState('')

    // Payment Iframe State
    const [iframeUrl, setIframeUrl] = React.useState<string | null>(null)
    // What PayTR charges: the order API's own total (cart prices saved in the browser can be outdated)
    const [paymentTotal, setPaymentTotal] = React.useState<number | null>(null)

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
        note: '',
        // Invoice address fields
        wantsDifferentBillingAddress: false,
        billingAddress: '',
        billingCity: '',
        billingDistrict: '',
        tcIdentity: ''
    })

    React.useEffect(() => {
        // Check if user is logged in and pre-fill data
        fetch('/api/auth/me')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data?.user) {
                    setUser(data.user)
                    // Use address fields directly from user object
                    setFormData(prev => ({
                        ...prev,
                        fullName: data.user.full_name || '',
                        email: data.user.email || '',
                        phone: data.user.phone || '',
                        address: data.user.address || '',
                        city: data.user.city || '',
                        district: data.user.district || '',
                        postalCode: data.user.postal_code || ''
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

    // Poll for payment status when iframe is displayed
    React.useEffect(() => {
        if (!iframeUrl || !orderId) return

        const checkPaymentStatus = async () => {
            try {
                const res = await fetch(`/api/orders/${orderId}`)
                if (res.ok) {
                    const order = await res.json()
                    if (order.payment_status === 'paid' || order.status === 'approved') {
                        setOrderComplete(true)
                        setIframeUrl(null)
                        clearCart()
                    }
                }
            } catch (e) {
                console.error('Payment status check failed:', e)
            }
        }

        // Check every 3 seconds
        const interval = setInterval(checkPaymentStatus, 3000)

        return () => clearInterval(interval)
    }, [iframeUrl, orderId, clearCart])

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
            if (!isValidTurkishPhone(formData.phone)) throw new Error(PHONE_INVALID)
            if (!formData.city.trim()) throw new Error('Teslimat adresi için il zorunlu')
            if (!formData.district.trim()) throw new Error('Teslimat adresi için ilçe zorunlu')
            if (formData.wantsDifferentBillingAddress) {
                if (!formData.billingCity.trim()) throw new Error('Fatura ili zorunlu')
                if (!formData.billingDistrict.trim()) throw new Error('Fatura ilçesi zorunlu')
                if (!formData.billingAddress.trim()) throw new Error('Fatura adresi zorunlu')
            }

            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: items.map(item => ({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        free_shipping: item.free_shipping || false
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
                setPaymentTotal(typeof data.totalAmount === 'number' && Number.isFinite(data.totalAmount) ? data.totalAmount : null)
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

    // ---- Display-only state and values (no effect on the order flow) ----
    const [summaryOpen, setSummaryOpen] = React.useState(false)
    const [checkMessage, setCheckMessage] = React.useState('')
    const freeThreshold = useCartStore(s => s.shippingSettings.freeThreshold)
    const itemCount = items.reduce((n, item) => n + item.quantity, 0)
    const cardPaymentActive = !!(paymentSettings?.is_active && paymentSettings?.provider !== 'offline')
    const providerName = paymentSettings?.provider === 'paytr' ? 'PayTR' : 'iyzico'
    const errorField = Object.prototype.hasOwnProperty.call(FIELD_FOR_ERROR, error) ? FIELD_FOR_ERROR[error] : undefined
    const fieldError = (name: string) => (errorField === name ? error : undefined)
    // Phone format feedback as soon as the field is left (submit runs the same check again)
    const [phoneBlurError, setPhoneBlurError] = React.useState('')
    const handlePhoneBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const value = e.target.value
        setPhoneBlurError(value.trim() && !isValidTurkishPhone(value) ? PHONE_INVALID : '')
    }
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleInputChange(e)
        if (isValidTurkishPhone(e.target.value)) {
            setPhoneBlurError('')
            if (error === PHONE_INVALID) setError('')
        }
    }

    // The confirmation replaces the (tall) payment view: show it from the top, also when the
    // payment was confirmed by the status polling rather than by the form submit
    React.useEffect(() => {
        if (orderComplete) window.scrollTo(0, 0)
    }, [orderComplete])

    // Wait for the persisted cart before deciding the cart is empty (avoids a 'Sepetiniz Boş' flash)
    if (!hydrated) {
        return <CheckoutSkeleton />
    }

    // Empty cart check
    if (items.length === 0 && !orderComplete) {
        return (
            <div className="min-h-[60vh] bg-surface py-10 lg:py-16">
                <div className="container-store">
                    <div className="mx-auto flex max-w-lg flex-col items-center rounded-sheet border border-line bg-white px-6 py-12 text-center shadow-card">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-muted" aria-hidden="true">
                            <ShoppingBag className="h-7 w-7" />
                        </span>
                        <h1 className="type-h2 mt-4 text-ink">Sepetin boş</h1>
                        <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted">
                            Ödeme yapmak için önce sepetine ürün ekle. Şarj aletleri, kablolar ve daha fazlası seni bekliyor.
                        </p>
                        <Link href="/products/" className={cn(buttonClasses({ variant: 'brand', size: '44' }), 'mt-5')}>
                            Alışverişe başla
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // Order complete
    if (orderComplete) {
        return (
            <div className="min-h-[60vh] bg-surface py-8 lg:py-14">
                <div className="container-store">
                    <div className="mx-auto max-w-xl">
                        <div className="flex justify-center">
                            <CheckoutSteps current={3} />
                        </div>
                        <div className="mt-6 rounded-sheet border border-line bg-white p-6 text-center shadow-card sm:p-10">
                            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success-50 text-success">
                                <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden="true" />
                            </div>
                            <h1 className="type-h1 text-ink">Siparişin alındı</h1>
                            <p className="mt-3 text-[15px] leading-6 text-muted">
                                Sipariş numaran: <span className="font-bold text-ink tabular">#{orderId}</span>
                            </p>
                            <p className="mt-1 text-[15px] leading-6 text-muted">
                                Sipariş detayları <span className="font-semibold text-ink-2 break-all">{formData.email}</span> adresine gönderilecek.
                            </p>
                            <p className="mx-auto mt-4 max-w-sm rounded-card bg-warning-50 px-3.5 py-2.5 text-[13px] leading-5 text-warning">
                                E-posta birkaç dakika içinde gelmezse spam / gereksiz klasörünü kontrol et.
                            </p>
                            <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
                                <Link href="/" className={buttonClasses({ variant: 'outline-ink', size: '48' })}>
                                    Ana sayfaya dön
                                </Link>
                                <Link href="/products/" className={buttonClasses({ variant: 'brand', size: '48' })}>
                                    Alışverişe devam et
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Payment Iframe (PayTR)
    if (iframeUrl) {
        return (
            <div className="min-h-[60vh] bg-surface pb-12 pt-5 lg:pb-16 lg:pt-8">
                <div className="container-store">
                    <div className="mx-auto max-w-[880px]">
                        <CheckoutSteps current={2} />
                        <div className="mt-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                            <div>
                                <h1 className="type-h1 text-ink">Kart ile ödeme</h1>
                                <p className="mt-1 text-sm text-muted">
                                    Sipariş <span className="font-semibold text-ink-2 tabular">#{orderId}</span>
                                    <span aria-hidden="true"> · </span>
                                    Ödenecek tutar <span className="font-semibold text-ink-2 tabular">{formatTL(paymentTotal ?? finalTotal)}</span>
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 overflow-hidden rounded-sheet border border-line bg-white shadow-card">
                            <iframe
                                src={iframeUrl}
                                className="w-full min-h-[600px] border-0"
                                title="Ödeme Ekranı"
                            ></iframe>
                        </div>
                        <p className="mt-4 text-center text-[13px] leading-5 text-muted">
                            Ödeme tamamlandığında bu sayfa kendiliğinden güncellenir.
                        </p>
                        <div className="mt-1 text-center">
                            <button
                                type="button"
                                onClick={async () => {
                                    setCheckMessage('')
                                    try {
                                        const res = await fetch(`/api/orders/${orderId}`)
                                        if (res.ok) {
                                            const order = await res.json()
                                            if (order.payment_status === 'paid' || order.status === 'approved') {
                                                setOrderComplete(true)
                                                setIframeUrl(null)
                                                clearCart()
                                            } else {
                                                setCheckMessage('Ödeme henüz tamamlanmadı. Lütfen bekleyin veya ödemeyi tamamlayın.')
                                            }
                                        }
                                    } catch (e) {
                                        console.error('Manual check failed:', e)
                                    }
                                }}
                                className="inline-flex min-h-11 items-center gap-1.5 rounded-card px-3 text-sm font-semibold text-brand-600 underline-offset-4 hover:text-brand-700 hover:underline"
                            >
                                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                                Ödeme tamamlandı mı? Kontrol et
                            </button>
                        </div>
                        <div aria-live="polite" className="mx-auto max-w-md">
                            {checkMessage && (
                                <FormAlert tone="info" className="mt-2">
                                    {checkMessage}
                                </FormAlert>
                            )}
                        </div>
                        <TrustNote provider={providerName} className="mx-auto mt-6 max-w-xl" />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-[60vh] bg-surface pb-12 pt-5 lg:pb-20 lg:pt-8">
            <div className="container-store">
                {/* Full container-store width, so the page lines up with the checkout header. The back
                    link and the "Güvenli ödeme" badge live in that header only. */}
                <div>
                    <CheckoutSteps current={1} />
                    <h1 className="type-h1 mt-3 text-ink lg:mt-4">Ödeme</h1>

                    <div className="mt-4 lg:mt-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
                        {/* Order summary: collapsible bar on mobile (top), sticky card on desktop (right) */}
                        <aside aria-label="Sipariş özeti" className="lg:sticky lg:top-[88px] lg:col-span-5 lg:col-start-8 lg:row-start-1">
                            <div className="rounded-sheet border border-line bg-white shadow-card">
                                <h2 className="lg:hidden">
                                    <button
                                        type="button"
                                        onClick={() => setSummaryOpen(open => !open)}
                                        aria-expanded={summaryOpen}
                                        aria-controls="checkout-summary-body"
                                        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-sheet px-4 py-3 text-left"
                                    >
                                        <span className="flex min-w-0 items-center gap-2.5">
                                            <ShoppingBag className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                                            <span className="text-[15px] font-semibold text-ink">
                                                Sipariş özeti <span className="font-normal text-muted">({itemCount} ürün)</span>
                                            </span>
                                        </span>
                                        <span className="flex shrink-0 items-center gap-1.5">
                                            <span className="type-price text-ink">{formatTL(finalTotal)}</span>
                                            <ChevronDown className={cn('h-5 w-5 text-muted transition-transform duration-200', summaryOpen && 'rotate-180')} aria-hidden="true" />
                                        </span>
                                    </button>
                                </h2>
                                <h2 className="hidden px-6 pt-6 type-h3 text-ink lg:block">
                                    Sipariş özeti <span className="font-normal text-muted">({itemCount} ürün)</span>
                                </h2>

                                <div id="checkout-summary-body" className={cn('border-t border-line px-4 pb-4 lg:block lg:border-t-0 lg:px-6 lg:pb-6', summaryOpen ? 'block' : 'hidden')}>
                                    <ul className="divide-y divide-line lg:max-h-[340px] lg:overflow-y-auto lg:pr-1">
                                        {items.map((item, idx) => (
                                            <li key={idx} className="flex gap-3 py-3.5">
                                                <Link
                                                    href={item.slug ? `/${item.slug}/` : `/product/${item.id}/`}
                                                    target="_blank"
                                                    rel="noopener"
                                                    className="relative block h-16 w-16 shrink-0 rounded-thumb border border-line bg-white p-1.5"
                                                    aria-label={`${item.name} (yeni sekmede açılır)`}
                                                >
                                                    <FallbackImage
                                                        src={productImageUrl(item.image, 200)}
                                                        fallbackSrc={originalImageUrl(item.image)}
                                                        alt=""
                                                        width={64}
                                                        height={64}
                                                        loading="lazy"
                                                        className="h-full w-full object-contain"
                                                    />
                                                    <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-bold leading-none text-white tabular" aria-hidden="true">
                                                        {item.quantity}
                                                    </span>
                                                </Link>
                                                <div className="min-w-0 flex-1">
                                                    <Link
                                                        href={item.slug ? `/${item.slug}/` : `/product/${item.id}/`}
                                                        target="_blank"
                                                        rel="noopener"
                                                        className="line-clamp-2 text-sm font-medium leading-5 text-ink hover:text-brand-600 hover:underline"
                                                    >
                                                        {item.name}
                                                    </Link>
                                                    <p className="mt-1 text-[13px] leading-5 text-muted tabular">
                                                        {item.quantity} adet × {formatTL(unitPrice(item.price))}
                                                    </p>
                                                </div>
                                                <p className="shrink-0 text-[15px] font-bold leading-5 text-ink tabular">{formatTL(cartLineTotal(item))}</p>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Coupon Input - hidden: the order API does not apply coupons (COUPONS_ENABLED in store/cart-store.ts) */}
                                    {COUPONS_ENABLED && <div className="border-t border-line py-4">
                                        {coupon ? (
                                            <div className="flex items-center justify-between rounded-card border border-success/20 bg-success-50 p-3">
                                                <div className="flex items-center gap-2">
                                                    <Ticket className="h-4 w-4 text-success" aria-hidden="true" />
                                                    <div>
                                                        <p className="text-sm font-bold text-success">{coupon.code}</p>
                                                        <p className="text-xs text-success">
                                                            {coupon.discountType === 'percent' ? `%${coupon.discountValue} İndirim` : `${coupon.discountValue} TL İndirim`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={removeCoupon}
                                                    aria-label="Kuponu kaldır"
                                                    className="inline-flex h-11 w-11 items-center justify-center rounded-card text-danger hover:bg-sale-50"
                                                >
                                                    <X className="h-4 w-4" aria-hidden="true" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <input
                                                    placeholder="Kupon kodu"
                                                    aria-label="Kupon kodu"
                                                    value={couponCode}
                                                    onChange={e => setCouponCode(e.target.value)}
                                                    className={cn(inputClass, 'h-11 flex-1')}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline-ink"
                                                    size="44"
                                                    disabled={verifying}
                                                    onClick={handleApplyCoupon}
                                                >
                                                    {verifying ? '...' : 'Uygula'}
                                                </Button>
                                            </div>
                                        )}
                                        {couponError && <p className="mt-2 text-xs text-danger">{couponError}</p>}
                                    </div>}

                                    <dl className="space-y-2.5 border-t border-line pt-4 text-sm">
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-muted">Ara toplam</dt>
                                            <dd className="font-medium text-ink tabular">{formatTL(subtotal)}</dd>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-muted">Kargo</dt>
                                            {shippingCost === 0 ? (
                                                <dd className="font-semibold text-success">Bedava</dd>
                                            ) : (
                                                <dd className="font-medium text-ink tabular">{formatTL(shippingCost)}</dd>
                                            )}
                                        </div>
                                        {COUPONS_ENABLED && coupon && (
                                            <div className="flex justify-between gap-4 text-success">
                                                <dt>İndirim ({coupon.code})</dt>
                                                <dd className="tabular">-{formatTL(calculateDiscount())}</dd>
                                            </div>
                                        )}
                                        <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3.5">
                                            <dt className="text-base font-bold text-ink">
                                                Toplam <span className="text-xs font-normal text-muted">(KDV dahil)</span>
                                            </dt>
                                            <dd className="text-xl font-extrabold text-ink tabular">{formatTL(finalTotal)}</dd>
                                        </div>
                                    </dl>

                                    {shippingCost > 0 && freeThreshold > subtotal && (
                                        <p className="mt-3.5 flex items-start gap-2 rounded-card bg-brand-50 px-3 py-2.5 text-[13px] leading-5 text-brand-700">
                                            <Truck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                            <span>
                                                {formatThreshold(freeThreshold)} ve üzeri siparişlerde kargo bedava. Bedava kargo için{' '}
                                                <strong className="font-semibold tabular">{formatTL(freeThreshold - subtotal)}</strong> kaldı.
                                            </span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        </aside>

                        {/* Form */}
                        <div className="mt-4 lg:col-span-7 lg:row-start-1 lg:mt-0">
                            <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-5">
                                {error && <FormAlert>{error}</FormAlert>}

                                <StepCard step={1} title="Teslimat bilgileri" description="Siparişin bu adrese gönderilir.">
                                    <SubHeading>İletişim</SubHeading>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <Field id="checkout-fullName" label="Ad soyad" required error={fieldError('fullName')} className="sm:col-span-2">
                                            <input
                                                type="text"
                                                name="fullName"
                                                value={formData.fullName}
                                                onChange={handleInputChange}
                                                required
                                                autoComplete="name"
                                                className={inputClass}
                                                placeholder="Adın ve soyadın"
                                            />
                                        </Field>
                                        <Field id="checkout-email" label="E-posta" required error={fieldError('email')} hint="Sipariş onayı bu adrese gelir.">
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                required
                                                autoComplete="email"
                                                inputMode="email"
                                                className={inputClass}
                                                placeholder="ornek@eposta.com"
                                            />
                                        </Field>
                                        <Field id="checkout-phone" label="Telefon" required error={fieldError('phone') || phoneBlurError || undefined} hint="Kargo ve sipariş bilgilendirmesi için.">
                                            <input
                                                type="tel"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handlePhoneChange}
                                                onBlur={handlePhoneBlur}
                                                required
                                                autoComplete="tel"
                                                className={inputClass}
                                                placeholder="05XX XXX XX XX"
                                            />
                                        </Field>
                                    </div>

                                    <div className="mt-6 border-t border-line pt-5">
                                        <SubHeading>Teslimat adresi</SubHeading>
                                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                            <Field id="checkout-city" label="İl" required error={fieldError('city')}>
                                                <input
                                                    type="text"
                                                    name="city"
                                                    value={formData.city}
                                                    onChange={handleInputChange}
                                                    required
                                                    autoComplete="shipping address-level1"
                                                    className={inputClass}
                                                    placeholder="örn. İstanbul"
                                                />
                                            </Field>
                                            <Field id="checkout-district" label="İlçe" required error={fieldError('district')}>
                                                <input
                                                    type="text"
                                                    name="district"
                                                    value={formData.district}
                                                    onChange={handleInputChange}
                                                    required
                                                    autoComplete="shipping address-level2"
                                                    className={inputClass}
                                                    placeholder="örn. Kadıköy"
                                                />
                                            </Field>
                                            <Field id="checkout-address" label="Adres" className="col-span-2">
                                                <textarea
                                                    name="address"
                                                    value={formData.address}
                                                    onChange={handleInputChange}
                                                    rows={2}
                                                    autoComplete="shipping street-address"
                                                    className={textareaClass}
                                                    placeholder="Mahalle, sokak, bina no, daire no"
                                                />
                                            </Field>
                                            <Field id="checkout-postalCode" label="Posta kodu" optional className="col-span-2 sm:col-span-1">
                                                <input
                                                    type="text"
                                                    name="postalCode"
                                                    value={formData.postalCode}
                                                    onChange={handleInputChange}
                                                    autoComplete="shipping postal-code"
                                                    inputMode="numeric"
                                                    className={inputClass}
                                                    placeholder="örn. 34000"
                                                />
                                            </Field>
                                            <Field id="checkout-note" label="Sipariş notu" optional className="col-span-2 sm:col-span-1">
                                                <input
                                                    type="text"
                                                    name="note"
                                                    value={formData.note}
                                                    onChange={handleInputChange}
                                                    autoComplete="off"
                                                    className={inputClass}
                                                    placeholder="Kurye için not"
                                                />
                                            </Field>
                                        </div>
                                    </div>
                                </StepCard>

                                <StepCard step={2} title="Fatura bilgileri" description="Faturan bu bilgilerle düzenlenir.">
                                    <Field
                                        id="checkout-tcIdentity"
                                        label="T.C. kimlik no"
                                        optional
                                        hint="Bireysel faturan için. Boş bırakabilirsin."
                                    >
                                        <input
                                            type="text"
                                            name="tcIdentity"
                                            value={formData.tcIdentity}
                                            onChange={handleInputChange}
                                            autoComplete="off"
                                            inputMode="numeric"
                                            className={inputClass}
                                            placeholder="11 haneli T.C. kimlik numaran"
                                            maxLength={11}
                                        />
                                    </Field>

                                    {/* Different Billing Address Checkbox */}
                                    <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-card border border-line px-3.5 py-2.5 transition-colors hover:border-line-strong has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
                                        <input
                                            type="checkbox"
                                            checked={formData.wantsDifferentBillingAddress}
                                            onChange={(e) => setFormData({ ...formData, wantsDifferentBillingAddress: e.target.checked })}
                                            className={checkboxClass}
                                        />
                                        <span className="text-sm font-medium text-ink-2">Fatura adresim teslimat adresinden farklı</span>
                                    </label>

                                    {/* Billing Address Fields (conditional) */}
                                    {formData.wantsDifferentBillingAddress && (
                                        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-5 sm:gap-4">
                                            <Field id="checkout-billingCity" label="Fatura ili" required error={fieldError('billingCity')}>
                                                <input
                                                    type="text"
                                                    name="billingCity"
                                                    value={formData.billingCity}
                                                    onChange={handleInputChange}
                                                    required
                                                    autoComplete="billing address-level1"
                                                    className={inputClass}
                                                    placeholder="örn. İstanbul"
                                                />
                                            </Field>
                                            <Field id="checkout-billingDistrict" label="Fatura ilçesi" required error={fieldError('billingDistrict')}>
                                                <input
                                                    type="text"
                                                    name="billingDistrict"
                                                    value={formData.billingDistrict}
                                                    onChange={handleInputChange}
                                                    required
                                                    autoComplete="billing address-level2"
                                                    className={inputClass}
                                                    placeholder="örn. Kadıköy"
                                                />
                                            </Field>
                                            <Field id="checkout-billingAddress" label="Fatura adresi" required error={fieldError('billingAddress')} className="col-span-2">
                                                <textarea
                                                    name="billingAddress"
                                                    value={formData.billingAddress}
                                                    onChange={handleInputChange}
                                                    required
                                                    autoComplete="billing street-address"
                                                    className={textareaClass}
                                                    rows={2}
                                                    placeholder="Mahalle, sokak, bina no, daire no"
                                                />
                                            </Field>
                                        </div>
                                    )}
                                </StepCard>

                                <StepCard step={3} title="Ödeme">
                                    {/* Card Payment - Always shown when PayTR is active */}
                                    {cardPaymentActive ? (
                                        <div className="flex items-center gap-3.5 rounded-card border-2 border-brand-600 bg-brand-50 p-4">
                                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600" aria-hidden="true">
                                                <Check className="h-3 w-3 text-white" strokeWidth={3} />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-ink">Kredi / banka kartı</p>
                                                <p className="text-[13px] leading-5 text-muted">
                                                    {providerName} güvenli ödeme ile öde. Kart bilgilerini bir sonraki adımda gireceksin.
                                                </p>
                                            </div>
                                            <CreditCard className="h-6 w-6 shrink-0 text-brand-600" aria-hidden="true" />
                                        </div>
                                    ) : (
                                        <FormAlert tone="info">
                                            <strong>Ödeme sistemi henüz aktif değil.</strong> Lütfen daha sonra tekrar deneyin.
                                        </FormAlert>
                                    )}

                                    <Button
                                        type="submit"
                                        variant="brand"
                                        size="52"
                                        fullWidth
                                        isLoading={loading}
                                        disabled={loading}
                                        className="mt-5 text-base"
                                    >
                                        {loading ? (
                                            'İşleniyor...'
                                        ) : (
                                            <>
                                                <Lock className="h-[18px] w-[18px]" aria-hidden="true" />
                                                {cardPaymentActive ? 'Ödemeye geç' : 'Siparişi tamamla'}
                                                <span aria-hidden="true" className="opacity-60">·</span>
                                                <span className="tabular">{formatTL(finalTotal)}</span>
                                            </>
                                        )}
                                    </Button>
                                    <TrustNote provider={providerName} className="mt-3" />
                                </StepCard>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
