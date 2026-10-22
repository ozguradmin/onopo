'use client'

/**
 * Active filter chips with a remove button each, plus "Tümünü temizle" (spec §10).
 * `queryInH1`: the page H1 already shows the search query ("Arama: “şarj”"), so there is no query chip
 * (the header and in-page search fields hold the query and change or clear it).
 */
import * as React from 'react'
import { X } from 'lucide-react'
import { useListing } from './ListingProvider'
import { activeFilterCount, facetLabel, priceLabel, type ListingState } from './listing-state'

interface Chip {
    key: string
    label: string
    remove: Partial<ListingState>
    /** Accessible name of the remove button. */
    action?: string
}

export function ActiveFilters({ className, queryInH1 = false }: { className?: string; queryInH1?: boolean }) {
    const { state, update } = useListing()
    const chips: Chip[] = []
    if (state.q.trim() && !queryInH1) chips.push({ key: 'q', label: `“${state.q.trim()}”`, remove: { q: '' }, action: `Aramayı kaldır: ${state.q.trim()}` })
    for (const k of state.f) chips.push({ key: `f-${k}`, label: facetLabel(k), remove: { f: state.f.filter(x => x !== k) } })
    if (state.minPrice != null || state.maxPrice != null) {
        chips.push({ key: 'price', label: priceLabel(state.minPrice, state.maxPrice), remove: { minPrice: null, maxPrice: null } })
    }
    if (state.discounted) chips.push({ key: 'discounted', label: 'İndirimli', remove: { discounted: false } })
    if (state.inStock) chips.push({ key: 'inStock', label: 'Stoktakiler', remove: { inStock: false } })
    if (!chips.length) return null

    const filters = activeFilterCount(state)

    return (
        <div className={className}>
            <ul aria-label="Uygulanan filtreler" className="flex flex-wrap items-center gap-2">
                {chips.map(c => (
                    <li key={c.key}>
                        <button
                            type="button"
                            onClick={() => update(c.remove, { scrollToResults: true })}
                            aria-label={c.action ?? `Filtreyi kaldır: ${c.label}`}
                            className="relative inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 pl-3 pr-2 before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] text-[13px] font-semibold text-ink-2 transition-colors hover:bg-line hover:text-ink"
                        >
                            {c.label}
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                    </li>
                ))}
                {filters > 0 && (
                    <li>
                        <button
                            type="button"
                            onClick={() => update({ f: [], minPrice: null, maxPrice: null, discounted: false, inStock: false }, { scrollToResults: true })}
                            className="relative inline-flex h-8 items-center rounded-full px-2 text-[13px] before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] font-semibold text-brand-600 underline-offset-4 hover:text-brand-700 hover:underline"
                        >
                            Filtreleri temizle
                        </button>
                    </li>
                )}
            </ul>
        </div>
    )
}

export default ActiveFilters
