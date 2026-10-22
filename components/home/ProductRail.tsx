import * as React from 'react'
import { ProductCard, type ProductCardProduct } from '@/components/product/ProductCard'
import { cn } from '@/lib/utils'
import { getReviewStatsMapSafe } from '@/lib/reviews'
import { RailScroller } from './RailScroller'

/** Card slot widths: ~2.3 cards on a 390px phone, ~3.3 on tablets, 4 at lg, 5 at xl (no peeking on desktop). */
export const RAIL_ITEM_CLASS =
    'flex w-[40vw] max-w-[220px] shrink-0 snap-start sm:w-[29vw] md:w-[calc((100%-3*16px)/3.4)] md:max-w-none lg:w-[calc((100%-3*24px)/4)] xl:w-[calc((100%-4*24px)/5)]'

const RAIL_IMAGE_SIZES = '(max-width: 640px) 40vw, (max-width: 1024px) 30vw, 240px'

/** Compact rows (home): ~2.6 cards on a 390px phone, ~4.4 on tablets, 5 at lg and 6 at xl (16px gaps). */
const COMPACT_ITEM_CLASS =
    'flex w-[36vw] max-w-[180px] shrink-0 snap-start sm:w-[26vw] md:w-[calc((100%-4*16px)/4.4)] md:max-w-none lg:w-[calc((100%-4*16px)/5)] xl:w-[calc((100%-5*16px)/6)]'
const COMPACT_IMAGE_SIZES = '(max-width: 640px) 36vw, (max-width: 1024px) 23vw, 200px'

export interface ProductRailProps {
    id: string
    title: string
    description?: string | null
    href?: string
    linkLabel?: string
    products: ProductCardProduct[]
    freeShippingThreshold?: number | null
    /** Cards that load eagerly with fetchpriority=high (max 2 per rail; 0 below the fold). */
    priorityCount?: number
    /** Extra classes for the section header row (e.g. a tighter bottom margin for the row at the top). */
    headerClassName?: string
    /** Compact cards, more per row (the home page rows at the top). */
    compact?: boolean
    className?: string
}

/**
 * A product row (Admin › Ana Sayfa "Ürün Bölümü" / "Yeni Ürünler"): H2 + description + "Tümünü gör",
 * then a swipeable scroll-snap rail of the one ProductCard. Server Component; only the prev/next
 * buttons are a client island.
 */
export async function ProductRail({
    id,
    title,
    description,
    href,
    linkLabel = 'Tümünü gör',
    products,
    freeShippingThreshold,
    priorityCount = 0,
    headerClassName,
    compact = false,
    className,
}: ProductRailProps) {
    if (!products.length) return null
    // Star row on every card (owner decision); hidden only if the reviews query fails
    const ratings = await getReviewStatsMapSafe()
    const headingId = `${id}-title`
    const eager = Math.min(2, Math.max(0, priorityCount))
    return (
        <section aria-labelledby={headingId} className={cn('container-store', className)}>
            <RailScroller
                label={title}
                fitsLg={products.length <= (compact ? 5 : 4)}
                fitsXl={products.length <= (compact ? 6 : 5)}
                // Compact rows: the description stays off phones, where the first screen is short
                heading={{
                    id: headingId,
                    title,
                    description: description ? compact ? <span className="hidden md:inline">{description}</span> : description : undefined,
                    href,
                    linkLabel,
                    className: headerClassName,
                }}
                listClassName={compact ? 'gap-2.5 md:gap-4 lg:gap-4' : undefined}
            >
                {products.map((p, i) => (
                    <li key={p.id} className={compact ? COMPACT_ITEM_CLASS : RAIL_ITEM_CLASS}>
                        <ProductCard
                            product={p}
                            priority={i < eager}
                            freeShippingThreshold={freeShippingThreshold}
                            rating={ratings ? ratings.get(p.id) ?? null : undefined}
                            sizes={compact ? COMPACT_IMAGE_SIZES : RAIL_IMAGE_SIZES}
                            headingLevel="h3"
                            compact={compact}
                            className="w-full"
                        />
                    </li>
                ))}
            </RailScroller>
        </section>
    )
}

export default ProductRail
