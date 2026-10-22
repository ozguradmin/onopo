import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, BatteryCharging, Car, ShieldCheck, Smartphone, Tablet, Zap, type LucideIcon } from 'lucide-react'
import { formatGuideDate, guidePath, guideReadingMinutes, type Guide, type GuideSlug } from '@/lib/guides'
import { cn } from '@/lib/utils'

const GUIDE_ICONS: Record<GuideSlug, LucideIcon> = {
    'iphone-sarj-aleti-ve-kablo-secimi': Smartphone,
    'hizli-sarj-nedir-pd-watt-amper': Zap,
    'ekran-koruyucu-secimi-9d-12d-seramik': ShieldCheck,
    'tablet-ekran-koruyucu-model-kodu-bulma': Tablet,
    'arac-sarj-cihazi-nasil-secilir': Car,
    'powerbank-secimi-mah-ve-cikis-gucu': BatteryCharging,
}

export function guideIcon(slug: GuideSlug): LucideIcon {
    return GUIDE_ICONS[slug]
}

/**
 * Guide cards (the /rehber/ hub, "Diğer rehberler" under an article): icon, title, description, reading time.
 * One link per card. Server-friendly.
 */
export function GuideCards({
    guides,
    headingLevel = 'h2',
    className,
}: {
    guides: readonly Guide[]
    headingLevel?: 'h2' | 'h3'
    className?: string
}) {
    if (!guides.length) return null
    const Heading = headingLevel
    return (
        <ul className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4', className)}>
            {guides.map(g => {
                const Icon = GUIDE_ICONS[g.slug]
                return (
                    <li key={g.slug} className="flex">
                        <Link
                            href={guidePath(g.slug)}
                            prefetch={false}
                            className="group flex w-full flex-col rounded-sheet border border-line bg-white p-5 transition-[border-color,box-shadow] duration-150 hover:border-brand-100 hover:shadow-card"
                        >
                            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
                                <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} />
                            </span>
                            <Heading className="type-h3 mt-4 text-ink group-hover:text-brand-700">{g.title}</Heading>
                            <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-muted">{g.description}</p>
                            <span className="mt-auto flex items-center justify-between gap-3 pt-4 text-[13px] text-muted">
                                <span>
                                    {guideReadingMinutes(g)} dk okuma · <time dateTime={g.dateModified}>{formatGuideDate(g.dateModified)}</time>
                                </span>
                                <ArrowRight className="h-4 w-4 shrink-0 text-brand-600 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                            </span>
                        </Link>
                    </li>
                )
            })}
        </ul>
    )
}

/** Compact links (the /kategoriler/ block): icon + title, two columns from sm. */
export function GuideLinkList({ guides, className }: { guides: readonly Guide[]; className?: string }) {
    if (!guides.length) return null
    return (
        <ul className={cn('grid gap-2 sm:grid-cols-2 lg:grid-cols-3', className)}>
            {guides.map(g => {
                const Icon = GUIDE_ICONS[g.slug]
                return (
                    <li key={g.slug}>
                        <Link
                            href={guidePath(g.slug)}
                            prefetch={false}
                            className="flex min-h-14 items-center gap-3 rounded-card bg-surface px-3 py-2 text-sm font-semibold leading-5 text-ink transition-colors duration-150 hover:bg-brand-50 hover:text-brand-700"
                        >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 shadow-card" aria-hidden="true">
                                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                            </span>
                            {g.title}
                        </Link>
                    </li>
                )
            })}
        </ul>
    )
}
