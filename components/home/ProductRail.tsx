import * as React from 'react'
import { ProductCard, type ProductCardProduct } from '@/components/product/ProductCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { cn } from '@/lib/utils'
import { RailScroller } from './RailScroller'

/** Card slot widths: ~2.3 cards on a 390px phone, ~3.3 on tablets, 4 at lg, 5 at xl (no peeking on desktop). */
export const RAIL_ITEM_CLASS =
    'flex w-[40vw] max-w-[220px] shrink-0 snap-start sm:w-[29vw] md:w-[calc((100%-3*16px)/3.4)] md:max-w-none lg:w-[calc((100%-3*24px)/4)] xl:w-[calc((100%-4*24px)/5)]'

const RAIL_IMAGE_SIZES = '(max-width: 640px) 40vw, (max-width: 1024px) 30vw, 240px'

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
    className?: string
}

/**
 * A product row (Admin › Ana Sayfa "Ürün Bölümü" / "Yeni Ürünler"): H2 + description + "Tümünü gör",
 * then a swipeable scroll-snap rail of the one ProductCard. Server Component; only the prev/next
 * buttons are a client island.
 */
export function ProductRail({
    id,
    title,
    description,
    href,
    linkLabel = 'Tümünü gör',
    products,
    freeShippingThreshold,
    priorityCount = 0,
    className,
}: ProductRailProps) {
    if (!products.length) return null
    const headingId = `${id}-title`
    const eager = Math.min(2, Math.max(0, priorityCount))
    return (
        <section aria-labelledby={headingId} className={cn('container-store', className)}>
            <RailScroller
                label={title}
                fitsLg={products.length <= 4}
                fitsXl={products.length <= 5}
                header={<SectionHeader id={headingId} title={title} description={description || undefined} href={href} linkLabel={linkLabel} />}
            >
                {products.map((p, i) => (
                    <li key={p.id} className={RAIL_ITEM_CLASS}>
                        <ProductCard
                            product={p}
                            priority={i < eager}
                            freeShippingThreshold={freeShippingThreshold}
                            sizes={RAIL_IMAGE_SIZES}
                            headingLevel="h3"
                            className="w-full"
                        />
                    </li>
                ))}
            </RailScroller>
        </section>
    )
}

export default ProductRail
