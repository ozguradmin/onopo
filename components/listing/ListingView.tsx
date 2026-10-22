/**
 * The listing page body shared by /products/, /products/?q=… and /kategori/<slug>/ (Server Component).
 *
 *   surface band: breadcrumb · H1 · real-data intro · in-page search · quick type chips
 *   mobile:       sticky "Sırala | Filtrele" toolbar → bottom sheets
 *   desktop:      sticky filter sidebar (256px) · count + sort toolbar · grid (3 → 4 columns)
 *   grid:         server-rendered cards (sold-out ones last, after a divider) · "Daha fazla göster" · ?page=N links
 *   empty:        spelling suggestion, popular searches, categories, WhatsApp, newest products
 *
 * Interactive parts are small client islands sharing one ListingProvider (URL state).
 */
import * as React from 'react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { ArrowRight, Lightbulb, MessageCircle, PackageX, SearchX, Sparkles } from 'lucide-react'
import { Breadcrumb, type BreadcrumbItem } from '@/components/ui/Breadcrumb'
import { ProductCard } from '@/components/product/ProductCard'
import type { ListingData } from '@/lib/listing-data'
import { formatNumberTR } from '@/lib/format'
import { cn } from '@/lib/utils'
import { categoryPath } from '@/lib/seo'
import { ActiveFilters } from './ActiveFilters'
import { FilterPanel } from './FilterPanel'
import { ListingIntro } from './ListingIntro'
import { ListingProvider } from './ListingProvider'
import { ListingSearchBox } from './ListingSearchBox'
import { DesktopToolbar, MobileToolbar } from './ListingToolbar'
import { QuickChips } from './QuickChips'
import { ResultsGrid, type GridItem } from './ResultsGrid'
import { activeFilterCount, listingHref } from './listing-state'

/** Card image slots in the listing grid (2 cols < md, 3 cols < xl, 4 cols with the sidebar at xl). */
const LISTING_CARD_SIZES = '(max-width: 767px) 46vw, (max-width: 1023px) 31vw, (max-width: 1279px) 28vw, 220px'

export interface ListingViewProps {
    data: ListingData
    h1: React.ReactNode
    /** Real-data sentence(s) under the H1. */
    intro?: React.ReactNode
    breadcrumb: BreadcrumbItem[]
    searchPlaceholder: string
    searchLabel: string
    /** Optional notice above the results (e.g. an unknown ?category=). */
    notice?: React.ReactNode
    /**
     * The store header's search covers this listing (/products/, ?q=): phones skip the in-page search
     * box and the query chip (the H1 names the query). Category pages keep both: their box searches
     * inside the category and their H1 is the category name.
     */
    searchInHeader?: boolean
}

function SoldOutDivider({ count }: { count: number }) {
    return (
        <div className="flex items-center gap-3 pt-2 lg:pt-4">
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
            <h2 className="type-micro shrink-0 text-muted">Şu an stokta olmayanlar · {formatNumberTR(count, 0)}</h2>
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </div>
    )
}

function whatsappHref(number: string, text: string): string | null {
    let digits = number.replace(/\D/g, '')
    if (!digits) return null
    if (digits.startsWith('0')) digits = `90${digits.slice(1)}`
    else if (digits.length === 10) digits = `90${digits}`
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

function EmptyResults({ data }: { data: ListingData }) {
    const { state, allCategories, suggestion, popularSearches, fallbackProducts, settings, shipping, ratings, basePath } = data
    const q = state.q.trim()
    const filters = activeFilterCount(state)
    const clearHref = listingHref(basePath, { ...state, f: [], minPrice: null, maxPrice: null, discounted: false, inStock: false, page: 1 })
    const wa = settings.whatsapp_number ? whatsappHref(settings.whatsapp_number, q ? `Merhaba, "${q}" arıyorum. Yardımcı olabilir misiniz?` : 'Merhaba, bir ürün arıyorum.') : null

    return (
        <div className="rounded-sheet border border-line bg-white px-4 py-10 text-center sm:px-8 lg:py-14">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-muted" aria-hidden="true">
                {q ? <SearchX className="h-7 w-7" /> : <PackageX className="h-7 w-7" />}
            </div>
            <p className="type-h3 mt-4 text-ink">
                {q && filters === 0 ? <>“{q}” için sonuç bulunamadı</> : 'Bu filtrelerle ürün bulunamadı'}
            </p>

            {suggestion && (
                <p className="mt-2 text-[15px] text-ink-2">
                    Bunu mu demek istediniz:{' '}
                    <Link href={listingHref(basePath, { ...state, q: suggestion.q, page: 1 })} prefetch={false} className="font-semibold text-brand-600 underline underline-offset-4 hover:text-brand-700">
                        {suggestion.q}
                    </Link>{' '}
                    <span className="text-muted">({formatNumberTR(suggestion.count, 0)} ürün)</span>
                </p>
            )}

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                {filters > 0
                    ? 'Seçtiğiniz filtrelerden birkaçını kaldırarak daha fazla ürün görebilirsiniz.'
                    : 'Yazımı kontrol edin ya da daha genel bir kelimeyle arayın: örneğin “kablo”, “adaptör” veya telefon modeliniz.'}
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                {filters > 0 && (
                    <Link href={clearHref} prefetch={false} rel="nofollow" className="inline-flex h-11 items-center rounded-card bg-brand-600 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-700">
                        Filtreleri temizle
                    </Link>
                )}
                {q && (
                    <Link href="/products/" prefetch={false} className="inline-flex h-11 items-center rounded-card border border-line-strong bg-white px-5 text-[15px] font-semibold text-ink transition-colors hover:border-ink">
                        Tüm ürünlere göz at
                    </Link>
                )}
                {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-card border border-line-strong bg-white px-5 text-[15px] font-semibold text-whatsapp transition-colors hover:border-whatsapp">
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        WhatsApp’tan sor
                    </a>
                )}
            </div>

            {popularSearches.length > 0 && (
                <div className="mt-8">
                    <h2 className="type-micro text-muted">Popüler aramalar</h2>
                    <ul className="mt-3 flex flex-wrap justify-center gap-2">
                        {popularSearches.map(s => (
                            <li key={s.q}>
                                <Link
                                    href={`/products/?q=${encodeURIComponent(s.q)}`}
                                    prefetch={false}
                                    rel="nofollow"
                                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-white px-3.5 text-[13px] font-semibold text-ink-2 transition-colors hover:border-ink hover:text-ink"
                                >
                                    {s.label}
                                    <span className="font-medium tabular-nums text-muted">{s.count}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {allCategories.length > 0 && (
                <div className="mt-6">
                    <h2 className="type-micro text-muted">Kategoriler</h2>
                    <ul className="mt-3 flex flex-wrap justify-center gap-2">
                        {allCategories.map(c => (
                            <li key={c.slug}>
                                <Link
                                    href={categoryPath(c.slug)}
                                    prefetch={false}
                                    className="inline-flex h-9 items-center rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-line hover:text-ink"
                                >
                                    {c.name}
                                    <span className="ml-1.5 font-medium tabular-nums text-muted">{c.count}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {fallbackProducts.length > 0 && (
                <div className="mt-10 text-left">
                    <h2 className="type-h3 mb-4 flex items-center justify-center gap-2 text-ink">
                        <Sparkles className="h-5 w-5 text-brand-500" aria-hidden="true" />
                        Yeni gelen ürünler
                    </h2>
                    <ul className="product-grid">
                        {fallbackProducts.map(p => (
                            <li key={p.id}>
                                <ProductCard
                                    product={p}
                                    headingLevel="h3"
                                    sizes={LISTING_CARD_SIZES}
                                    freeShippingThreshold={shipping.freeShippingThreshold}
                                    rating={ratings ? ratings.get(p.id) ?? null : undefined}
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

export async function ListingView({ data, h1, intro, breadcrumb, searchPlaceholder, searchLabel, notice, searchInHeader = false }: ListingViewProps) {
    const { result, state, panel, ratings, shipping, pageSize, basePath } = data
    // Cards fetched by "Daha fazla göster" (client navigation) are below the fold: no eager images there
    const h = await headers()
    const isClientNavigation = h.get('rsc') === '1'

    const start = (result.page - 1) * pageSize
    const soldOut = result.total - result.inStockTotal
    const items: GridItem[] = []
    // Above the fold on a first load: phones show one row of 2 cards (the LCP is one of them, so only
    // those get fetchpriority=high); desktop rows hold up to 4, the other two still load eagerly.
    const aboveFold = !isClientNavigation && result.page === state.page
    result.items.forEach((p, i) => {
        if (!p.in_stock && start + i === result.inStockTotal && result.inStockTotal > 0) {
            items.push({ key: 'divider-sold-out', wide: true, node: <SoldOutDivider count={soldOut} /> })
        }
        items.push({
            key: String(p.id),
            node: (
                <ProductCard
                    product={p}
                    priority={aboveFold && i < 2}
                    eager={aboveFold && i < 4}
                    headingLevel="h2"
                    sizes={LISTING_CARD_SIZES}
                    freeShippingThreshold={shipping.freeShippingThreshold}
                    rating={ratings ? ratings.get(p.id) ?? null : undefined}
                />
            ),
        })
    })

    const countLabel = state.q.trim() ? 'sonuç' : 'ürün'

    return (
        <ListingProvider basePath={basePath} state={state}>
            {/* Review stats failed to load: the stars are hidden, so this render must not be edge-cached */}
            {ratings === null && <div hidden data-onopo-nocache="" />}
            <div className="border-b border-line bg-surface">
                <div className="container-store pb-5 pt-4 lg:pb-7 lg:pt-6">
                    <Breadcrumb items={breadcrumb} />
                    <div className="mt-3 flex flex-col gap-4 lg:mt-4 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
                        <div className="min-w-0">
                            <h1 className="type-h1 break-words text-ink">{h1}</h1>
                            {/* Without an intro sentence (search results) this line is only the count, which the desktop
                                toolbar shows next to the sort: one count per screen, so desktop hides this one */}
                            <ListingIntro expandable={!!intro} className={cn('mt-1.5 max-w-3xl text-sm leading-6 text-muted lg:text-[15px]', !intro && 'lg:hidden')}>
                                <span className="font-semibold tabular-nums text-ink-2">
                                    {formatNumberTR(result.total, 0)} {countLabel}
                                </span>
                                {intro ? <> · {intro}</> : null}
                            </ListingIntro>
                        </div>
                        <ListingSearchBox
                            placeholder={searchPlaceholder}
                            label={searchLabel}
                            className={cn('w-full shrink-0 lg:block lg:w-[380px]', searchInHeader && 'hidden')}
                        />
                    </div>
                    <QuickChips facets={panel.facets} className="mt-4 lg:hidden" />
                </div>
            </div>

            <div className="container-store pb-12 lg:pb-16">
                <MobileToolbar panel={panel} total={result.total} />

                <div className="pt-4 lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8 lg:pt-8 xl:grid-cols-[256px_minmax(0,1fr)] xl:gap-10">
                    <aside aria-label="Filtreler" className="hidden lg:block">
                        <div className="sticky top-[calc(var(--header-offset,122px)+16px)] max-h-[calc(100vh-var(--header-offset,122px)-32px)] overflow-y-auto overscroll-contain pr-2 transition-[top,max-height] duration-200 ease-out [scrollbar-width:thin]">
                            <FilterPanel panel={panel} />
                        </div>
                    </aside>

                    <div className="min-w-0">
                        <DesktopToolbar total={result.total} label={countLabel} className="mb-4" />
                        {notice}
                        <ActiveFilters className="mb-4" queryInH1={searchInHeader} />
                        {data.facetHint && (
                            <Link
                                href={data.facetHint.href}
                                prefetch={false}
                                rel="nofollow"
                                className="group mb-4 flex items-center gap-3 rounded-card border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-ink-2 transition-colors hover:border-brand-500"
                            >
                                <Lightbulb className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                                <span className="min-w-0 flex-1">
                                    <strong className="font-semibold text-ink">{data.facetHint.label}</strong> filtresinde{' '}
                                    <span className="tabular-nums">{formatNumberTR(data.facetHint.count, 0)}</span> ürün var.
                                </span>
                                <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-brand-600 group-hover:text-brand-700">
                                    Tümünü gör
                                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                </span>
                            </Link>
                        )}
                        {result.total > 0 ? (
                            <ResultsGrid items={items} page={result.page} totalPages={result.totalPages} total={result.total} pageSize={pageSize} />
                        ) : (
                            <EmptyResults data={data} />
                        )}
                    </div>
                </div>
            </div>
        </ListingProvider>
    )
}

export default ListingView
