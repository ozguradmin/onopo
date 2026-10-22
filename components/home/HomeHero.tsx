import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { originalImageUrl, productImageSrcSet, productImageUrl } from '@/lib/images'
import type { HeroSlide } from '@/lib/catalog'
import { normalizeHref, type QuickSearch } from '@/lib/home-data'
import type { HeroCarouselSlide } from './HeroCarousel'

/** Hero slider box height: about 56vw on phones (220–320px), 420px from lg (spec §8.1). */
export const HERO_HEIGHT_CLASS = 'h-[clamp(220px,56vw,320px)] lg:h-[420px]'

export function toCarouselSlides(slides: HeroSlide[]): HeroCarouselSlide[] {
    return slides.map(s => ({
        id: s.id,
        title: s.title,
        subtitle: s.subtitle,
        buttonText: s.button_text || (s.button_link ? 'İncele' : ''),
        href: normalizeHref(s.button_link, '/products/'),
        image: productImageUrl(s.image_url, 1200),
        imageSrcSet: productImageSrcSet(s.image_url, [800, 1200]),
        imageFallback: originalImageUrl(s.image_url),
    }))
}

/** "Cihazına göre" search chips (/products/?q=…): a swipe row on phones, wrapped on desktop. */
export function QuickSearchChips({ items, className, listClassName }: { items: QuickSearch[]; className?: string; listClassName?: string }) {
    if (!items.length) return null
    return (
        <nav aria-label="Cihazına göre ara" className={className}>
            <p className="type-micro text-muted">Cihazına göre</p>
            <ul className={cn('mt-2 flex gap-2', listClassName)}>
                {items.map(item => (
                    <li key={item.href} className="shrink-0">
                        <Link
                            href={item.href}
                            prefetch={false}
                            rel="nofollow"
                            className="inline-flex h-10 items-center rounded-full border border-line-strong bg-white px-4 text-[13px] font-semibold text-ink transition-colors duration-150 hover:border-ink lg:h-8 lg:px-3"
                        >
                            {item.label}
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    )
}

/**
 * "Onopo Store hakkında" near the bottom of the page: the page's one visible H1 (what the store sells,
 * from the product types it really has) and the intro sentence built from store data. The top of the
 * page belongs to the campaign slider and the products, so the H1 lives here (docs/SEO.md §H1).
 */
export function HomeAbout({ h1, text, className }: { h1: string; text: string; className?: string }) {
    return (
        <section aria-labelledby="home-title" className={cn('container-store', className)}>
            <div className="border-t border-line pt-6 lg:pt-8">
                <p className="type-micro text-muted">Onopo Store hakkında</p>
                <h1 id="home-title" className="type-h3 mt-1 text-ink text-balance">
                    {h1}
                </h1>
                {text && <p className="mt-2 max-w-3xl text-sm leading-6 text-muted lg:text-[15px]">{text}</p>}
            </div>
        </section>
    )
}
