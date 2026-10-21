/**
 * Listing URL state (isomorphic: Server Components parse it, client controls build the next URL).
 *
 * Every filter of /products/ and /kategori/<slug>/ lives in the URL, so a listing is shareable,
 * crawlable (?page=N) and survives reloads:
 *
 *   q          search text (legacy alias: search)
 *   f          facet keys from lib/search FACETS, comma separated (?f=type-c,kablo), ANDed
 *   minPrice   lower bound on the display price (TL, inclusive)
 *   maxPrice   upper bound on the display price (TL, inclusive)
 *   discounted 1 = only discounted products
 *   inStock    1 = only products in stock
 *   sort       recommended (default, omitted) | newest | price_asc | price_desc | discount
 *   page       1-based page (omitted for 1)
 */
import { FACETS, getFacet, sanitizeFacetKeys } from '@/lib/search'

export type ListingSort = 'recommended' | 'newest' | 'price_asc' | 'price_desc' | 'discount'

export const SORT_OPTIONS: ReadonlyArray<{ value: ListingSort; label: string }> = [
    { value: 'recommended', label: 'Önerilen' },
    { value: 'newest', label: 'En yeni' },
    { value: 'price_asc', label: 'Fiyat artan' },
    { value: 'price_desc', label: 'Fiyat azalan' },
    { value: 'discount', label: 'İndirim oranı' },
]

export function sortLabel(sort: ListingSort): string {
    return SORT_OPTIONS.find(o => o.value === sort)?.label ?? 'Önerilen'
}

export interface ListingState {
    q: string
    f: string[]
    minPrice: number | null
    maxPrice: number | null
    discounted: boolean
    inStock: boolean
    sort: ListingSort
    page: number
}

export const EMPTY_LISTING_STATE: ListingState = {
    q: '',
    f: [],
    minPrice: null,
    maxPrice: null,
    discounted: false,
    inStock: false,
    sort: 'recommended',
    page: 1,
}

/** Price shortcuts (display prices; the catalogue runs from ~80 to ~1.500 TL, median ~130). */
export const PRICE_PRESETS: ReadonlyArray<{ label: string; min: number | null; max: number | null }> = [
    { label: '100 ₺ ve altı', min: null, max: 100 },
    { label: '100 – 150 ₺', min: 100, max: 150 },
    { label: '150 – 300 ₺', min: 150, max: 300 },
    { label: '300 ₺ ve üzeri', min: 300, max: null },
]

/** Facet groups for the filter panel (keys from lib/search FACETS). */
export const FACET_GROUPS: ReadonlyArray<{ id: string; title: string; keys: string[] }> = [
    { id: 'tip', title: 'Ürün tipi', keys: ['sarj-aleti', 'kablo', 'arac', 'powerbank', 'kulaklik', 'ekran-koruyucu'] },
    { id: 'uyum', title: 'Uyumluluk', keys: ['iphone', 'type-c', 'micro-usb'] },
    { id: 'ozellik', title: 'Güç ve özellik', keys: ['20w', 'orgulu'] },
]

/** Display label of a facet key ("type-c" → "Android / Type-C"). */
export function facetLabel(key: string): string {
    return getFacet(key)?.label ?? key
}

/** All facet keys in registry order (for the quick-chip row). */
export const FACET_KEYS: readonly string[] = FACETS.map(f => f.key)

type SearchParamsLike = Record<string, string | string[] | undefined> | URLSearchParams | null | undefined

function all(sp: SearchParamsLike, key: string): string[] {
    if (!sp) return []
    if (typeof (sp as URLSearchParams).getAll === 'function') return (sp as URLSearchParams).getAll(key)
    const v = (sp as Record<string, string | string[] | undefined>)[key]
    return v == null ? [] : Array.isArray(v) ? v : [v]
}

function one(sp: SearchParamsLike, key: string): string {
    return (all(sp, key)[0] ?? '').trim()
}

function parsePrice(raw: string): number | null {
    if (!raw) return null
    const n = parseFloat(raw.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null
    return Math.round(n * 100) / 100
}

function parseFlag(raw: string): boolean {
    return raw === '1' || raw === 'true' || raw === 'on'
}

const SORTS = new Set<ListingSort>(SORT_OPTIONS.map(o => o.value))

/** Parse the listing state from page searchParams or URLSearchParams. Invalid values fall back to defaults. */
export function parseListingState(sp: SearchParamsLike): ListingState {
    const q = (one(sp, 'q') || one(sp, 'search')).replace(/\s+/g, ' ').slice(0, 120)
    let minPrice = parsePrice(one(sp, 'minPrice'))
    let maxPrice = parsePrice(one(sp, 'maxPrice'))
    if (minPrice != null && maxPrice != null && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice]
    const sortRaw = one(sp, 'sort') as ListingSort
    const pageRaw = one(sp, 'page')
    const page = /^\d{1,6}$/.test(pageRaw) ? Math.max(1, parseInt(pageRaw, 10)) : 1
    return {
        q,
        f: sanitizeFacetKeys(all(sp, 'f')),
        minPrice,
        maxPrice,
        discounted: parseFlag(one(sp, 'discounted')),
        inStock: parseFlag(one(sp, 'inStock')),
        sort: SORTS.has(sortRaw) ? sortRaw : 'recommended',
        page,
    }
}

function priceParam(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

/** "?q=…&f=a,b&page=2" (or '' for the plain listing). Params always come in the same order. */
export function listingQueryString(state: ListingState): string {
    const parts: string[] = []
    const enc = (v: string) => encodeURIComponent(v)
    if (state.q.trim()) parts.push(`q=${enc(state.q.trim())}`)
    const f = sanitizeFacetKeys(state.f)
    if (f.length) parts.push(`f=${f.map(enc).join(',')}`)
    if (state.minPrice != null) parts.push(`minPrice=${priceParam(state.minPrice)}`)
    if (state.maxPrice != null) parts.push(`maxPrice=${priceParam(state.maxPrice)}`)
    if (state.discounted) parts.push('discounted=1')
    if (state.inStock) parts.push('inStock=1')
    if (state.sort !== 'recommended') parts.push(`sort=${state.sort}`)
    if (state.page > 1) parts.push(`page=${state.page}`)
    return parts.length ? `?${parts.join('&')}` : ''
}

/** Full listing URL for a base path ("/products/" or "/kategori/x/"). */
export function listingHref(basePath: string, state: ListingState): string {
    return `${basePath}${listingQueryString(state)}`
}

/** Everything except the page: two states with the same signature list the same products. */
export function filterSignature(state: ListingState): string {
    return listingQueryString({ ...state, page: 1 })
}

/** Facets, price or toggles are set (the search text and the sort order are not "filters"). */
export function activeFilterCount(state: ListingState): number {
    return state.f.length + (state.minPrice != null || state.maxPrice != null ? 1 : 0) + (state.discounted ? 1 : 0) + (state.inStock ? 1 : 0)
}

/** Any parameter that changes which products are listed (search text included). */
export function isNarrowed(state: ListingState): boolean {
    return activeFilterCount(state) > 0 || state.q.trim() !== ''
}

/** "100 – 150 ₺", "300 ₺ ve üzeri", "100 ₺ ve altı" for the active-filter chip. */
export function priceLabel(min: number | null, max: number | null): string {
    const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    if (min != null && max != null) return `${fmt(min)} – ${fmt(max)} ₺`
    if (min != null) return `${fmt(min)} ₺ ve üzeri`
    if (max != null) return `${fmt(max)} ₺ ve altı`
    return ''
}
