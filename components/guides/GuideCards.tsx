import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, BatteryCharging, Car, ShieldCheck, Smartphone, Tablet, Zap, type LucideIcon } from 'lucide-react'
import { formatGuideDate, guidePath, guideReadingMinutes, type Guide, type GuideImage, type GuideSlug } from '@/lib/guides'
import { cn } from '@/lib/utils'
import { GuideArt, GuideThumb } from './GuideArt'

/** Each guide's product photos (lib/guides/server getGuideImages); a guide without photos shows its icon. */
export type GuideImageMap = Partial<Record<GuideSlug, readonly GuideImage[]>>

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
 * Guide cards (the /rehber/ hub, "Diğer rehberler" under an article): the guide's product photos (or its icon when
 * it has none), title, description, reading time. One stretched link per card (the title), so the photos' alt
 * texts are not part of the link name. Server-friendly. `eagerImages`: how many of the first cards load their
 * photos at once (the rest are lazy).
 */
export function GuideCards({
    guides,
    images,
    eagerImages = 0,
    headingLevel = 'h2',
    className,
}: {
    guides: readonly Guide[]
    images?: GuideImageMap
    eagerImages?: number
    headingLevel?: 'h2' | 'h3'
    className?: string
}) {
    if (!guides.length) return null
    const Heading = headingLevel
    return (
        <ul className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4', className)}>
            {guides.map((g, i) => {
                const Icon = GUIDE_ICONS[g.slug]
                const photos = images?.[g.slug] ?? []
                return (
                    <li
                        key={g.slug}
                        className="group relative flex flex-col rounded-sheet border border-line bg-white p-5 transition-[border-color,box-shadow] duration-150 hover:border-brand-100 hover:shadow-card"
                    >
                        {photos.length > 0 ? (
                            <GuideArt images={photos} variant="card" eager={i < eagerImages} className="-mx-2 -mt-2 mb-4" />
                        ) : (
                            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
                                <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} />
                            </span>
                        )}
                        <Heading className="type-h3 text-ink group-hover:text-brand-700">
                            <Link
                                href={guidePath(g.slug)}
                                prefetch={false}
                                className="outline-none after:absolute after:inset-0 after:rounded-sheet after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-brand-600"
                            >
                                {g.title}
                            </Link>
                        </Heading>
                        <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-muted">{g.description}</p>
                        <span className="mt-auto flex items-center justify-between gap-3 pt-4 text-[13px] text-muted">
                            <span>
                                {guideReadingMinutes(g)} dk okuma · <time dateTime={g.dateModified}>{formatGuideDate(g.dateModified)}</time>
                            </span>
                            <ArrowRight className="h-4 w-4 shrink-0 text-brand-600 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                        </span>
                    </li>
                )
            })}
        </ul>
    )
}

/**
 * Compact links (the /kategoriler/ block, device pages): a product photo of the guide (its icon when it has none)
 * + title, two columns from sm. The photo is decorative here (the title names the link).
 */
export function GuideLinkList({ guides, images, className }: { guides: readonly Guide[]; images?: GuideImageMap; className?: string }) {
    if (!guides.length) return null
    return (
        <ul className={cn('grid gap-2 sm:grid-cols-2 lg:grid-cols-3', className)}>
            {guides.map(g => {
                const Icon = GUIDE_ICONS[g.slug]
                const photo = images?.[g.slug]?.[0]
                return (
                    <li key={g.slug}>
                        <Link
                            href={guidePath(g.slug)}
                            prefetch={false}
                            className="flex min-h-14 items-center gap-3 rounded-card bg-surface px-3 py-2 text-sm font-semibold leading-5 text-ink transition-colors duration-150 hover:bg-brand-50 hover:text-brand-700"
                        >
                            {photo ? (
                                <GuideThumb image={photo} className="h-11 w-11" />
                            ) : (
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 shadow-card" aria-hidden="true">
                                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                                </span>
                            )}
                            {g.title}
                        </Link>
                    </li>
                )
            })}
        </ul>
    )
}
