import * as React from 'react'
import { ProductCard, type ProductCardProduct } from '@/components/product/ProductCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { RailScroller } from './RailScroller'
import { RAIL_ITEM_CLASS } from './ProductRail'

interface ProductShowcaseProps {
    title?: string
    description?: string
    products?: ProductCardProduct[]
    /** Category NAME for the "Tümünü gör" link (legacy prop). */
    category?: string
    href?: string
    freeShippingThreshold?: number | null
}

/**
 * Legacy API kept for app/product/[id]/ProductClient.tsx ("Benzer Ürünler"). It is now the same
 * swipe rail as the home rows (the one ProductCard, prev/next buttons, no auto-scroll, no fetching).
 * New code should use ProductRail. Works inside Server and Client Components.
 */
export default function ProductShowcase({ title = 'Benzer Ürünler', description, products = [], category, href, freeShippingThreshold = null }: ProductShowcaseProps) {
    if (!products.length) return null
    const target = href ?? (category ? `/products/?category=${encodeURIComponent(category)}` : '/products/')
    return (
        <section className="container-store py-8 lg:py-12" aria-label={title}>
            <RailScroller label={title} header={<SectionHeader title={title} description={description} href={target} />}>
                {products.map(p => (
                    <li key={p.id} className={RAIL_ITEM_CLASS}>
                        <ProductCard
                            product={p}
                            freeShippingThreshold={freeShippingThreshold}
                            sizes="(max-width: 640px) 40vw, (max-width: 1024px) 30vw, 240px"
                            className="w-full"
                        />
                    </li>
                ))}
            </RailScroller>
        </section>
    )
}

export { ProductShowcase }
