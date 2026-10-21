import * as React from 'react'
import { cn } from '@/lib/utils'
import type { TrustItem } from '@/lib/home-data'
import { homeIcon } from './icons'

/**
 * Trust badges (spec §15), each backed by data: free-shipping threshold (shipping_settings), secure
 * payment (PayTR when it is the active provider), return window (CMS "Kargo ve İade" page) and the
 * installment count. 2×2 on phones, one row from lg.
 */
export function TrustStrip({ items, className }: { items: TrustItem[]; className?: string }) {
    if (!items.length) return null
    return (
        <section aria-label="Alışveriş güvencesi" className={cn('container-store', className)}>
            <ul
                className={cn(
                    'grid overflow-hidden rounded-card border border-line bg-white',
                    items.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
                    items.length >= 3 && 'lg:grid-cols-4',
                    items.length === 3 && 'lg:grid-cols-3',
                )}
            >
                {items.map((item, i) => {
                    const Icon = homeIcon(item.icon)
                    return (
                        <li
                            key={item.key}
                            className={cn(
                                'flex min-h-14 items-center gap-2.5 px-3 py-2.5 sm:py-3 lg:gap-3 lg:px-4 lg:py-4 xl:px-5',
                                // inner dividers: right edge on the left column, top edge from the 2nd row (phones)
                                i % 2 === 0 && 'border-r border-line',
                                i >= 2 && 'border-t border-line lg:border-t-0',
                                i > 0 && 'lg:border-l lg:border-line',
                                'lg:border-r-0',
                                // an odd last item spans the row on phones
                                items.length % 2 === 1 && i === items.length - 1 && 'col-span-2 border-r-0 lg:col-span-1',
                            )}
                        >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 lg:h-10 lg:w-10">
                                <Icon className="h-[18px] w-[18px] lg:h-5 lg:w-5" strokeWidth={2} aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-[13px] leading-[18px] font-semibold text-ink lg:text-sm lg:leading-5">{item.title}</span>
                                <span className="mt-0.5 hidden text-xs leading-4 text-muted sm:block">{item.description}</span>
                            </span>
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}

export default TrustStrip
