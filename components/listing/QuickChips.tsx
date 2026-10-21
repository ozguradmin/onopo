'use client'

/**
 * Quick product-type chips (spec §10): one horizontal row of pills derived from the product names
 * (lib/search FACETS). Multi-select, ANDed with the other filters; only chips that would return
 * something (or are selected) are shown. Scrolls sideways on phones, wraps on desktop.
 */
import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FacetCount } from '@/lib/catalog'
import { useListing } from './ListingProvider'
import { FACET_KEYS, facetLabel } from './listing-state'

export function QuickChips({ facets, className }: { facets: FacetCount[]; className?: string }) {
    const { state, update } = useListing()
    const byKey = new Map(facets.map(f => [f.key, f]))
    const chips = FACET_KEYS.map(k => byKey.get(k)).filter((f): f is FacetCount => !!f && (f.count > 0 || state.f.includes(f.key)))
    if (!chips.length) return null

    return (
        <div className={cn('-mx-4 md:-mx-6 lg:mx-0', className)}>
            <ul
                aria-label="Hızlı filtreler"
                className="no-scrollbar flex snap-x gap-2 overflow-x-auto px-4 pb-0.5 md:px-6 lg:flex-wrap lg:overflow-visible lg:px-0"
            >
                {chips.map(f => {
                    const on = state.f.includes(f.key)
                    return (
                        <li key={f.key} className="shrink-0 snap-start">
                            <button
                                type="button"
                                aria-pressed={on}
                                onClick={() => update({ f: on ? state.f.filter(k => k !== f.key) : [...state.f, f.key] }, { scrollToResults: true })}
                                className={cn(
                                    'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors duration-150',
                                    'relative before:absolute before:-inset-y-1 before:inset-x-0 before:content-[""]',
                                    on ? 'border-ink bg-ink text-white' : 'border-line-strong bg-white text-ink-2 hover:border-ink hover:text-ink',
                                )}
                            >
                                {on && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />}
                                {facetLabel(f.key)}
                                {!on && <span className="tabular-nums font-medium text-muted">{f.count}</span>}
                            </button>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

export default QuickChips
