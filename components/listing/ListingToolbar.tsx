'use client'

/**
 * Listing toolbars (spec §10).
 * - Mobile (< lg): a 48px toolbar that sticks under the store header with "Sırala" and "Filtrele (n)";
 *   both open bottom sheets. Filters apply at once; the sheet footer shows the live result count.
 * - Desktop (≥ lg): result count on the left, a labelled sort select on the right.
 */
import * as React from 'react'
import { ArrowUpDown, Check, ChevronDown, Loader2, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PanelData } from '@/lib/listing-data'
import { BottomSheet } from './BottomSheet'
import { FilterPanel } from './FilterPanel'
import { useListing } from './ListingProvider'
import { SORT_OPTIONS, activeFilterCount, sortLabel, type ListingSort } from './listing-state'

function formatCount(n: number): string {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function SortSelect({ className }: { className?: string }) {
    const { state, update } = useListing()
    const id = React.useId()
    return (
        <div className={cn('flex items-center gap-2', className)}>
            <label htmlFor={id} className="text-sm text-muted">
                Sırala
            </label>
            <div className="relative">
                <select
                    id={id}
                    value={state.sort}
                    onChange={e => update({ sort: e.target.value as ListingSort }, { scrollToResults: true })}
                    className="h-10 cursor-pointer appearance-none rounded-thumb border border-line-strong bg-white pl-3 pr-9 text-sm font-semibold text-ink transition-colors hover:border-ink-2 focus:border-brand-600 focus:shadow-focus focus:outline-none"
                >
                    {SORT_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            </div>
        </div>
    )
}

export function DesktopToolbar({ total, label = 'ürün', className }: { total: number; label?: string; className?: string }) {
    const { pending } = useListing()
    return (
        <div className={cn('hidden items-center justify-between gap-4 lg:flex', className)}>
            <p className="flex items-center gap-2 text-sm text-muted">
                <span>
                    <strong className="font-bold tabular-nums text-ink">{formatCount(total)}</strong> {label}
                </span>
                {pending && pending !== 'more' && <Loader2 className="h-4 w-4 animate-spin text-brand-500" aria-hidden="true" />}
            </p>
            <SortSelect />
        </div>
    )
}

export function MobileToolbar({ panel, total, className }: { panel: PanelData; total: number; className?: string }) {
    const { state, update, pending } = useListing()
    const [sheet, setSheet] = React.useState<'sort' | 'filter' | null>(null)
    const filters = activeFilterCount(state)
    const close = React.useCallback(() => setSheet(null), [])
    const busy = pending != null && pending !== 'more'

    return (
        <>
            <div
                className={cn(
                    'sticky top-[var(--listing-top,0px)] z-30 -mx-4 border-b border-line bg-white/95 backdrop-blur-sm md:-mx-6 lg:hidden',
                    className,
                )}
            >
                <div className="grid h-12 grid-cols-2 divide-x divide-line">
                    <button
                        type="button"
                        onClick={() => setSheet('sort')}
                        aria-haspopup="dialog"
                        className="flex min-w-0 items-center justify-center gap-2 px-3 text-sm font-semibold text-ink"
                    >
                        <ArrowUpDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                            Sırala
                            <span className="font-medium text-muted"> · {sortLabel(state.sort)}</span>
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSheet('filter')}
                        aria-haspopup="dialog"
                        className="flex min-w-0 items-center justify-center gap-2 px-3 text-sm font-semibold text-ink"
                    >
                        <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
                        Filtrele
                        {filters > 0 && (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold tabular-nums text-white">
                                <span className="sr-only">, </span>
                                {filters}
                                <span className="sr-only"> filtre seçili</span>
                            </span>
                        )}
                    </button>
                </div>
                {busy && (
                    <div className="absolute inset-x-0 -bottom-px h-0.5 animate-pulse bg-brand-500" aria-hidden="true" />
                )}
            </div>

            <BottomSheet open={sheet === 'sort'} onClose={close} title="Sırala">
                <div role="radiogroup" aria-label="Sıralama" className="flex flex-col pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]">
                    {SORT_OPTIONS.map(o => {
                        const on = state.sort === o.value
                        return (
                            <button
                                key={o.value}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => {
                                    update({ sort: o.value }, { scrollToResults: true })
                                    setSheet(null)
                                }}
                                className={cn(
                                    'flex min-h-[52px] items-center justify-between gap-3 border-b border-line text-left text-[15px] last:border-b-0',
                                    on ? 'font-semibold text-ink' : 'text-ink-2',
                                )}
                            >
                                {o.label}
                                {on && <Check className="h-5 w-5 text-brand-600" aria-hidden="true" />}
                            </button>
                        )
                    })}
                </div>
            </BottomSheet>

            <BottomSheet
                open={sheet === 'filter'}
                onClose={close}
                title="Filtrele"
                footer={
                    <div className="flex gap-3">
                        <button
                            type="button"
                            disabled={filters === 0}
                            onClick={() => update({ f: [], minPrice: null, maxPrice: null, discounted: false, inStock: false })}
                            className="h-12 flex-1 rounded-card border border-line-strong bg-white text-[15px] font-semibold text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Temizle
                        </button>
                        <button
                            type="button"
                            onClick={close}
                            className="inline-flex h-12 flex-[2] items-center justify-center gap-2 rounded-card bg-brand-600 text-[15px] font-semibold text-white transition-colors hover:bg-brand-700"
                        >
                            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            {total > 0 ? `${formatCount(total)} ürünü gör` : 'Sonuç yok'}
                        </button>
                    </div>
                }
            >
                <FilterPanel panel={panel} className="pb-2" />
            </BottomSheet>
        </>
    )
}
