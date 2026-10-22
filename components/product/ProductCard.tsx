import * as React from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Price } from '@/components/ui/Price'
import { FavoriteButton, QuickAddButton } from '@/components/product/ProductCardActions'
import { ProductCardImages } from '@/components/product/ProductCardImages'
import { brandOf, specChips, splitDisplayName } from '@/lib/search'
import { discountPercent, displayPrice, MIN_DISCOUNT_BADGE_PERCENT } from '@/lib/format'
import { PRODUCT_CARD_SIZES } from '@/lib/images'

/**
 * Anything product-shaped: a catalogue `Product` (lib/catalog), an /api/products row (images as a JSON
 * string, free_shipping as 0/1) or the /api/products?index=1 payload all work.
 */
export interface ProductCardProduct {
    id: number
    name: string
    slug: string
    /** RAW price (display rounding happens here; the cart gets the raw value). */
    price: number
    original_price?: number | null
    stock?: number | null
    images?: string[] | string | null
    image?: string | null
    category?: string | null
    product_code?: string | null
    free_shipping?: boolean | number | null
}

/** Real review statistics of a product (lib/reviews getReviewStatsMap). */
export interface ProductCardRating {
    average: number
    count: number
}

export interface ProductCardProps {
    product: ProductCardProduct
    /**
     * Star row (owner decision 2026-10-22). Pass `stats.get(id) ?? null` from getReviewStatsMap():
     *   { average, count } with count > 0 → the real average and count
     *   null (no reviews)               → 5 filled stars, "5,0" and "(0)"
     *   undefined (not passed)          → no star row (the caller does not know the reviews)
     */
    rating?: ProductCardRating | null
    /** Likely LCP: eager load + fetchpriority=high (first 2 cards of a listing or a rail). */
    priority?: boolean
    /** Probably above the fold but not the LCP: eager load at the browser's normal priority. */
    eager?: boolean
    /**
     * Free-shipping threshold (TL) for the "Kargo bedava" line. Server parents pass
     * (await getShippingSettings()).freeShippingThreshold; client parents useShippingSettings().
     * Without it only products flagged free_shipping show the line.
     */
    freeShippingThreshold?: number | null
    /** <img sizes>; default fits the 2/3/4-column product grid. */
    sizes?: string
    /** Title element (h3 in sections under an h2, h2 in a listing under the page h1). */
    headingLevel?: 'h2' | 'h3'
    /** Desktop "Sepete Ekle" button (default true). The mobile quick-add icon is always shown. */
    showAddButton?: boolean
    /**
     * Compact card for the home page rows: a 5:4 image, then name, stars and price only (no eyebrow,
     * compatibility line, spec chips or free-shipping line), and the round quick-add icon on every
     * screen size instead of the desktop button. About 30% shorter, so two rows fit the first screen.
     */
    compact?: boolean
    className?: string
}

function imagesOf(p: ProductCardProduct): string[] {
    if (Array.isArray(p.images)) return p.images.filter(Boolean)
    if (typeof p.images === 'string' && p.images) {
        try {
            const parsed = JSON.parse(p.images)
            if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string' && !!x)
        } catch {
            /* ignore */
        }
    }
    return p.image ? [p.image] : []
}

/**
 * The single product card (design spec §9). Server-friendly: it has no hooks itself; the quick-add,
 * favourite and image-fallback parts are small client islands. Works inside Server and Client
 * Components.
 *
 * Layout: 1:1 white image well (object-contain, 8% padding), badges top-left (sold out / discount),
 * heart top-right, mobile quick-add bottom-right; eyebrow "ONOPO · <code>", 2-line title (brand word
 * stripped; a generic leading "… Uyumlu" phrase moves to a muted line under it, see splitDisplayName;
 * full name in alt/title/aria-label), up to 2 spec chips, price + strikethrough, free-shipping line,
 * desktop "Sepete Ekle". One stretched link (/<slug>/) covers the card; buttons sit above it.
 */
export function ProductCard({
    product,
    priority = false,
    eager = false,
    freeShippingThreshold = null,
    sizes = PRODUCT_CARD_SIZES,
    headingLevel = 'h3',
    showAddButton = true,
    compact = false,
    rating,
    className,
}: ProductCardProps) {
    const images = imagesOf(product)
    const main = images[0] ?? null
    const second = images[1] ?? null
    const soldOut = product.stock != null && Number(product.stock) <= 0
    const shown = displayPrice(product.price)
    const original = product.original_price != null && product.original_price > 0 ? displayPrice(product.original_price) : null
    const pct = original != null ? discountPercent(shown, original) : 0
    const freeShipping = !!product.free_shipping || (freeShippingThreshold != null && freeShippingThreshold > 0 && shown >= freeShippingThreshold)
    const brand = brandOf(product.name)
    const eyebrow = [brand, product.product_code ? product.product_code.toUpperCase() : null].filter(Boolean).join(' · ')
    const chips = specChips(product.name)
    const { title, compat } = splitDisplayName(product.name)
    const href = `/${product.slug}/`
    const Heading = headingLevel

    const cartProduct = {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        images,
        category: product.category ?? null,
        free_shipping: product.free_shipping ?? false,
        stock: product.stock ?? null,
    }

    return (
        <article
            className={cn(
                'group relative flex h-full flex-col rounded-card border border-line bg-white transition-[border-color,box-shadow] duration-150 ease-out',
                'lg:hover:border-line-strong lg:hover:shadow-raised',
                className,
            )}
        >
            {/* Image well */}
            <div className={cn('relative overflow-hidden rounded-t-card bg-white', compact ? 'aspect-[5/4]' : 'aspect-square')}>
                <ProductCardImages main={main} second={second} alt={product.name} sizes={sizes} priority={priority} eager={eager} soldOut={soldOut} />

                {(soldOut || pct >= MIN_DISCOUNT_BADGE_PERCENT) && (
                    <div className="pointer-events-none absolute left-2 top-2 z-[1] flex flex-col items-start gap-1">
                        {soldOut && <Badge variant="soldout">Tükendi</Badge>}
                        {pct >= MIN_DISCOUNT_BADGE_PERCENT && <Badge variant="sale">%{pct}</Badge>}
                    </div>
                )}

                <FavoriteButton productId={product.id} productName={product.name} className="absolute right-2 top-2" />

            </div>

            {/* Body: text on top, price block pinned to the bottom so prices line up across a row */}
            <div className={cn('flex flex-1 flex-col', compact ? 'p-2 lg:p-2.5' : 'p-2.5 lg:p-3')}>
                {compact ? null : eyebrow ? (
                    <p className="type-micro truncate text-muted">{eyebrow}</p>
                ) : (
                    <span className="block h-4" aria-hidden="true" />
                )}

                <Heading className={cn('type-card-title text-ink', !compact && 'mt-1', (compact || !compat) && 'min-h-10')}>
                    <Link
                        href={href}
                        prefetch={false}
                        title={product.name}
                        aria-label={compat ? product.name : undefined}
                        className="line-clamp-2 outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-brand-600"
                    >
                        {compact ? displayTitle(title, compat) : title}
                    </Link>
                </Heading>
                {compat && !compact && (
                    // Part of the link's accessible name already (aria-label = full name)
                    <p data-card-compat="" aria-hidden="true" className="mt-0.5 truncate text-[11px] leading-4 text-muted">
                        {compat}
                    </p>
                )}

                {chips.length > 0 && !compact && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                        {chips.map(c => (
                            <Badge key={c} variant="neutral">{c}</Badge>
                        ))}
                    </div>
                )}

                <div className={cn('mt-auto flex flex-col', compact ? 'gap-1 pt-1.5' : 'gap-1.5 pt-2')}>
                    {rating !== undefined && <RatingStars rating={rating} />}

                    {/* Owner: the round add button sits next to the price, not on the photo */}
                    <div className="flex items-end justify-between gap-2">
                        <Price price={product.price} originalPrice={product.original_price ?? null} size="card" className="min-w-0" />
                        {!soldOut && (
                            <QuickAddButton product={cartProduct} variant="icon" className={cn('shrink-0', !compact && 'lg:hidden')} />
                        )}
                    </div>

                    {freeShipping && !soldOut && !compact && (
                        <p className="flex items-center gap-1 text-xs font-semibold leading-4 text-success">
                            <Check className="h-3.5 w-3.5" aria-hidden="true" /> Kargo bedava
                        </p>
                    )}

                    {showAddButton && !compact && (
                        <div className="hidden pt-1 lg:block">
                            <QuickAddButton product={cartProduct} variant="full" />
                        </div>
                    )}
                </div>
            </div>
        </article>
    )
}

/**
 * Compact cards have no muted compatibility line, so a title that splitDisplayName shortened gets
 * its compatibility phrase back in front ("iPhone 15 uyumlu …"): on a screen protector or a cable
 * the device is the most important word. line-clamp trims the rest.
 */
function displayTitle(title: string, compat: string | null | undefined): string {
    return compat ? `${compat} ${title}` : title
}

/** One star in a 20×20 box, relative commands only (drawn from its top point). */
const STAR = 'l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z'
/** Five stars side by side in one path (viewBox 0 0 100 20), so a row is a single small SVG. */
const FIVE_STARS = [0, 20, 40, 60, 80].map(x => `M${x + 10} 1.5${STAR}`).join('')

function formatRating(n: number): string {
    return n.toFixed(1).replace('.', ',')
}

function StarsSvg({ className, outline = false }: { className: string; outline?: boolean }) {
    return (
        <svg viewBox="0 0 100 20" className={className} aria-hidden="true" fill={outline ? 'none' : 'currentColor'} stroke={outline ? 'currentColor' : undefined} strokeWidth={outline ? 1.4 : undefined}>
            <path d={FIVE_STARS} />
        </svg>
    )
}

/**
 * Subtle 5-star row: real average and count when the product has reviews, otherwise 5 filled stars
 * with "5,0" and "(0)" (owner decision 2026-10-22). Server-friendly; the product page can reuse it
 * (size="md"). Never feeds JSON-LD: aggregateRating comes only from real reviews (lib/reviews).
 */
export function RatingStars({ rating, size = 'sm', className }: { rating: ProductCardRating | null; size?: 'sm' | 'md'; className?: string }) {
    const real = rating != null && rating.count > 0
    const average = real ? Math.min(5, Math.max(0, rating!.average)) : 5
    const count = real ? rating!.count : 0
    const pct = Math.round((average / 5) * 1000) / 10
    const box = size === 'md' ? 'h-4 w-20' : 'h-3 w-[60px]'
    const label = real ? `5 üzerinden ${formatRating(average)} puan, ${count} değerlendirme` : 'Henüz değerlendirme yok'
    return (
        <p className={cn('flex items-center gap-1.5 leading-4', size === 'md' ? 'text-sm' : 'text-xs', className)}>
            <span role="img" aria-label={label} className={cn('relative inline-block shrink-0', box)}>
                {pct < 100 && <StarsSvg outline className="absolute inset-0 h-full w-full text-line-strong" />}
                <span className="absolute inset-y-0 left-0 overflow-hidden text-warning" style={pct < 100 ? { width: `${pct}%` } : { width: '100%' }}>
                    <StarsSvg className={cn('h-full', size === 'md' ? 'w-20' : 'w-[60px]')} />
                </span>
            </span>
            <span className="font-semibold tabular-nums text-ink-2" aria-hidden="true">{formatRating(average)}</span>
            <span className="tabular-nums text-muted" aria-hidden="true">({count})</span>
        </p>
    )
}

export default ProductCard
