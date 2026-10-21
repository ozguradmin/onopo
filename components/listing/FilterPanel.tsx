'use client'

/**
 * Filter groups (spec §10): category, price, product type / compatibility / power facets, discount and
 * stock toggles. Used in the desktop sidebar and inside the mobile "Filtrele" sheet. Every change is
 * applied at once (one client navigation); counts come from the server for the current results.
 */
import * as React from 'react'
import Link from 'next/link'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PanelData } from '@/lib/listing-data'
import { useListing } from './ListingProvider'
import { FACET_GROUPS, PRICE_PRESETS, facetLabel } from './listing-state'

function formatCount(n: number): string {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function Group({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
    return (
        <details open={defaultOpen} className="group/f border-b border-line py-1 last:border-b-0">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-thumb py-2 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {title}
                <ChevronDown className="h-4 w-4 text-muted transition-transform duration-200 group-open/f:rotate-180" aria-hidden="true" />
            </summary>
            <div className="pb-3">{children}</div>
        </details>
    )
}

function CheckRow({ checked, label, count, onChange, disabled = false }: { checked: boolean; label: string; count?: number; onChange: (next: boolean) => void; disabled?: boolean }) {
    return (
        <label
            className={cn(
                'group/row flex min-h-11 cursor-pointer items-center gap-3 rounded-thumb px-1 text-sm text-ink-2 lg:min-h-9',
                disabled && !checked ? 'cursor-not-allowed opacity-50' : 'hover:text-ink',
            )}
        >
            <input
                type="checkbox"
                className="peer sr-only"
                checked={checked}
                disabled={disabled && !checked}
                onChange={e => onChange(e.target.checked)}
            />
            <span
                aria-hidden="true"
                className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-chip border transition-colors duration-150',
                    'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600',
                    checked ? 'border-ink bg-ink text-white' : 'border-line-strong bg-white group-hover/row:border-ink-2',
                )}
            >
                {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
            <span className={cn('min-w-0 flex-1', checked && 'font-semibold text-ink')}>{label}</span>
            {count != null && <span className="tabular-nums text-xs text-muted">{formatCount(count)}</span>}
        </label>
    )
}

function PriceFilter({ range }: { range: PanelData['priceRange'] }) {
    const { state, update } = useListing()
    const [min, setMin] = React.useState(state.minPrice != null ? String(state.minPrice) : '')
    const [max, setMax] = React.useState(state.maxPrice != null ? String(state.maxPrice) : '')
    const minId = React.useId()
    const maxId = React.useId()

    React.useEffect(() => {
        setMin(state.minPrice != null ? String(state.minPrice) : '')
        setMax(state.maxPrice != null ? String(state.maxPrice) : '')
    }, [state.minPrice, state.maxPrice])

    const parse = (s: string): number | null => {
        const n = parseFloat(s.replace(',', '.'))
        return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
    }

    const apply = (e: React.FormEvent) => {
        e.preventDefault()
        let lo = parse(min)
        let hi = parse(max)
        if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo]
        update({ minPrice: lo, maxPrice: hi }, { scrollToResults: true })
    }

    return (
        <div className="space-y-3">
            <div role="group" aria-label="Hazır fiyat aralıkları" className="flex flex-col">
                {PRICE_PRESETS.map(p => {
                    const active = state.minPrice === p.min && state.maxPrice === p.max
                    return (
                        <button
                            key={p.label}
                            type="button"
                            aria-pressed={active}
                            onClick={() => update(active ? { minPrice: null, maxPrice: null } : { minPrice: p.min, maxPrice: p.max }, { scrollToResults: true })}
                            className="group/row flex min-h-11 items-center gap-3 rounded-thumb px-1 text-left text-sm text-ink-2 hover:text-ink lg:min-h-9"
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
                                    active ? 'border-ink' : 'border-line-strong group-hover/row:border-ink-2',
                                )}
                            >
                                {active && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
                            </span>
                            <span className={cn(active && 'font-semibold text-ink')}>{p.label}</span>
                        </button>
                    )
                })}
            </div>
            <form onSubmit={apply} className="flex items-end gap-2" noValidate>
                <div className="min-w-0 flex-1">
                    <label htmlFor={minId} className="mb-1 block text-xs font-semibold text-muted">
                        En az (₺)
                    </label>
                    <input
                        id={minId}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={min}
                        onChange={e => setMin(e.target.value.replace(/[^\d.,]/g, ''))}
                        placeholder={range ? String(Math.floor(range.min)) : '0'}
                        className="h-11 w-full rounded-thumb border border-line-strong bg-white px-3 text-sm tabular-nums text-ink placeholder:text-subtle focus:border-brand-600 focus:shadow-focus focus:outline-none lg:h-10"
                    />
                </div>
                <span className="pb-3 text-muted lg:pb-2.5" aria-hidden="true">–</span>
                <div className="min-w-0 flex-1">
                    <label htmlFor={maxId} className="mb-1 block text-xs font-semibold text-muted">
                        En çok (₺)
                    </label>
                    <input
                        id={maxId}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={max}
                        onChange={e => setMax(e.target.value.replace(/[^\d.,]/g, ''))}
                        placeholder={range ? String(Math.ceil(range.max)) : ''}
                        className="h-11 w-full rounded-thumb border border-line-strong bg-white px-3 text-sm tabular-nums text-ink placeholder:text-subtle focus:border-brand-600 focus:shadow-focus focus:outline-none lg:h-10"
                    />
                </div>
                <button
                    type="submit"
                    className="h-11 shrink-0 rounded-thumb bg-ink px-3.5 text-sm font-semibold text-white transition-colors hover:bg-ink-2 lg:h-10"
                >
                    Uygula
                </button>
            </form>
        </div>
    )
}

export function FilterPanel({ panel, className, idPrefix }: { panel: PanelData; className?: string; idPrefix?: string }) {
    const { state, update } = useListing()
    const facets = new Map(panel.facets.map(f => [f.key, f]))
    const hasQuery = state.q.trim() !== '' || state.f.length > 0 || state.minPrice != null || state.maxPrice != null || state.discounted || state.inStock || state.sort !== 'recommended'
    const noCategory = !panel.categories.some(c => c.active)

    const toggleFacet = (key: string, on: boolean) => {
        const next = on ? [...state.f, key] : state.f.filter(k => k !== key)
        update({ f: next }, { scrollToResults: true })
    }

    return (
        <div className={className} id={idPrefix}>
            {panel.categories.length > 0 && (
                <Group title="Kategori">
                    <ul className="flex flex-col">
                        <li>
                            <Link
                                href={panel.allHref}
                                prefetch={false}
                                rel={hasQuery ? 'nofollow' : undefined}
                                aria-current={noCategory ? 'page' : undefined}
                                className={cn(
                                    'flex min-h-11 items-center justify-between gap-3 rounded-thumb px-1 text-sm lg:min-h-9',
                                    noCategory ? 'font-semibold text-ink' : 'text-ink-2 hover:text-ink',
                                )}
                            >
                                <span>Tüm ürünler</span>
                                <span className="tabular-nums text-xs text-muted">{formatCount(panel.allCount)}</span>
                            </Link>
                        </li>
                        {panel.categories.map(c => (
                            <li key={c.slug}>
                                <Link
                                    href={c.href}
                                    prefetch={false}
                                    rel={hasQuery ? 'nofollow' : undefined}
                                    aria-current={c.active ? 'page' : undefined}
                                    className={cn(
                                        'relative flex min-h-11 items-center justify-between gap-3 rounded-thumb px-1 text-sm lg:min-h-9',
                                        c.active ? 'font-semibold text-ink' : 'text-ink-2 hover:text-ink',
                                    )}
                                >
                                    <span className="flex min-w-0 items-center gap-2">
                                        {c.active && <span className="h-4 w-0.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />}
                                        <span className="truncate">{c.name}</span>
                                    </span>
                                    <span className="tabular-nums text-xs text-muted">{formatCount(c.count)}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </Group>
            )}

            <Group title="Fiyat">
                <PriceFilter range={panel.priceRange} />
            </Group>

            {FACET_GROUPS.map(group => {
                const rows = group.keys
                    .map(key => facets.get(key))
                    .filter((f): f is NonNullable<typeof f> => !!f && (f.count > 0 || f.selected))
                if (!rows.length) return null
                return (
                    <Group key={group.id} title={group.title}>
                        {rows.map(f => (
                            <CheckRow
                                key={f.key}
                                checked={state.f.includes(f.key)}
                                label={facetLabel(f.key)}
                                count={f.count}
                                onChange={on => toggleFacet(f.key, on)}
                            />
                        ))}
                    </Group>
                )
            })}

            <Group title="Fırsat ve stok">
                <CheckRow
                    checked={state.discounted}
                    label="İndirimli ürünler"
                    count={panel.discountedCount}
                    disabled={panel.discountedCount === 0}
                    onChange={on => update({ discounted: on }, { scrollToResults: true })}
                />
                <CheckRow
                    checked={state.inStock}
                    label="Sadece stoktakiler"
                    count={panel.inStockCount}
                    disabled={panel.inStockCount === 0}
                    onChange={on => update({ inStock: on }, { scrollToResults: true })}
                />
            </Group>
        </div>
    )
}

export default FilterPanel
