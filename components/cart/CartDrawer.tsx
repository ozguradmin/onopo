"use client"

/**
 * Cart drawer (spec §12). Right drawer, 420px on desktop, full width on phones; focus trap, Escape and
 * overlay close it, focus returns to the button that opened it.
 *
 * Money: every amount comes from the cart store, which uses lib/pricing (the arithmetic the order API
 * charges with): Ara toplam = getSubtotal(), Kargo = getShippingCost() with the shipping settings
 * fetched from /api/shipping-settings exactly like /odeme, Toplam = the same sum /odeme shows.
 * The coupon box stays behind COUPONS_ENABLED (the order API does not apply coupons).
 *
 * The open state is not persisted (store/cart-store.ts partialize), so it never reopens by itself.
 */
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, Lock, Minus, Plus, ShoppingBag, Trash2, Truck, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTL } from "@/lib/format"
import { unitPrice } from "@/lib/pricing"
import { displayName } from "@/lib/search"
import { originalImageUrl, productImageUrl } from "@/lib/images"
import { productPath } from "@/lib/seo"
import { buttonClasses } from "@/components/ui/button"
import { FallbackImage } from "@/components/ui/FallbackImage"
import { useCartStore, COUPONS_ENABLED, cartLineTotal, type CartItem } from "@/store/cart-store"
import { Drawer } from "@/components/layout/Drawer"
import { useStoreData } from "@/components/layout/store-data"
import { PaymentMarks } from "@/components/layout/trust"
import { CartSuggestions } from "./CartSuggestions"

function itemHref(item: CartItem): string {
    return item.slug ? productPath(item.slug) : `/product/${encodeURIComponent(String(item.id))}/`
}

export function CartDrawer() {
    const router = useRouter()
    const isOpen = useCartStore(s => s.isOpen)
    const closeCart = useCartStore(s => s.closeCart)
    const items = useCartStore(s => s.items)
    const coupon = useCartStore(s => s.coupon)
    const settings = useCartStore(s => s.shippingSettings)
    const { removeItem, updateQuantity, totalPrice, applyCoupon, removeCoupon, totalItems, getSubtotal, getShippingCost, fetchShippingSettings } = useCartStore.getState()
    const { categories } = useStoreData()
    const closeRef = React.useRef<HTMLButtonElement>(null)

    // Same shipping settings source as /odeme, so the totals here equal the checkout totals
    React.useEffect(() => {
        if (!isOpen) return
        fetchShippingSettings()
        if (items.length > 0) router.prefetch('/odeme/')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    const count = totalItems()
    const subtotal = getSubtotal()
    const shipping = getShippingCost()
    const total = totalPrice() + shipping
    const hasFreeItem = items.some(i => i.free_shipping)
    const threshold = settings.freeThreshold
    const remaining = Math.max(0, Math.round((threshold - subtotal) * 100) / 100)
    const freeShipping = items.length > 0 && shipping === 0

    return (
        <Drawer
            open={isOpen}
            onClose={closeCart}
            side="right"
            labelledBy="cart-drawer-title"
            initialFocus={closeRef}
            className="w-full sm:max-w-[420px] sm:rounded-l-sheet"
        >
            <div id="cart-drawer" className="flex h-full min-h-0 flex-col">
                {/* Header */}
                <div className="flex h-16 shrink-0 items-center justify-between border-b border-line pl-5 pr-3">
                    <h2 id="cart-drawer-title" className="flex items-baseline gap-2 text-lg font-bold text-ink">
                        Sepetim
                        {count > 0 && <span className="text-sm font-semibold text-muted tabular-nums">({count} ürün)</span>}
                    </h2>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={closeCart}
                        aria-label="Sepeti kapat"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-card text-ink transition-colors hover:bg-surface-2"
                    >
                        <X className="h-6 w-6" aria-hidden="true" strokeWidth={1.75} />
                    </button>
                </div>

                {items.length === 0 ? (
                    <EmptyCart onClose={closeCart} categories={categories.slice(0, 4)} />
                ) : (
                    <>
                        {/* Free-shipping progress */}
                        <div className="shrink-0 border-b border-line bg-surface px-5 py-3.5" aria-live="polite">
                            {freeShipping ? (
                                <p className="flex items-center gap-2 text-sm font-semibold text-success">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-white" aria-hidden="true">
                                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                    </span>
                                    {hasFreeItem && subtotal < threshold ? 'Sepetinde kargo bedava ürün var: kargo bedava' : 'Kargo bedava'}
                                </p>
                            ) : (
                                <p className="flex items-center gap-2 text-sm text-ink-2">
                                    <Truck className="h-[18px] w-[18px] shrink-0 text-brand-600" aria-hidden="true" />
                                    <span>
                                        Kargonun bedava olmasına <strong className="font-bold text-ink tabular-nums">{formatTL(remaining)}</strong> kaldı
                                    </span>
                                </p>
                            )}
                            {threshold > 0 && (
                                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
                                    <div
                                        className={cn('h-full rounded-full transition-[width] duration-500 ease-sheet', freeShipping ? 'bg-success' : 'bg-brand-500')}
                                        style={{ width: `${freeShipping ? 100 : Math.min(100, Math.max(4, (subtotal / threshold) * 100))}%` }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Lines + suggestions */}
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                            <ul className="divide-y divide-line px-5" aria-label="Sepetteki ürünler">
                                {items.map(item => (
                                    <CartLine
                                        key={item.id}
                                        item={item}
                                        onClose={closeCart}
                                        onRemove={() => removeItem(item.id)}
                                        onQuantity={q => updateQuantity(item.id, q)}
                                    />
                                ))}
                            </ul>
                            {!freeShipping && remaining > 0 && <CartSuggestions remaining={remaining} />}
                        </div>

                        {/* Summary */}
                        <div className="shrink-0 border-t border-line bg-white px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
                            {COUPONS_ENABLED && <CouponBox coupon={coupon} items={items} applyCoupon={applyCoupon} removeCoupon={removeCoupon} />}
                            <dl className="flex flex-col gap-1.5 text-sm">
                                <div className="flex justify-between text-ink-2">
                                    <dt>Ara toplam</dt>
                                    <dd className="tabular-nums">{formatTL(subtotal)}</dd>
                                </div>
                                <div className="flex justify-between text-ink-2">
                                    <dt>Kargo</dt>
                                    <dd className={cn('tabular-nums', shipping === 0 && 'font-semibold text-success')}>{shipping === 0 ? 'Bedava' : formatTL(shipping)}</dd>
                                </div>
                                {COUPONS_ENABLED && coupon && (
                                    <div className="flex justify-between text-success">
                                        <dt>İndirim ({coupon.code})</dt>
                                        <dd className="tabular-nums">-{formatTL(subtotal - totalPrice())}</dd>
                                    </div>
                                )}
                                <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2.5">
                                    <dt className="text-base font-bold text-ink">Toplam</dt>
                                    <dd className="text-lg font-extrabold text-ink tabular-nums" data-price="">
                                        {formatTL(total)}
                                    </dd>
                                </div>
                            </dl>
                            <Link
                                href="/odeme/"
                                prefetch={false}
                                onClick={closeCart}
                                className={buttonClasses({ variant: 'brand', size: '52', fullWidth: true, className: 'mt-4' })}
                            >
                                <Lock className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={2.25} />
                                Güvenli ödemeye geç
                                <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
                            </Link>
                            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                                <PaymentMarks />
                                <span className="text-xs text-muted">PayTR güvencesiyle</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Drawer>
    )
}

function CartLine({
    item,
    onClose,
    onRemove,
    onQuantity,
}: {
    item: CartItem
    onClose: () => void
    onRemove: () => void
    onQuantity: (q: number) => void
}) {
    const href = itemHref(item)
    const line = cartLineTotal(item)
    const unit = unitPrice(item.price)
    const plusRef = React.useRef<HTMLButtonElement>(null)
    return (
        <li className="flex gap-3.5 py-4">
            <Link
                href={href}
                prefetch={false}
                onClick={onClose}
                tabIndex={-1}
                aria-hidden="true"
                className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-thumb border border-line bg-white p-1.5"
            >
                <FallbackImage
                    src={productImageUrl(item.image, 200)}
                    fallbackSrc={originalImageUrl(item.image)}
                    alt=""
                    width={60}
                    height={60}
                    loading="lazy"
                    className="h-full w-full object-contain"
                />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start gap-3">
                    <Link
                        href={href}
                        prefetch={false}
                        onClick={onClose}
                        title={item.name}
                        className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-5 text-ink hover:text-brand-600"
                    >
                        {displayName(item.name)}
                    </Link>
                    <p className="shrink-0 text-[15px] font-bold text-ink tabular-nums">{formatTL(line)}</p>
                </div>
                {item.quantity > 1 && <p className="mt-0.5 text-[13px] text-muted tabular-nums">{formatTL(unit)} / adet</p>}
                <div className="mt-auto flex items-center justify-between pt-2.5">
                    <div className="flex items-center rounded-thumb border border-line-strong" role="group" aria-label={`Adet: ${item.name}`}>
                        {/* Like the product page stepper: "−" stops at 1; removing is only "Kaldır" */}
                        <button
                            type="button"
                            onClick={() => {
                                onQuantity(item.quantity - 1)
                                // The button disables itself at 1: keep keyboard focus in the stepper
                                if (item.quantity - 1 <= 1) plusRef.current?.focus()
                            }}
                            disabled={item.quantity <= 1}
                            aria-label={`Bir azalt: ${item.name}`}
                            className="relative inline-flex h-9 w-9 items-center justify-center text-ink transition-colors hover:bg-surface before:absolute before:-inset-1 before:content-[''] disabled:text-subtle disabled:hover:bg-transparent"
                        >
                            <Minus className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-ink tabular-nums" aria-live="polite" aria-atomic="true">
                            <span className="sr-only">Adet </span>
                            {item.quantity}
                        </span>
                        <button
                            ref={plusRef}
                            type="button"
                            onClick={() => onQuantity(item.quantity + 1)}
                            aria-label={`Bir artır: ${item.name}`}
                            className="relative inline-flex h-9 w-9 items-center justify-center text-ink transition-colors hover:bg-surface before:absolute before:-inset-1 before:content-['']"
                        >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={onRemove}
                        aria-label={`Sepetten çıkar: ${item.name}`}
                        className="relative inline-flex h-9 items-center gap-1.5 rounded-thumb px-2 text-[13px] font-medium text-muted transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-sale-50 hover:text-danger"
                    >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Kaldır
                    </button>
                </div>
            </div>
        </li>
    )
}

function EmptyCart({ onClose, categories }: { onClose: () => void; categories: { id: number; name: string; href: string }[] }) {
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="flex flex-col items-center px-6 pb-6 pt-12 text-center">
                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface text-muted" aria-hidden="true">
                    <ShoppingBag className="h-8 w-8" strokeWidth={1.5} />
                </span>
                <p className="type-h3 text-ink">Sepetin boş</p>
                <p className="mt-1.5 max-w-xs text-sm leading-6 text-muted">Şarj aletleri, kablolar ve daha fazlası seni bekliyor.</p>
                <Link href="/products/" prefetch={false} onClick={onClose} className={buttonClasses({ variant: 'brand', size: '48', className: 'mt-5' })}>
                    Alışverişe başla
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                {categories.length > 0 && (
                    <ul className="mt-6 flex flex-wrap justify-center gap-2">
                        {categories.map(c => (
                            <li key={c.id}>
                                <Link
                                    href={c.href}
                                    prefetch={false}
                                    onClick={onClose}
                                    className="inline-flex h-9 items-center rounded-full border border-line px-3.5 text-[13px] font-medium text-ink-2 hover:border-line-strong hover:text-ink"
                                >
                                    {c.name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <CartSuggestions title="Yeni gelenler" />
        </div>
    )
}

/** Hidden while COUPONS_ENABLED is false (the order API does not apply coupons). Logic unchanged. */
function CouponBox({
    coupon,
    items,
    applyCoupon,
    removeCoupon,
}: {
    coupon: { code: string; discountType: 'fixed' | 'percent'; discountValue: number } | null
    items: CartItem[]
    applyCoupon: (code: string, discountType: 'fixed' | 'percent', discountValue: number) => void
    removeCoupon: () => void
}) {
    const [couponCode, setCouponCode] = React.useState('')
    const [verifying, setVerifying] = React.useState(false)
    const [couponError, setCouponError] = React.useState('')

    const handleApplyCoupon = async () => {
        if (!couponCode) return
        setVerifying(true)
        setCouponError('')
        try {
            const subtotal = items.reduce((total, item) => total + (item.price || 0) * item.quantity, 0)
            const res = await fetch('/api/coupons/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: couponCode, cartTotal: subtotal, items: items }),
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

    return (
        <div className="mb-4">
            {coupon ? (
                <div className="flex items-center justify-between rounded-thumb border border-success/20 bg-success-50 px-3 py-2">
                    <span className="text-xs font-bold text-success">
                        {coupon.code} · {coupon.discountType === 'percent' ? `-%${coupon.discountValue}` : `-${coupon.discountValue} TL`}
                    </span>
                    <button type="button" onClick={removeCoupon} aria-label="Kuponu kaldır" className="text-danger">
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <label htmlFor="cart-coupon" className="sr-only">Kupon kodu</label>
                    <input
                        id="cart-coupon"
                        placeholder="Kupon kodu"
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value)}
                        className="h-10 flex-1 rounded-thumb border border-line-strong px-3 text-sm outline-none focus:border-brand-600"
                    />
                    <button type="button" disabled={verifying} onClick={handleApplyCoupon} className={buttonClasses({ variant: 'outline-ink', size: '40' })}>
                        {verifying ? '...' : 'Ekle'}
                    </button>
                </div>
            )}
            {couponError && <p className="mt-1 text-xs text-danger">{couponError}</p>}
        </div>
    )
}
