import * as React from 'react'
import { cn } from '@/lib/utils'
import type { HeroSlide, Product } from '@/lib/catalog'
import type { HomeSectionView, Shortcut } from '@/lib/home-data'
import { ProductRail } from './ProductRail'
import { FeaturesSection } from './FeaturesSection'
import { ImageCardSection } from './ImageCardSection'
import { CustomCodeSection } from './CustomCodeSection'
import { CategoriesGrid } from './ShortcutTiles'
import { HeroCarousel } from './HeroCarousel'
import { HERO_HEIGHT_CLASS, toCarouselSlides } from './HomeHero'

/** Vertical rhythm between home blocks: 32px on phones, 56px on desktop (spec §6). */
export const SECTION_GAP = 'mt-8 lg:mt-14'

export interface HomeSectionsProps {
    sections: HomeSectionView[]
    /** Hero slides for a 'hero' section placed below other sections (see app/page.tsx). */
    slides: HeroSlide[]
    /** Real categories with products, for a 'categories' section. */
    categoryShortcuts: Shortcut[]
    freeShippingThreshold: number
    /** Ids of sections already rendered elsewhere (the first product row at the top, the slider in the promo slot). */
    skip?: number[]
}

/** True for an admin product row ("Ürün Bölümü" / "Yeni Ürünler") that has products to show. */
export function isProductSection(section: HomeSectionView): boolean {
    return (section.type === 'products' || section.type === 'new_products') && (section.products?.length ?? 0) > 0
}

/** One admin product row as a rail. `priorityCount`: eager LCP cards, only for the row at the top. */
export function HomeProductSection({
    section,
    freeShippingThreshold,
    priorityCount = 0,
    headerClassName,
    compact = false,
    className,
}: {
    section: HomeSectionView
    freeShippingThreshold: number
    priorityCount?: number
    headerClassName?: string
    compact?: boolean
    className?: string
}) {
    const products: Product[] = section.products ?? []
    if (!products.length) return null
    const cfg = section.config || {}
    return (
        <ProductRail
            id={`home-section-${section.id}`}
            title={section.title || (section.type === 'new_products' ? 'Yeni Ürünler' : 'Ürünler')}
            description={typeof cfg.description === 'string' ? cfg.description.trim() : undefined}
            href={section.href ?? '/products/'}
            products={products}
            freeShippingThreshold={freeShippingThreshold}
            priorityCount={priorityCount}
            headerClassName={headerClassName}
            compact={compact}
            className={className}
        />
    )
}

/**
 * Admin › Ana Sayfa sections in admin order (only active ones reach this list). Every section type
 * the admin can create renders here: products, new_products, features, image_card, custom_code,
 * categories and hero. Unknown types are ignored.
 */
export function HomeSections({ sections, slides, categoryShortcuts, freeShippingThreshold, skip = [] }: HomeSectionsProps) {
    let heroDone = false
    return (
        <>
            {sections.map(section => {
                if (skip.includes(section.id)) return null
                const cfg = section.config || {}
                const key = `section-${section.id}`
                const id = `home-section-${section.id}`

                switch (section.type) {
                    case 'products':
                    case 'new_products':
                        return <HomeProductSection key={key} section={section} freeShippingThreshold={freeShippingThreshold} className={SECTION_GAP} />
                    case 'features':
                        return <FeaturesSection key={key} id={id} title={section.title} features={cfg.items} className={SECTION_GAP} />
                    case 'image_card':
                        return (
                            <ImageCardSection
                                key={key}
                                title={section.title}
                                image_url={typeof cfg.image_url === 'string' ? cfg.image_url : undefined}
                                link_url={typeof cfg.link_url === 'string' ? cfg.link_url : undefined}
                                className={SECTION_GAP}
                            />
                        )
                    case 'custom_code': {
                        const html = typeof cfg.html_content === 'string' ? cfg.html_content : ''
                        if (!html.trim()) return null
                        return <CustomCodeSection key={key} html={html} className={SECTION_GAP} />
                    }
                    case 'categories':
                        return (
                            <CategoriesGrid
                                key={key}
                                id={id}
                                title={section.title || 'Kategoriler'}
                                items={categoryShortcuts}
                                className={SECTION_GAP}
                            />
                        )
                    case 'hero': {
                        // Only one slider per page; the top hero is skipped when this one renders
                        if (heroDone || !slides.length) return null
                        heroDone = true
                        return (
                            <div key={key} className={cn('container-store', SECTION_GAP)}>
                                <div className={HERO_HEIGHT_CLASS}>
                                    <HeroCarousel slides={toCarouselSlides(slides)} priority={false} />
                                </div>
                            </div>
                        )
                    }
                    default:
                        return null
                }
            })}
        </>
    )
}

export default HomeSections
