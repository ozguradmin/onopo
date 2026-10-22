import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, BatteryCharging, Cable, PlugZap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { originalImageUrl, productImageSrcSet, productImageUrl } from '@/lib/images'
import type { HeroSlide } from '@/lib/catalog'
import { dativeSuffixTr, formatAmount, normalizeHref, type QuickSearch, type Shortcut, type StoreStats } from '@/lib/home-data'
import { isNoindexListingHref } from '@/components/layout/nav-data'
import { HeroCarousel, type HeroCarouselSlide } from './HeroCarousel'
import { ShortcutTiles } from './ShortcutTiles'

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

/**
 * Top of the home page, before the first products: the page H1 as one compact line in small type (it
 * says what the store sells without costing a screen) and the compact category row.
 */
export function HomeIntro({ h1, shortcuts }: { h1: string; shortcuts: Shortcut[] }) {
    return (
        <div className="container-store pt-3 md:pt-4 lg:pt-3">
            <h1 id="home-title" className="text-[13px] leading-[18px] font-semibold text-ink-2 text-balance lg:text-sm lg:leading-5">
                {h1}
            </h1>
            <ShortcutTiles items={shortcuts} className="mt-2.5" />
        </div>
    )
}

/**
 * Slim promo banner under the first product row (when the admin slider does not take that place):
 * built from real catalogue facts (largest discount, else lowest price), no stock photo. The whole
 * banner is one link. At most about 96px tall on phones and 112px on desktop. Server-rendered, no JS.
 */
export function PromoBanner({ stats, className }: { stats: StoreStats | null; className?: string }) {
    const discount = stats && stats.maxDiscount >= 10 ? stats.maxDiscount : 0
    const title = discount
        ? `Seçili ürünlerde %${discount}'${dativeSuffixTr(discount)} varan indirim`
        : stats?.minPrice
            ? `Şarj aletleri ve kablolar ${formatAmount(stats.minPrice)}'den başlayan fiyatlarla`
            : 'Hızlı şarj, sağlam kablo, net ekran'
    const href = discount ? '/products/?sort=discount' : '/products/'
    const cta = discount ? 'İndirimleri gör' : 'Ürünleri keşfet'
    return (
        <div className={cn('container-store', className)}>
            <Link
                href={href}
                prefetch={false}
                // ?sort= is a noindex listing variant: nofollow, like the toolbar sort links (docs/SEO.md §3)
                rel={isNoindexListingHref(href) ? 'nofollow' : undefined}
                className="group relative flex min-h-[88px] items-center gap-4 overflow-hidden rounded-sheet bg-ink px-4 py-4 text-white sm:px-6 lg:min-h-[112px] lg:gap-6 lg:px-10 lg:py-5"
            >
                <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,rgb(0_144_200/.55),transparent_60%)]" />
                <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-16 hidden items-end gap-4 text-white/10 sm:flex lg:right-56 lg:gap-6">
                    <PlugZap className="h-20 w-20 lg:h-24 lg:w-24" strokeWidth={1.25} />
                    <Cable className="h-16 w-16 lg:h-20 lg:w-20" strokeWidth={1.25} />
                    <BatteryCharging className="hidden h-14 w-14 lg:block lg:h-16 lg:w-16" strokeWidth={1.25} />
                </span>
                <span className="relative min-w-0 flex-1">
                    <span className="type-micro block text-brand-100">{discount ? 'Fırsatlar' : 'Onopo Store'}</span>
                    <span className="mt-1 block text-[17px] leading-[22px] font-extrabold tracking-[-0.01em] text-balance sm:text-xl sm:leading-7 lg:text-[26px] lg:leading-8">
                        {title}
                    </span>
                </span>
                {/* Phones: an arrow button (the banner itself is the link); larger screens: the label too */}
                <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-card bg-white text-sm font-semibold text-ink transition-colors duration-150 group-hover:bg-surface sm:w-auto sm:px-4 lg:h-12 lg:px-5 lg:text-[15px]">
                    <span className="hidden sm:inline">{cta}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
            </Link>
        </div>
    )
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

/** "Onopo Store hakkında": the intro sentence built from store data, near the bottom of the page. */
export function HomeAbout({ text, className }: { text: string; className?: string }) {
    if (!text) return null
    return (
        <section aria-labelledby="home-about-title" className={cn('container-store', className)}>
            <div className="border-t border-line pt-6 lg:pt-8">
                <h2 id="home-about-title" className="type-h3 text-ink">
                    Onopo Store hakkında
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted lg:text-[15px]">{text}</p>
            </div>
        </section>
    )
}
