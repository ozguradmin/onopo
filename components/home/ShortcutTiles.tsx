import * as React from 'react'
import Link from 'next/link'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { cn } from '@/lib/utils'
import type { Shortcut } from '@/lib/home-data'
import { homeIcon } from './icons'
import { RailScroller } from './RailScroller'

function Tile({ item }: { item: Shortcut }) {
    const Icon = homeIcon(item.icon)
    return (
        <Link
            href={item.href}
            prefetch={false}
            // Product-type links are listing filter/search URLs (noindex); categories are real pages
            rel={item.kind === 'type' ? 'nofollow' : undefined}
            className="group flex h-full w-full flex-col items-center gap-2 rounded-card border border-transparent bg-surface px-1.5 pb-3 pt-3 text-center transition-colors duration-150 hover:border-brand-100 hover:bg-brand-50 lg:gap-2.5 lg:pt-4"
        >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-600 shadow-card transition-colors duration-150 group-hover:text-brand-700 lg:h-14 lg:w-14">
                <Icon className="h-[22px] w-[22px] lg:h-7 lg:w-7" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="line-clamp-3 text-[13px] leading-[18px] font-semibold text-ink">{item.label}</span>
            <span className="tabular mt-auto text-xs leading-4 text-muted">{item.count} ürün</span>
        </Link>
    )
}

/** Desktop strip tile widths: at least 88px (lg, 4px gaps) / 96px (xl, 12px gaps); wider when they fit. */
const STRIP_MIN_LG = 88
const STRIP_MIN_XL = 96

function StripTile({ item }: { item: Shortcut }) {
    const Icon = homeIcon(item.icon)
    return (
        <Link
            href={item.href}
            prefetch={false}
            // Product-type links are listing filter/search URLs (noindex); categories are real pages
            rel={item.kind === 'type' ? 'nofollow' : undefined}
            className="group flex w-full flex-col items-center gap-1.5 rounded-card text-center lg:px-1 lg:py-1 xl:px-0 lg:transition-colors lg:duration-150 lg:hover:bg-surface"
        >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-colors duration-150 group-hover:bg-brand-100 group-hover:text-brand-700 lg:h-11 lg:w-11 xl:h-12 xl:w-12">
                <Icon className="h-[22px] w-[22px] xl:h-6 xl:w-6" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="line-clamp-2 break-words text-xs leading-[15px] font-semibold text-ink lg:text-[13px] lg:leading-4">{item.label}</span>
        </Link>
    )
}

/**
 * The home page's compact category row, right under the header and before the first products:
 * product types (listing filters) and the real categories with products as small round icons with
 * short labels, no counts (about 80px tall on phones). A swipe row on phones and tablets; one row of
 * equal tiles on desktop, which scrolls with ‹ › over its ends only when the tiles do not fit.
 */
export function ShortcutTiles({ items, label = 'Kategoriler', className }: { items: Shortcut[]; label?: string; className?: string }) {
    if (!items.length) return null
    const n = items.length
    return (
        <nav aria-label={label} className={className}>
            <RailScroller
                label={label}
                listClassName="gap-2 md:gap-3 lg:gap-1 xl:gap-3"
                // Every tile fits at its minimum width in the 960px (lg) / 1216px (xl) container
                fitsLg={n * STRIP_MIN_LG + (n - 1) * 4 <= 960}
                fitsXl={n * STRIP_MIN_XL + (n - 1) * 12 <= 1216}
            >
                {items.map(item => (
                    <li key={item.key} className="flex w-[72px] shrink-0 snap-start md:w-[84px] lg:w-auto lg:min-w-[88px] lg:flex-1 xl:min-w-[96px]">
                        <StripTile item={item} />
                    </li>
                ))}
            </RailScroller>
        </nav>
    )
}

/** Admin "Kategoriler" section: the real categories (with products) as a tile grid. */
export function CategoriesGrid({ items, title, id, className }: { items: Shortcut[]; title: string; id: string; className?: string }) {
    if (!items.length) return null
    const headingId = `${id}-title`
    return (
        <section aria-labelledby={headingId} className={cn('container-store', className)}>
            <SectionHeader id={headingId} title={title} href="/products/" linkLabel="Tüm ürünler" />
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:gap-4 lg:grid-cols-6 lg:gap-6">
                {items.map(item => (
                    <li key={item.key} className="flex">
                        <Tile item={item} />
                    </li>
                ))}
            </ul>
        </section>
    )
}

export default ShortcutTiles
