'use client'

/**
 * Product cards in the chat (SPEC §10.7): a carousel for 2–4 products, a horizontal card for one. Every
 * price, image and link comes from the server's CardProduct (read from D1 for this turn); the model only
 * picked the ids. Prices go through <Price> like everywhere on the site (raw price in, .99 display out).
 *
 * "Sepete Ekle" adds with the store's own payload (toCartItem → addItem): no toast and no drawer, the button
 * itself confirms ("✓ Eklendi", then "✓ Sepette · +1") and the cart strip above the composer updates.
 * Products with options never get added blind: they offer "Seçenekleri gör" (the product page). Sold-out
 * products cannot be added and offer WhatsApp instead.
 */
import * as React from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Price } from '@/components/ui/Price'
import { Badge } from '@/components/ui/badge'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { buttonClasses } from '@/components/ui/button'
import { RatingStars } from '@/components/product/ProductCard'
import { toCartItem } from '@/components/product/ProductCardActions'
import { discountPercent, displayPrice, MIN_DISCOUNT_BADGE_PERCENT } from '@/lib/format'
import { originalImageUrl, productImageUrl } from '@/lib/images'
import { useCartStore } from '@/store/cart-store'
import type { AssistantEvent, CardProduct } from '@/lib/assistant/contract'
import { useAssistantUi } from '../useAssistantChat'

type ProductsEvent = Extract<AssistantEvent, { t: 'products' }>

/** Sepete Ekle with its states; "Seçenekleri gör" for products with options; disabled when sold out. */
export function AddButton({ p, size = '44', className }: { p: CardProduct; size?: '40' | '44'; className?: string }) {
    const { chat, onNavigate } = useAssistantUi()
    const inCart = useCartStore(s => s.items.some(i => String(i.id) === String(p.id)))
    const [justAdded, setJustAdded] = React.useState(false)
    const [addedHere, setAddedHere] = React.useState(false)

    React.useEffect(() => {
        if (!justAdded) return
        const t = setTimeout(() => setJustAdded(false), 1500)
        return () => clearTimeout(t)
    }, [justAdded])

    if (p.hasVariations) {
        return (
            <Link
                href={p.href}
                prefetch={false}
                onClick={() => {
                    chat.beacon('card_click', { productId: p.id })
                    onNavigate()
                }}
                className={buttonClasses({ variant: 'brand', size, className: cn('w-full', className) })}
            >
                Seçenekleri gör
            </Link>
        )
    }
    if (!p.inStock) {
        return (
            <button type="button" disabled className={buttonClasses({ variant: 'subtle', size, className: cn('w-full', className) })}>
                Stokta yok
            </button>
        )
    }

    const add = () => {
        useCartStore.getState().addItem(toCartItem({
            id: p.id, name: p.name, slug: p.slug, price: p.price, image: p.image ?? undefined,
            category: p.category ?? undefined, free_shipping: p.freeShipping, stock: p.inStock ? 1 : 0,
        }))
        setJustAdded(true)
        setAddedHere(true)
        chat.noteAddToCart(p.id)
    }
    const label = justAdded ? '✓ Eklendi' : addedHere && inCart ? '✓ Sepette · +1' : 'Sepete Ekle'
    return (
        <button
            type="button"
            onClick={add}
            aria-label={addedHere && inCart && !justAdded ? `${p.name}: bir tane daha sepete ekle` : undefined}
            className={buttonClasses({ variant: 'brand', size, className: cn('w-full', className) })}
        >
            {label}
        </button>
    )
}

function SaleBadge({ p }: { p: CardProduct }) {
    const pct = p.originalPrice != null ? discountPercent(displayPrice(p.price), displayPrice(p.originalPrice)) : 0
    if (pct < MIN_DISCOUNT_BADGE_PERCENT) return null
    return <Badge variant="sale">%{pct}</Badge>
}

function FreeShipping({ p }: { p: CardProduct }) {
    const { freeThreshold } = useAssistantUi()
    if (!p.inStock || !(p.freeShipping || (freeThreshold > 0 && p.displayPrice >= freeThreshold))) return null
    return (
        <p className="flex items-center gap-1 text-[11px] font-semibold leading-4 text-success">
            <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} /> Kargo bedava
        </p>
    )
}

function StaleNote({ state }: { state?: 'price' | 'gone' }) {
    if (state === 'price') return <p className="text-xs text-warning">Fiyat güncellendi</p>
    if (state === 'gone') return <p className="text-xs text-warning">Bu ürün artık satışta değil</p>
    return null
}

function CarouselCard({ p, i, n, stale }: { p: CardProduct; i: number; n: number; stale?: 'price' | 'gone' }) {
    const { chat, onNavigate } = useAssistantUi()
    const titleId = React.useId()
    const follow = () => {
        chat.beacon('card_click', { productId: p.id })
        onNavigate()
    }
    return (
        <div role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${n}: ${p.name}`} className="w-[164px] shrink-0 snap-start md:w-[176px]">
            <article aria-labelledby={titleId} className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-white">
                <Link href={p.href} prefetch={false} onClick={follow} tabIndex={-1} aria-hidden="true" className="relative block aspect-square bg-white">
                    <FallbackImage
                        src={productImageUrl(p.image, 200)}
                        fallbackSrc={originalImageUrl(p.image)}
                        alt=""
                        width={176}
                        height={176}
                        loading={i < 2 ? 'eager' : 'lazy'}
                        className={cn('h-full w-full object-contain p-[8%]', !p.inStock && 'opacity-50')}
                    />
                    <span className="pointer-events-none absolute left-2 top-2"><SaleBadge p={p} /></span>
                    {p.isBestSeller && (
                        <span className="pointer-events-none absolute right-2 top-2 rounded-chip bg-brand-50 px-1.5 py-0.5 text-[11px] font-bold text-brand-700">Çok satan</span>
                    )}
                </Link>
                <div className="flex flex-1 flex-col gap-1 p-2.5">
                    <Link id={titleId} href={p.href} prefetch={false} onClick={follow} title={p.name} className="line-clamp-2 text-[13px] font-semibold leading-[18px] text-ink hover:text-brand-700">
                        {p.name}
                    </Link>
                    <RatingStars rating={p.rating} size="sm" />
                    <div className="mt-auto flex flex-col gap-1 pt-1">
                        <Price price={p.price} originalPrice={p.originalPrice} size="card" />
                        <FreeShipping p={p} />
                        <StaleNote state={stale} />
                        <AddButton p={p} size="40" className="mt-1" />
                        {!p.inStock && <SoldOutWhatsapp p={p} />}
                    </div>
                </div>
            </article>
        </div>
    )
}

/** Sold out: "WhatsApp'tan sor" inserts a local WhatsApp card asking when it is back. */
function SoldOutWhatsapp({ p, asButton = false }: { p: CardProduct; asButton?: boolean }) {
    const { chat } = useAssistantUi()
    if (!chat.waBase) return null
    const onClick = () => chat.insertWhatsapp('product_request', { product: p, summary: `${p.name} tekrar stoğa girecek mi?` })
    if (asButton) {
        return (
            <button type="button" onClick={onClick} className={buttonClasses({ variant: 'whatsapp', size: '44' })}>
                WhatsApp&apos;tan sor
            </button>
        )
    }
    return (
        <button type="button" onClick={onClick} className="min-h-9 text-[13px] font-semibold text-whatsapp hover:underline">
            WhatsApp&apos;tan sor
        </button>
    )
}

function SingleCard({ p, stale }: { p: CardProduct; stale?: 'price' | 'gone' }) {
    const { chat, onNavigate } = useAssistantUi()
    const titleId = React.useId()
    const follow = () => {
        chat.beacon('card_click', { productId: p.id })
        onNavigate()
    }
    return (
        <article aria-labelledby={titleId} className="rounded-card border border-line bg-white p-3">
            <div className="flex gap-3">
                <Link href={p.href} prefetch={false} onClick={follow} tabIndex={-1} aria-hidden="true" className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-thumb border border-line bg-white">
                    <FallbackImage
                        src={productImageUrl(p.image, 200)}
                        fallbackSrc={originalImageUrl(p.image)}
                        alt=""
                        width={88}
                        height={88}
                        className={cn('h-full w-full object-contain p-[8%]', !p.inStock && 'opacity-50')}
                    />
                    <span className="pointer-events-none absolute left-1 top-1"><SaleBadge p={p} /></span>
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link id={titleId} href={p.href} prefetch={false} onClick={follow} title={p.name} className="line-clamp-2 text-[14px] font-semibold leading-5 text-ink hover:text-brand-700">
                        {p.name}
                    </Link>
                    <RatingStars rating={p.rating} size="sm" />
                    <Price price={p.price} originalPrice={p.originalPrice} size="card" />
                    <FreeShipping p={p} />
                    <StaleNote state={stale} />
                </div>
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <AddButton p={p} />
                {p.inStock ? (
                    <Link href={p.href} prefetch={false} onClick={follow} className={buttonClasses({ variant: 'outline-ink', size: '44' })}>
                        İncele
                    </Link>
                ) : (
                    <SoldOutWhatsapp p={p} asButton />
                )}
            </div>
            {p.whatsappOrder && p.inStock && chat.waBase && (
                <button
                    type="button"
                    onClick={() => chat.insertWhatsapp('whatsapp_order', { product: p, summary: '' })}
                    className="mt-2 min-h-9 text-[13px] font-semibold text-whatsapp hover:underline"
                >
                    WhatsApp ile sipariş
                </button>
            )}
        </article>
    )
}

export function ProductCards({ card, stale }: { card: ProductsEvent; stale?: Record<number, 'price' | 'gone'> }) {
    const { onNavigate } = useAssistantUi()
    if (card.products.length === 0) return null
    if (card.products.length === 1) return <SingleCard p={card.products[0]} stale={stale?.[card.products[0].id]} />
    const n = card.products.length
    return (
        <div
            role="region"
            aria-roledescription="carousel"
            aria-label="Önerilen ürünler"
            className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1"
        >
            {card.products.map((p, i) => (
                <CarouselCard key={p.id} p={p} i={i} n={n} stale={stale?.[p.id]} />
            ))}
            {card.moreHref && (
                <Link
                    href={card.moreHref}
                    prefetch={false}
                    onClick={onNavigate}
                    className="flex w-[120px] shrink-0 snap-start items-center justify-center rounded-card border border-line bg-surface p-3 text-center text-sm font-semibold text-brand-600 hover:text-brand-700"
                >
                    Tümünü gör{card.total != null ? ` (${card.total})` : ''}
                </Link>
            )}
        </div>
    )
}
