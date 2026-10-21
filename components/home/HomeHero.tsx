import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, BatteryCharging, Cable, PlugZap } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { originalImageUrl, productImageSrcSet, productImageUrl } from '@/lib/images'
import type { HeroSlide } from '@/lib/catalog'
import { dativeSuffixTr, formatAmount, normalizeHref, type HomeIntroCopy, type QuickSearch, type StoreStats } from '@/lib/home-data'
import { HeroCarousel, type HeroCarouselSlide } from './HeroCarousel'

/** Hero box height: about 56vw on phones (220–320px), 420px from lg (spec §8.1). */
export const HERO_HEIGHT_CLASS = 'h-[clamp(220px,56vw,320px)] lg:h-[420px]'
/** Top hero next to the intro panel: at least 420px, as tall as the panel when its text needs more. */
const TOP_HERO_HEIGHT_CLASS = 'h-[clamp(220px,56vw,320px)] lg:h-auto lg:min-h-[420px]'

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
 * Banner shown when there is no active hero slide: built from real catalogue facts (largest
 * discount, lowest price, free-shipping threshold), no stock photo. Server-rendered, no JS.
 */
export function HeroFallback({ stats, freeShippingThreshold, className }: { stats: StoreStats | null; freeShippingThreshold: number; className?: string }) {
    const discount = stats && stats.maxDiscount >= 10 ? stats.maxDiscount : 0
    const title = discount
        ? `Seçili ürünlerde %${discount}'${dativeSuffixTr(discount)} varan indirim`
        : stats?.minPrice
            ? `Şarj aletleri ve kablolar ${formatAmount(stats.minPrice)}'den başlayan fiyatlarla`
            : 'Hızlı şarj, sağlam kablo, net ekran'
    const facts = [
        stats?.productCount ? `${stats.productCount} ürün` : null,
        freeShippingThreshold > 0 ? `${formatAmount(freeShippingThreshold)} üzeri kargo bedava` : null,
    ].filter(Boolean)
    return (
        <div className={cn('relative h-full overflow-hidden rounded-sheet bg-ink text-white', className)}>
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,rgb(0_144_200/.55),transparent_60%)]" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-6 bottom-0 flex items-end gap-2 text-white/10 lg:right-6 lg:gap-6">
                <PlugZap className="h-28 w-28 lg:h-52 lg:w-52" strokeWidth={1.25} />
                <Cable className="hidden h-24 w-24 sm:block lg:h-44 lg:w-44" strokeWidth={1.25} />
                <BatteryCharging className="h-20 w-20 lg:h-36 lg:w-36" strokeWidth={1.25} />
            </div>
            <div className="relative flex h-full max-w-[560px] flex-col justify-end p-4 pb-5 sm:p-6 lg:justify-center lg:p-10">
                <p className="type-micro text-brand-100">Onopo Store</p>
                <p className="mt-1.5 text-[22px] leading-7 font-extrabold tracking-[-0.02em] text-balance sm:text-[28px] sm:leading-[34px] lg:mt-3 lg:text-[40px] lg:leading-[48px]">
                    {title}
                </p>
                {facts.length > 0 && <p className="mt-2 hidden text-[15px] leading-6 text-white/80 sm:block">{facts.join(' · ')}</p>}
                <div className="mt-3 lg:mt-6">
                    <Link
                        href={discount ? '/products/?sort=discount' : '/products/'}
                        prefetch={false}
                        className="inline-flex h-11 items-center gap-2 rounded-card bg-white px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-surface lg:h-12 lg:px-5 lg:text-[15px]"
                    >
                        {discount ? 'İndirimleri gör' : 'Ürünleri keşfet'}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </div>
            </div>
        </div>
    )
}

/** "Cihazına göre" search chips (/products/?q=…). */
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

export interface HomeHeroProps {
    slides: HeroSlide[]
    intro: HomeIntroCopy
    stats: StoreStats | null
    quickSearches: QuickSearch[]
    freeShippingThreshold: number
    featuredCategory: { label: string; href: string } | null
}

/**
 * First viewport: the hero banner (admin slides, or the data-built fallback) and, next to it on
 * desktop / under it on phones, the page H1 with real store facts and entry links.
 */
export function HomeHero({ slides, intro, stats, quickSearches, freeShippingThreshold, featuredCategory }: HomeHeroProps) {
    const carousel = toCarouselSlides(slides)
    return (
        <section aria-labelledby="home-title" className="container-store pt-3 md:pt-4 lg:pt-6">
            <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
                <div className={cn('lg:col-span-7 xl:col-span-8', TOP_HERO_HEIGHT_CLASS)}>
                    {carousel.length > 0 ? (
                        <HeroCarousel slides={carousel} />
                    ) : (
                        <HeroFallback stats={stats} freeShippingThreshold={freeShippingThreshold} />
                    )}
                </div>

                <div className="flex flex-col lg:col-span-5 lg:min-h-[420px] lg:rounded-sheet lg:border lg:border-line lg:bg-surface lg:p-7 xl:col-span-4 xl:p-8">
                    <p className="type-micro hidden text-brand-600 lg:block">Onopo Store</p>
                    <h1
                        id="home-title"
                        className="text-[22px] leading-7 font-extrabold tracking-[-0.01em] text-ink text-balance lg:mt-2 lg:text-[28px] lg:leading-9 xl:text-[30px] xl:leading-[38px]"
                    >
                        {intro.h1}
                    </h1>
                    <p className="mt-1.5 text-sm leading-[22px] text-muted lg:mt-3 lg:text-[15px] lg:leading-6">{intro.lead}</p>
                    <div className="mt-5 hidden flex-wrap gap-2 lg:flex">
                        <Link href="/products/" prefetch={false} className={buttonClasses({ variant: 'brand', size: '44' })}>
                            Tüm ürünler
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                        {featuredCategory && (
                            <Link href={featuredCategory.href} prefetch={false} className={buttonClasses({ variant: 'outline-ink', size: '44' })}>
                                {featuredCategory.label}
                            </Link>
                        )}
                    </div>
                    <QuickSearchChips items={quickSearches} className="mt-auto hidden pt-6 lg:block" listClassName="flex-wrap" />
                </div>
            </div>
        </section>
    )
}

export default HomeHero
