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

/**
 * Entry points under the hero: product types (counts = what the listing shows) and the real
 * categories with products. Swipe row on phones, one row of tiles on wide screens.
 */
export function ShortcutTiles({
    items,
    title = 'Kategoriler',
    id = 'home-shortcuts',
    className,
}: {
    items: Shortcut[]
    title?: string
    id?: string
    className?: string
}) {
    if (!items.length) return null
    const headingId = `${id}-title`
    return (
        <section aria-labelledby={headingId} className={cn('container-store', className)}>
            <RailScroller
                label={title}
                header={<SectionHeader id={headingId} title={title} href="/products/" linkLabel="Tüm ürünler" />}
                listClassName="md:gap-3 lg:gap-4"
                fitsLg={items.length <= 7}
                // xl: flexible tiles, at least 100px wide with 16px gaps in the 1216px container
                fitsXl={items.length * 100 + (items.length - 1) * 16 <= 1216}
            >
                {items.map(item => (
                    <li
                        key={item.key}
                        className="flex w-[92px] shrink-0 snap-start sm:w-[108px] lg:w-[calc((100%-6*16px)/7)] xl:w-auto xl:min-w-[100px] xl:flex-1"
                    >
                        <Tile item={item} />
                    </li>
                ))}
            </RailScroller>
        </section>
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
