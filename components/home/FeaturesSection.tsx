import * as React from 'react'
import { cn } from '@/lib/utils'
import { homeIcon } from './icons'

export interface FeatureItem {
    icon?: string
    title?: string
    description?: string
}

interface FeaturesSectionProps {
    id?: string
    title?: string
    /** Admin › Ana Sayfa › Özellikler `config.items` ({ icon, title, description }), as saved. */
    features?: unknown
    className?: string
}

function cleanItems(raw: unknown): Required<FeatureItem>[] {
    if (!Array.isArray(raw)) return []
    return raw
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map(x => ({
            icon: String(x.icon ?? '').trim(),
            title: String(x.title ?? '').trim(),
            description: String(x.description ?? '').trim(),
        }))
        .filter(x => x.title || x.description)
}

/**
 * "Neden Onopo?" USP block (Admin › Ana Sayfa "Özellikler"): the admin's own items and texts, with
 * inline lucide icons (no icon font). Server Component. Renders nothing when the admin left no item
 * (no invented claims).
 */
export function FeaturesSection({ id = 'home-features', title, features, className }: FeaturesSectionProps) {
    const items = cleanItems(features)
    if (!items.length) return null
    const headingId = `${id}-title`
    return (
        <section aria-labelledby={title ? headingId : undefined} aria-label={title ? undefined : 'Neden Onopo'} className={cn('bg-surface py-8 lg:py-12', className)}>
            <div className="container-store">
                {title && (
                    <h2 id={headingId} className="type-h2 mb-4 text-ink lg:mb-6">
                        {title}
                    </h2>
                )}
                <ul className={cn('grid grid-cols-2 gap-3 md:gap-4 lg:gap-6', items.length >= 4 ? 'lg:grid-cols-4' : items.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>
                    {items.map((item, i) => {
                        const Icon = homeIcon(item.icon)
                        return (
                            <li
                                key={`${item.title}-${i}`}
                                className={cn(
                                    'flex flex-col gap-3 rounded-card bg-white p-4 lg:flex-row lg:items-start lg:gap-4 lg:p-5',
                                    items.length % 2 === 1 && i === items.length - 1 && 'col-span-2 lg:col-span-1',
                                )}
                            >
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 lg:h-12 lg:w-12">
                                    <Icon className="h-5 w-5 lg:h-6 lg:w-6" strokeWidth={1.75} aria-hidden="true" />
                                </span>
                                <span className="min-w-0">
                                    {item.title && <h3 className="text-sm leading-5 font-semibold text-ink lg:text-[15px] lg:leading-6">{item.title}</h3>}
                                    {item.description && <p className="mt-1 text-[13px] leading-5 text-muted">{item.description}</p>}
                                </span>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </section>
    )
}

export default FeaturesSection
