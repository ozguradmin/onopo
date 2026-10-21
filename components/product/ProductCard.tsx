import * as React from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Price } from '@/components/ui/Price'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { FavoriteButton, QuickAddButton } from '@/components/product/ProductCardActions'
import { brandOf, displayName, specChips } from '@/lib/search'
import { discountPercent, displayPrice, MIN_DISCOUNT_BADGE_PERCENT } from '@/lib/format'
import { originalImageUrl, productImageSrcSet, productImageUrl, PRODUCT_CARD_SIZES } from '@/lib/images'

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

export interface ProductCardProps {
    product: ProductCardProduct
    /** Above the fold: eager load + fetchpriority=high (first 4 cards of a listing, first 2 of a row). */
    priority?: boolean
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
 * stripped; full name in alt/title), up to 2 spec chips, price + strikethrough, free-shipping line,
 * desktop "Sepete Ekle". One stretched link (/<slug>/) covers the card; buttons sit above it.
 */
export function ProductCard({
    product,
    priority = false,
    freeShippingThreshold = null,
    sizes = PRODUCT_CARD_SIZES,
    headingLevel = 'h3',
    showAddButton = true,
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
    const title = displayName(product.name)
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
            <div className="relative aspect-square overflow-hidden rounded-t-card bg-white">
                <FallbackImage
                    src={productImageUrl(main, 400)}
                    srcSet={productImageSrcSet(main, [200, 400, 800])}
                    sizes={sizes}
                    fallbackSrc={originalImageUrl(main)}
                    alt={product.name}
                    width={400}
                    height={400}
                    loading={priority ? 'eager' : 'lazy'}
                    fetchPriority={priority ? 'high' : undefined}
                    className={cn(
                        'absolute inset-0 h-full w-full object-contain p-[8%] transition-opacity duration-200',
                        second && 'lg:group-hover:opacity-0',
                        soldOut && 'opacity-50',
                    )}
                />
                {second && (
                    <FallbackImage
                        src={productImageUrl(second, 400)}
                        srcSet={productImageSrcSet(second, [200, 400, 800])}
                        sizes={sizes}
                        fallbackSrc={originalImageUrl(second)}
                        placeholderSrc={null}
                        alt=""
                        aria-hidden="true"
                        width={400}
                        height={400}
                        loading="lazy"
                        className={cn(
                            'absolute inset-0 hidden h-full w-full object-contain p-[8%] opacity-0 transition-opacity duration-200 lg:block lg:group-hover:opacity-100',
                            soldOut && 'lg:group-hover:opacity-50',
                        )}
                    />
                )}

                {(soldOut || pct >= MIN_DISCOUNT_BADGE_PERCENT) && (
                    <div className="pointer-events-none absolute left-2 top-2 z-[1] flex flex-col items-start gap-1">
                        {soldOut && <Badge variant="soldout">Tükendi</Badge>}
                        {pct >= MIN_DISCOUNT_BADGE_PERCENT && <Badge variant="sale">%{pct}</Badge>}
                    </div>
                )}

                <FavoriteButton productId={product.id} productName={product.name} className="absolute right-2 top-2" />

                {!soldOut && (
                    <QuickAddButton product={cartProduct} variant="icon" className="absolute bottom-2 right-2 lg:hidden" />
                )}
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-1.5 p-2.5 lg:p-3">
                {eyebrow && <p className="type-micro truncate text-muted">{eyebrow}</p>}

                <Heading className="type-card-title min-h-10 text-ink">
                    <Link
                        href={href}
                        prefetch={false}
                        title={product.name}
                        className="line-clamp-2 outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-brand-600"
                    >
                        {title}
                    </Link>
                </Heading>

                {chips.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {chips.map(c => (
                            <Badge key={c} variant="neutral">{c}</Badge>
                        ))}
                    </div>
                )}

                <Price price={product.price} originalPrice={product.original_price ?? null} size="card" className="mt-0.5" />

                {freeShipping && !soldOut && (
                    <p className="flex items-center gap-1 text-xs font-semibold leading-4 text-success">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" /> Kargo bedava
                    </p>
                )}

                {showAddButton && (
                    <div className="mt-auto hidden pt-1.5 lg:block">
                        <QuickAddButton product={cartProduct} variant="full" />
                    </div>
                )}
            </div>
        </article>
    )
}

export default ProductCard
