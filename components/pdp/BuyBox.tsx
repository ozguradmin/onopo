'use client'

/**
 * The buying part of the product page (spec §11 items 4–11): price block, installment line with the
 * PayTR table, free-shipping / stock / delivery lines, variations, quantity, "Sepete Ekle" (opens the
 * cart drawer), "Hemen Al" (sets this line to the chosen quantity, then goes to /odeme/), favourite,
 * WhatsApp order, and the mobile sticky buy bar that appears while the main buttons are off screen
 * (its data-hide-bottom-nav attribute hides the mobile bottom nav on this page, see app/globals.css).
 *
 * Cart payload is the one every add-to-cart has always sent ({ id, name, price (RAW), image,
 * category, slug, free_shipping }), with id "<productId>-<variationIds…>" when variations are chosen,
 * which is what app/api/orders parses. "Hemen Al" now uses the same item as "Sepete Ekle" (it used
 * to drop the variation id and the slug).
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Check, CreditCard, Minus, Plus, ShoppingBag, Truck, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getImageUrl } from '@/lib/utils'
import { Price } from '@/components/ui/Price'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { originalImageUrl, productImageUrl } from '@/lib/images'
import { Button, buttonClasses } from '@/components/ui/button'
import { FavoriteButton } from '@/components/product/ProductCardActions'
import InstallmentModal from '@/components/product/InstallmentModal'
import { useCartStore } from '@/store/cart-store'
import { displayPrice, formatTL } from '@/lib/format'

export interface BuyBoxProduct {
    id: number
    name: string
    slug: string
    /** RAW price (the cart and the order API round it). */
    price: number
    original_price: number | null
    stock: number
    /** First stored image reference (/api/images/<key>). */
    image: string | null
    category: string
    free_shipping: boolean
}

export interface BuyBoxVariation {
    id: number
    name: string
    value: string
    price_modifier: number
    stock: number
    image_url: string | null
}

export interface BuyBoxProps {
    product: BuyBoxProduct
    variations: BuyBoxVariation[]
    freeShippingThreshold: number
    maxInstallments: number | null
    /** Admin text (Ürünler › Taksit bilgisi) that replaces the installment line. */
    installmentInfo: string | null
    /** Delivery promise (product delivery_info, else the homepage features text). */
    deliveryText: string | null
    /** wa.me link when WhatsApp ordering is enabled for this product. */
    whatsappHref: string | null
}

const MAX_QTY = 99

function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
    )
}

export function BuyBox({ product, variations, freeShippingThreshold, maxInstallments, installmentInfo, deliveryText, whatsappHref }: BuyBoxProps) {
    const router = useRouter()
    const addItem = useCartStore(s => s.addItem)
    const updateQuantity = useCartStore(s => s.updateQuantity)
    const openCart = useCartStore(s => s.openCart)

    const [selected, setSelected] = React.useState<Record<string, BuyBoxVariation>>({})
    const [quantity, setQuantity] = React.useState(1)
    const [added, setAdded] = React.useState(false)
    const [buying, setBuying] = React.useState(false)
    const [showInstallments, setShowInstallments] = React.useState(false)
    const [ctaVisible, setCtaVisible] = React.useState(true)
    const ctaRef = React.useRef<HTMLDivElement>(null)
    const addedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    React.useEffect(() => () => { if (addedTimer.current) clearTimeout(addedTimer.current) }, [])

    // Variation groups in stored order ("Renk" → [Siyah, Beyaz])
    const groups = React.useMemo(() => {
        const map = new Map<string, BuyBoxVariation[]>()
        for (const v of variations) {
            const list = map.get(v.name) || []
            list.push(v)
            map.set(v.name, list)
        }
        return Array.from(map.entries())
    }, [variations])

    const chosen = Object.values(selected)
    const modifier = chosen.reduce((sum, v) => sum + (v?.price_modifier || 0), 0)
    const finalPrice = product.price + modifier
    const shownPrice = displayPrice(finalPrice)
    const soldOut = product.stock <= 0
    const stockLimit = Math.min(product.stock, ...chosen.map(v => (v.stock > 0 ? v.stock : product.stock)))
    const maxQty = Math.max(1, Math.min(MAX_QTY, stockLimit))
    const qty = Math.min(quantity, maxQty)
    const freeShipping = product.free_shipping || (freeShippingThreshold > 0 && shownPrice >= freeShippingThreshold)
    const remaining = Math.round((freeShippingThreshold - shownPrice) * 100) / 100

    // Sticky bar (phones): visible while the main buttons are out of view
    React.useEffect(() => {
        const el = ctaRef.current
        if (!el || typeof IntersectionObserver === 'undefined') return
        const io = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting), { threshold: 0 })
        io.observe(el)
        return () => io.disconnect()
    }, [])

    const cartItem = () => {
        const variantName = chosen.map(v => v.value).join(' / ')
        // Unique id per variation combination so different variants never merge (parsed by app/api/orders)
        const variationIds = chosen.map(v => v.id).sort().join('-')
        return {
            id: variationIds ? `${product.id}-${variationIds}` : product.id,
            name: variantName ? `${product.name} (${variantName})` : product.name,
            price: finalPrice,
            image: getImageUrl(chosen.find(v => v.image_url)?.image_url || product.image),
            category: product.category,
            slug: product.slug,
            free_shipping: !!product.free_shipping,
        }
    }

    const addToCart = () => {
        const item = cartItem()
        for (let i = 0; i < qty; i++) addItem(item)
    }

    const onAdd = () => {
        if (soldOut) return
        addToCart()
        setAdded(true)
        if (addedTimer.current) clearTimeout(addedTimer.current)
        addedTimer.current = setTimeout(() => setAdded(false), 1500)
        openCart()
    }

    // "Hemen Al" buys exactly the chosen quantity: the line for this product/variation is SET to qty,
    // never added to, so "Sepete Ekle" followed by "Hemen Al" does not double it. addItem() creates the
    // line (or refreshes its name/price/image like every add does), updateQuantity() sets the count.
    // Other cart lines stay as they are.
    const onBuyNow = () => {
        if (soldOut || buying) return
        setBuying(true)
        const item = cartItem()
        addItem(item)
        updateQuantity(item.id, qty)
        router.push('/odeme/')
    }

    return (
        <div className="flex flex-col">
            {/* Price */}
            <Price price={finalPrice} originalPrice={product.original_price} size="lg" showDiscountBadge showSaving={!soldOut} />

            {/* Installments */}
            {!soldOut && (installmentInfo || maxInstallments) && (
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5 text-ink-2">
                    <CreditCard className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <span>{installmentInfo || `Kredi kartına ${maxInstallments} aya varan taksit`}</span>
                    {maxInstallments ? (
                        <button
                            type="button"
                            onClick={() => setShowInstallments(true)}
                            className="-my-2 inline-flex min-h-11 items-center font-semibold text-brand-600 underline decoration-brand-600/30 underline-offset-4 hover:text-brand-700 hover:decoration-brand-700"
                        >
                            Taksit seçenekleri
                        </button>
                    ) : null}
                </div>
            )}

            {/* Stock, shipping, delivery */}
            <ul className="mt-4 flex flex-col gap-2.5 border-t border-line pt-4 text-sm leading-5 lg:mt-3 lg:pt-3 xl:mt-4 xl:pt-4">
                <li className="flex items-center gap-2">
                    {soldOut ? (
                        <>
                            <span className="h-2 w-2 shrink-0 rounded-full bg-danger" aria-hidden="true" />
                            <span className="font-semibold text-danger">Tükendi</span>
                            <span className="text-muted">· Şu an satışta değil</span>
                        </>
                    ) : (
                        <>
                            <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                                <span className="h-2 w-2 rounded-full bg-success" />
                            </span>
                            <span className="font-semibold text-success">Stokta</span>
                        </>
                    )}
                </li>
                {!soldOut && (
                    <li className="flex items-start gap-2">
                        <Truck className={cn('mt-0.5 h-4 w-4 shrink-0', freeShipping ? 'text-success' : 'text-muted')} aria-hidden="true" />
                        {freeShipping ? (
                            <span className="font-semibold text-success">Kargo bedava</span>
                        ) : (
                            <span className="text-ink-2">
                                <span className="font-semibold tabular-nums">{formatTL(remaining)}</span> daha ekle, kargo bedava
                            </span>
                        )}
                    </li>
                )}
                {!soldOut && deliveryText && (
                    <li className="flex items-start gap-2 text-ink-2">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                        <span>{deliveryText}</span>
                    </li>
                )}
            </ul>

            {/* Variations */}
            {groups.length > 0 && (
                <div className="mt-5 flex flex-col gap-4">
                    {groups.map(([groupName, options]) => (
                        <fieldset key={groupName}>
                            <legend className="mb-2 text-sm font-semibold text-ink">
                                {groupName}
                                {selected[groupName] && <span className="ml-1 font-normal text-muted">: {selected[groupName].value}</span>}
                            </legend>
                            <div className="flex flex-wrap gap-2">
                                {options.map(opt => {
                                    const isSelected = selected[groupName]?.id === opt.id
                                    const out = opt.stock <= 0
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            disabled={out}
                                            aria-pressed={isSelected}
                                            onClick={() => setSelected(prev => ({ ...prev, [groupName]: opt }))}
                                            className={cn(
                                                'inline-flex min-h-11 items-center gap-2 rounded-card border px-4 text-sm font-semibold transition-colors duration-150',
                                                isSelected
                                                    ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600'
                                                    : out
                                                        ? 'cursor-not-allowed border-line bg-surface text-subtle line-through'
                                                        : 'border-line-strong bg-white text-ink hover:border-ink',
                                            )}
                                        >
                                            {opt.image_url && (
                                                // 24 px swatch: the 200w variant when variants are on (original otherwise), falls back once to the original
                                                <FallbackImage src={productImageUrl(opt.image_url, 200)} fallbackSrc={originalImageUrl(opt.image_url)} alt="" width={24} height={24} className="h-6 w-6 rounded-chip object-cover" loading="lazy" />
                                            )}
                                            <span>{opt.value}</span>
                                            {opt.price_modifier !== 0 && (
                                                <span className="text-xs font-medium tabular-nums text-muted">
                                                    {opt.price_modifier > 0 ? '+' : '−'}{formatTL(Math.abs(opt.price_modifier))}
                                                </span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </fieldset>
                    ))}
                </div>
            )}

            {/* Actions */}
            <div ref={ctaRef} className="mt-5 flex flex-col gap-2 lg:mt-4 xl:mt-5">
                <div className="flex items-stretch gap-2">
                    {!soldOut && (
                        <div className="flex h-12 shrink-0 items-center rounded-card border border-line-strong bg-white" role="group" aria-label="Adet">
                            <button
                                type="button"
                                onClick={() => setQuantity(q => Math.max(1, Math.min(q, maxQty) - 1))}
                                disabled={qty <= 1}
                                aria-label="Adedi azalt"
                                className="inline-flex h-full w-11 items-center justify-center rounded-l-card text-ink hover:bg-surface disabled:text-subtle disabled:hover:bg-transparent"
                            >
                                <Minus className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <output className="w-8 text-center text-[15px] font-semibold tabular-nums text-ink" aria-live="polite" aria-label={`Adet: ${qty}`}>
                                {qty}
                            </output>
                            <button
                                type="button"
                                onClick={() => setQuantity(q => Math.min(maxQty, Math.min(q, maxQty) + 1))}
                                disabled={qty >= maxQty}
                                aria-label="Adedi artır"
                                className="inline-flex h-full w-11 items-center justify-center rounded-r-card text-ink hover:bg-surface disabled:text-subtle disabled:hover:bg-transparent"
                            >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                    )}
                    <Button
                        type="button"
                        variant="brand"
                        size="48"
                        onClick={onAdd}
                        disabled={soldOut}
                        className={cn('min-w-0 flex-1 px-3', added && 'bg-success hover:bg-success', soldOut && 'bg-surface-2 text-muted disabled:opacity-100')}
                    >
                        {soldOut ? (
                            'Stokta yok'
                        ) : added ? (
                            <>
                                <Check className="h-5 w-5" aria-hidden="true" /> Sepete eklendi
                            </>
                        ) : (
                            <>
                                <ShoppingBag className="h-5 w-5" aria-hidden="true" /> Sepete Ekle
                            </>
                        )}
                    </Button>
                    <FavoriteButton productId={product.id} productName={product.name} variant="plain" className="shrink-0" />
                </div>

                {(!soldOut || whatsappHref) && (
                    // Side by side only when both fit (basis 200px each), else stacked: never overflows
                    <div className="flex flex-wrap gap-2">
                        {!soldOut && (
                            <Button type="button" variant="outline-ink" size="48" onClick={onBuyNow} isLoading={buying} className="min-w-0 shrink flex-[1_1_200px]">
                                Hemen Al
                            </Button>
                        )}
                        {whatsappHref && (
                            <a
                                href={whatsappHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={buttonClasses({ variant: 'whatsapp', size: '48', className: 'min-w-0 shrink flex-[1_1_200px]' })}
                            >
                                <WhatsAppIcon className="h-5 w-5" />
                                {soldOut ? "WhatsApp'tan sor" : 'WhatsApp ile sipariş'}
                            </a>
                        )}
                    </div>
                )}
            </div>

            <InstallmentModal isOpen={showInstallments} onClose={() => setShowInstallments(false)} productPrice={shownPrice} />

            {/* Mobile sticky buy bar, only while the main buttons are off screen. It replaces the bottom nav on
                this page (spec §11): data-hide-bottom-nav makes app/globals.css hide [data-bottom-nav]. */}
            {!soldOut && (
            <div
                data-hide-bottom-nav=""
                className={cn(
                    'fixed inset-x-0 bottom-0 z-[45] border-t border-line bg-white shadow-overlay transition-transform duration-200 ease-sheet md:hidden',
                    ctaVisible ? 'pointer-events-none translate-y-full' : 'translate-y-0',
                )}
                aria-hidden={ctaVisible}
                inert={ctaVisible}
            >
                <div className="flex min-h-16 items-center gap-3 px-4 py-2.5 pb-[calc(10px+env(safe-area-inset-bottom))]">
                    <div className="min-w-0 flex-1">
                        <Price price={finalPrice} originalPrice={product.original_price} size="card" className="gap-x-1.5" />
                        {freeShipping && <p className="text-xs font-semibold leading-4 text-success">Kargo bedava</p>}
                    </div>
                    <Button
                        type="button"
                        variant="brand"
                        size="44"
                        onClick={onAdd}
                        className={cn('shrink-0 px-5', added && 'bg-success hover:bg-success')}
                    >
                        {added ? <><Check className="h-4 w-4" aria-hidden="true" /> Eklendi</> : <><ShoppingBag className="h-4 w-4" aria-hidden="true" /> Sepete Ekle</>}
                    </Button>
                </div>
            </div>
            )}
        </div>
    )
}

export default BuyBox
