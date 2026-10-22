import * as React from 'react'
import Link from 'next/link'
import { ChevronRight, Smartphone, Tablet, type LucideIcon } from 'lucide-react'
import { ProductCard } from '@/components/product/ProductCard'
import type { ProductCardRating } from '@/components/product/ProductCard'
import type { Product } from '@/lib/catalog'
import { devicePath, type DeviceBrandEntry, type DeviceBrandId, type DeviceGroup, type DeviceModelEntry } from '@/lib/devices'
import { cn } from '@/lib/utils'

const TABLET_BRANDS: ReadonlySet<DeviceBrandId> = new Set(['ipad', 'samsung-tablet', 'huawei'])

export function deviceIcon(brand: DeviceBrandId): LucideIcon {
    return TABLET_BRANDS.has(brand) ? Tablet : Smartphone
}

/** Search link for a model without a page of its own (noindex listing, so nofollow). */
function modelSearchHref(label: string): string {
    return `/products/?q=${encodeURIComponent(label)}`
}

const CHIP = 'inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-white px-3.5 text-[13px] font-semibold text-ink transition-colors duration-150 hover:border-ink'

/**
 * Model chips: a model with its own page links there with its product count; a smaller model links to the
 * search (rel=nofollow, no count: the search is wider than the model match).
 */
export function DeviceModelChips({ models, current, className }: { models: readonly DeviceModelEntry[]; current?: string; className?: string }) {
    if (!models.length) return null
    return (
        <ul className={cn('flex flex-wrap gap-2', className)}>
            {models.map(m => (
                <li key={m.slug}>
                    {m.hasPage ? (
                        <Link
                            href={devicePath(m.slug)}
                            prefetch={false}
                            aria-current={m.slug === current ? 'page' : undefined}
                            className={cn(CHIP, m.slug === current && 'border-ink bg-ink text-white hover:border-ink')}
                        >
                            {m.label}
                            <span className={cn('font-medium tabular-nums', m.slug === current ? 'text-white/70' : 'text-muted')}>{m.productIds.length}</span>
                        </Link>
                    ) : (
                        <Link href={modelSearchHref(m.label)} prefetch={false} rel="nofollow" className={cn(CHIP, 'border-line font-medium text-ink-2')}>
                            {m.label}
                        </Link>
                    )}
                </li>
            ))}
        </ul>
    )
}

/**
 * The /cihaz/ hub: one card per brand that has a page (or model pages), with its product count and the model
 * chips. Server-friendly.
 */
export function DeviceBrandCards({ brands, className }: { brands: readonly DeviceBrandEntry[]; className?: string }) {
    const shown = brands.filter(b => b.hasPage || b.models.some(m => m.hasPage))
    if (!shown.length) return null
    return (
        <ul className={cn('grid gap-3 md:grid-cols-2 lg:gap-4', className)}>
            {shown.map(b => {
                const Icon = deviceIcon(b.id)
                return (
                    <li key={b.id} className="flex">
                        <section aria-labelledby={`cihaz-${b.id}`} className="flex w-full flex-col rounded-sheet border border-line bg-white p-5">
                            <div className="flex items-center gap-3">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
                                    <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} />
                                </span>
                                <div className="min-w-0">
                                    <h2 id={`cihaz-${b.id}`} className="type-h3 text-ink">
                                        {b.hasPage ? (
                                            <Link href={devicePath(b.slug)} prefetch={false} className="hover:text-brand-700">
                                                {b.label}
                                            </Link>
                                        ) : b.label}
                                    </h2>
                                    <p className="text-[13px] text-muted">{b.productIds.length} ürün</p>
                                </div>
                            </div>
                            <DeviceModelChips models={b.models} className="mt-4" />
                            {b.hasPage && (
                                <Link
                                    href={devicePath(b.slug)}
                                    prefetch={false}
                                    className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                                >
                                    Tüm {b.label} ürünleri
                                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                </Link>
                            )}
                        </section>
                    </li>
                )
            })}
        </ul>
    )
}

/** Compact brand links (the /kategoriler/ "Cihaza göre" block): icon, brand, product count. */
export function DeviceBrandLinks({ brands, className }: { brands: readonly DeviceBrandEntry[]; className?: string }) {
    const shown = brands.filter(b => b.hasPage)
    if (!shown.length) return null
    return (
        <ul className={cn('grid gap-2 sm:grid-cols-2 lg:grid-cols-3', className)}>
            {shown.map(b => {
                const Icon = deviceIcon(b.id)
                return (
                    <li key={b.id}>
                        <Link
                            href={devicePath(b.slug)}
                            prefetch={false}
                            className="flex min-h-14 items-center gap-3 rounded-card bg-surface px-3 py-2 text-sm font-semibold leading-5 text-ink transition-colors duration-150 hover:bg-brand-50 hover:text-brand-700"
                        >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 shadow-card" aria-hidden="true">
                                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                            </span>
                            <span className="min-w-0 flex-1">{b.label}</span>
                            <span className="font-medium tabular-nums text-muted">{b.productIds.length}</span>
                        </Link>
                    </li>
                )
            })}
        </ul>
    )
}

const CARD_SIZES = '(max-width: 639px) 46vw, (max-width: 1023px) 31vw, (max-width: 1279px) 19vw, 200px'

/**
 * The products of a device page, one section per type (H2 + compact cards), in the order groupDeviceProducts
 * gives (in stock first inside a group). The first two cards of the first group load eagerly.
 */
export function DeviceProductGroups({
    groups,
    ratings,
    freeShippingThreshold,
    className,
}: {
    groups: readonly DeviceGroup<Product>[]
    ratings: Map<number, ProductCardRating> | null
    freeShippingThreshold: number | null
    className?: string
}) {
    return (
        <div className={cn('flex flex-col gap-10 lg:gap-12', className)}>
            {groups.map((g, gi) => (
                <section key={g.group.key} id={`grup-${g.group.key}`} aria-labelledby={`grup-${g.group.key}-baslik`} className="scroll-mt-24">
                    <h2 id={`grup-${g.group.key}-baslik`} className="type-h2 mb-4 text-ink lg:mb-5">
                        {g.group.title}
                        <span className="ml-2 align-middle text-sm font-medium tabular-nums text-muted">{g.products.length}</span>
                    </h2>
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
                        {g.products.map((p, i) => (
                            <li key={p.id} className="flex">
                                <ProductCard
                                    product={p}
                                    compact
                                    priority={gi === 0 && i < 2}
                                    headingLevel="h3"
                                    sizes={CARD_SIZES}
                                    freeShippingThreshold={freeShippingThreshold}
                                    rating={ratings ? ratings.get(p.id) ?? null : undefined}
                                    className="w-full"
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    )
}

/** "Ekran koruyucular 2 · Kablolar 12 …": jump links to the groups (only when there are two or more). */
export function DeviceGroupNav({ groups, className }: { groups: readonly DeviceGroup<unknown>[]; className?: string }) {
    if (groups.length < 2) return null
    return (
        <nav aria-label="Ürün türleri" className={className}>
            <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
                {groups.map(g => (
                    <li key={g.group.key} className="shrink-0">
                        <a href={`#grup-${g.group.key}`} className={cn(CHIP, 'border-line bg-surface font-medium text-ink-2 hover:bg-white')}>
                            {g.group.title}
                            <span className="tabular-nums text-muted">{g.products.length}</span>
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    )
}
