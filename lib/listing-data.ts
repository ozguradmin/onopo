/**
 * Server data for the listing pages (/products/, /products/?q=…, /kategori/<slug>/).
 *
 * Everything is computed on the server from lib/catalog listProducts() (full catalogue, in-memory),
 * so counts always equal what is listed, sold-out products come last, and the browser never fetches
 * settings, categories or products for the first render.
 */
import 'server-only'
import { cache } from 'react'
import {
    getCategories,
    getNewestProducts,
    getShippingSettings,
    getSiteSettings,
    getActiveProducts,
    listProducts,
    type Category,
    type ListProductsParams,
    type ListProductsResult,
    type Product,
    type PublicSiteSettings,
    type ShippingSettings,
} from '@/lib/catalog'
import { getReviewStatsMap, type ReviewStats } from '@/lib/reviews'
import { FACETS, normalizeText, prepareQuery } from '@/lib/search'
import { categoryPath, detectProductTypes } from '@/lib/seo'
import { formatNumberTR } from '@/lib/format'
import { EMPTY_LISTING_STATE, isNarrowed, listingHref, type ListingState } from '@/components/listing/listing-state'

/**
 * Products per page. Follows Admin › Ayarlar `products_per_page`, rounded UP to a multiple of 12 so
 * every page fills complete rows in the 2-, 3- and 4-column grids (20 → 24). Between 12 and 96.
 */
export function listingPageSize(settings: Pick<PublicSiteSettings, 'products_per_page'>): number {
    const raw = Number(settings.products_per_page) || 24
    return Math.min(96, Math.max(12, Math.ceil(raw / 12) * 12))
}

export interface ListingCategoryLink {
    name: string
    slug: string
    /** /kategori/<slug>/ with the current search/filters kept (page reset). */
    href: string
    /** Products this category would list with the current search/filters. */
    count: number
    active: boolean
}

export interface PanelData {
    /** Category list for the filter panel (current filters kept in the links). */
    categories: ListingCategoryLink[]
    /** "Tüm ürünler" count with the current filters. */
    allCount: number
    /** /products/ with the current search/filters kept. */
    allHref: string
    facets: ListProductsResult['facets']
    priceRange: ListProductsResult['priceRange']
    /** Results if "Sadece indirimli" were (or is) on. */
    discountedCount: number
    /** Results if "Stoktakiler" were (or is) on. */
    inStockCount: number
    total: number
}

export interface PopularSearch {
    label: string
    q: string
    count: number
}

export interface ListingData {
    basePath: string
    state: ListingState
    pageSize: number
    result: ListProductsResult
    /** The category of a /kategori/<slug>/ page. */
    category: Category | null
    panel: PanelData
    /** null when the reviews table could not be read (cards then hide the stars). */
    ratings: Map<number, ReviewStats> | null
    shipping: ShippingSettings
    settings: PublicSiteSettings
    /** Empty search: a corrected query that has results ("sarz" → "şarj"), with its count. */
    suggestion: { q: string; count: number } | null
    /** Empty states: popular searches that return something, and a few products to keep browsing. */
    popularSearches: PopularSearch[]
    fallbackProducts: Product[]
    /**
     * The search text names a quick filter ("şarj aleti" → Şarj aleti): that filter lists more products
     * than the literal search (all search words must match), so the page offers it.
     */
    facetHint: { key: string; label: string; count: number; href: string } | null
    /** Every category with products (empty states), with its overall count. */
    allCategories: { name: string; slug: string; count: number }[]
}

const POPULAR_SEARCHES: ReadonlyArray<{ label: string; q: string }> = [
    { label: 'Type-C kablo', q: 'type-c kablo' },
    { label: 'iPhone şarj', q: 'iphone şarj' },
    { label: '20W adaptör', q: '20w adaptör' },
    { label: 'Araç şarjı', q: 'araç şarj' },
    { label: 'Powerbank', q: 'powerbank' },
    { label: 'Kulaklık', q: 'kulaklık' },
    { label: 'Ekran koruyucu', q: 'ekran koruyucu' },
]

function filterParams(state: ListingState): ListProductsParams {
    return {
        q: state.q || null,
        facets: state.f,
        minPrice: state.minPrice,
        maxPrice: state.maxPrice,
        onlyDiscounted: state.discounted,
        inStockOnly: state.inStock,
        sort: state.sort,
    }
}

// ---------------------------------------------------------------------------------------------
// "Did you mean": correct misspelt words against the words of the product names
// ---------------------------------------------------------------------------------------------

function levenshtein(a: string, b: string, max: number): number {
    if (Math.abs(a.length - b.length) > max) return max + 1
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
        const cur = [i]
        let rowMin = i
        for (let j = 1; j <= b.length; j++) {
            const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
            cur.push(v)
            if (v < rowMin) rowMin = v
        }
        if (rowMin > max) return max + 1
        prev = cur
    }
    return prev[b.length]
}

/** folded word → how it is written in product names (Turkish letters kept), with its frequency. */
const productVocabulary = cache(async (): Promise<Map<string, { word: string; n: number }>> => {
    const vocab = new Map<string, { word: string; n: number }>()
    for (const p of await getActiveProducts()) {
        for (const raw of p.name.split(/[^\p{L}\p{N}]+/u)) {
            if (raw.length < 3 || /^\d+$/.test(raw)) continue
            const key = normalizeText(raw)
            if (!key || key.includes(' ')) continue
            const cur = vocab.get(key)
            if (cur) cur.n++
            else vocab.set(key, { word: raw.toLocaleLowerCase('tr-TR'), n: 1 })
        }
    }
    return vocab
})

async function suggestQuery(q: string, base: ListProductsParams): Promise<{ q: string; count: number } | null> {
    const tokens = prepareQuery(q).tokens
    if (!tokens.length) return null
    const vocab = await productVocabulary()
    let changed = false
    const out: string[] = []
    for (const t of tokens) {
        const known = vocab.get(t)
        if (known || t.length < 4 || /\d/.test(t)) {
            out.push(known ? known.word : t)
            continue
        }
        // Prefix of a known word ("powerb" → fine as is): keep
        let prefixHit = false
        for (const k of vocab.keys()) if (k.startsWith(t)) { prefixHit = true; break }
        if (prefixHit) {
            out.push(t)
            continue
        }
        const max = t.length >= 7 ? 2 : 1
        let best: { word: string; d: number; n: number } | null = null
        for (const [k, v] of vocab) {
            const d = levenshtein(t, k, max)
            if (d <= max && (!best || d < best.d || (d === best.d && v.n > best.n))) best = { word: v.word, d, n: v.n }
        }
        if (best) {
            out.push(best.word)
            changed = true
        } else out.push(t)
    }
    if (!changed) return null
    const fixed = out.join(' ')
    const res = await listProducts({ ...base, q: fixed, page: 1, pageSize: 1 })
    return res.total > 0 ? { q: fixed, count: res.total } : null
}

// ---------------------------------------------------------------------------------------------
// Search text that names a quick filter
// ---------------------------------------------------------------------------------------------

async function findFacetHint(state: ListingState, basePath: string, categorySlug: string | null, total: number): Promise<ListingData['facetHint']> {
    const qn = normalizeText(state.q)
    if (qn.length < 4) return null
    const facet = FACETS.find(f => {
        if (state.f.includes(f.key)) return false
        const label = normalizeText(f.label)
        return qn === label || qn === f.key.replace(/-/g, ' ') || ` ${label} `.includes(` ${qn} `)
    })
    if (!facet) return null
    const count = (await listProducts({ categorySlug, facets: [facet.key], page: 1, pageSize: 1 })).total
    if (count <= total) return null
    return {
        key: facet.key,
        label: facet.label,
        count,
        href: listingHref(basePath, { ...EMPTY_LISTING_STATE, f: [facet.key] }),
    }
}

// ---------------------------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------------------------

async function loadListingUncached(basePath: string, categorySlug: string | null, stateJson: string): Promise<ListingData> {
    const state: ListingState = { ...EMPTY_LISTING_STATE, ...(JSON.parse(stateJson) as ListingState) }
    const [settings, shipping, categories] = await Promise.all([
        getSiteSettings(),
        getShippingSettings(),
        getCategories({ withCounts: true, hideEmpty: true }),
    ])
    const pageSize = listingPageSize(settings)
    const base = filterParams(state)

    // Main query (throws when D1 is down: the page must fail with 500, never render an empty 200)
    const result = await listProducts({ ...base, categorySlug, page: state.page, pageSize })
    const category = categorySlug ? result.category : null

    // Ratings only decorate the cards: a failure hides the stars instead of failing the page
    let ratings: Map<number, ReviewStats> | null = null
    try {
        ratings = await getReviewStatsMap()
    } catch (err) {
        console.error('[listing] review stats unavailable:', err)
    }

    // Panel counts, all with the current search and filters
    const narrowed = isNarrowed(state)
    const countWith = async (extra: Partial<ListProductsParams>) =>
        (await listProducts({ ...base, categorySlug, page: 1, pageSize: 1, ...extra })).total
    const [discountedCount, categoryCounts, allCount] = await Promise.all([
        state.discounted ? Promise.resolve(result.total) : countWith({ onlyDiscounted: true }),
        Promise.all(
            categories.map(async c =>
                narrowed ? (await listProducts({ ...base, categorySlug: c.slug, page: 1, pageSize: 1 })).total : c.product_count,
            ),
        ),
        categorySlug
            ? narrowed
                ? listProducts({ ...base, page: 1, pageSize: 1 }).then(r => r.total)
                : getActiveProducts().then(list => list.length)
            : Promise.resolve(result.total),
    ])
    const inStockCount = state.inStock ? result.total : result.inStockTotal

    const panel: PanelData = {
        categories: categories
            .map((c, i) => ({
                name: c.name,
                slug: c.slug,
                href: categoryLinkHref(c.slug, state),
                count: categoryCounts[i],
                active: !!category && category.slug === c.slug,
            }))
            .filter(c => c.count > 0 || c.active),
        allCount,
        allHref: categoryLinkHref(null, state),
        facets: result.facets,
        priceRange: result.priceRange,
        discountedCount,
        inStockCount,
        total: result.total,
    }

    // Empty states: spelling suggestion, popular searches with results, a few products
    let suggestion: ListingData['suggestion'] = null
    let popularSearches: PopularSearch[] = []
    let fallbackProducts: Product[] = []
    if (result.total === 0) {
        if (state.q) suggestion = await suggestQuery(state.q, { ...base, categorySlug })
        const counts = await Promise.all(POPULAR_SEARCHES.map(s => listProducts({ q: s.q, page: 1, pageSize: 1 }).then(r => r.total)))
        popularSearches = POPULAR_SEARCHES.map((s, i) => ({ ...s, count: counts[i] })).filter(s => s.count > 0)
        fallbackProducts = await getNewestProducts(4)
    }

    const allCategories = categories.map(c => ({ name: c.name, slug: c.slug, count: c.product_count }))
    const facetHint = state.q ? await findFacetHint(state, basePath, categorySlug, result.total) : null

    return { basePath, state, pageSize, result, category, panel, ratings, shipping, settings, suggestion, popularSearches, fallbackProducts, facetHint, allCategories }
}

const loadListingCached = cache(loadListingUncached)

/**
 * Listing data for one request. React cache: generateMetadata and the page share the work.
 * `categorySlug` is the resolved slug of a /kategori/<slug>/ page (null for /products/).
 */
export function loadListing(basePath: string, categorySlug: string | null, state: ListingState): Promise<ListingData> {
    return loadListingCached(basePath, categorySlug, JSON.stringify(state))
}

// ---------------------------------------------------------------------------------------------
// Copy built from real data
// ---------------------------------------------------------------------------------------------

function joinTr(items: string[]): string {
    if (items.length <= 1) return items[0] ?? ''
    return `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`
}

function capitalizeTr(s: string): string {
    return s ? s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1) : s
}

/**
 * The sentence after "N ürün" under the H1, from the same facts as categoryMetaDescription (real
 * prices and the product types actually listed): "79,99 TL'den başlayan fiyatlarla şarj ve data
 * kabloları, hızlı şarj aletleri ve ekran koruyucular." Empty when there is nothing to say.
 */
function introFor(products: Product[], more: boolean): string {
    if (!products.length) return ''
    const prices = products.map(p => p.display_price).filter(n => n > 0)
    const min = prices.length ? Math.min(...prices) : 0
    const types = detectProductTypes(products.map(p => p.name)).map(t => t.plural)
    const shown = types.slice(0, 3)
    const list = more && types.length > 3 ? `${shown.join(', ')} ve daha fazlası` : joinTr(shown)
    const price = min > 0 ? `${formatNumberTR(min)} TL'den başlayan fiyatlarla` : ''
    let text = [price, list].filter(Boolean).join(' ')
    if (!text) return ''
    text = capitalizeTr(text) + '.'
    if (!products.some(p => p.in_stock)) text += ' Şu an tümü tükendi.'
    return text
}

/** Intro for a /kategori/<slug>/ page (all active products of the category). */
export async function categoryIntro(category: Pick<Category, 'name' | 'slug'>): Promise<string> {
    const name = normalizeText(category.name)
    const slug = normalizeText(category.slug)
    const products = (await getActiveProducts()).filter(p => {
        const key = normalizeText(p.category)
        return key !== '' && (key === name || key === slug)
    })
    return introFor(products, false)
}

/** Intro for /products/ (the whole catalogue). */
export async function catalogueIntro(): Promise<string> {
    return introFor(await getActiveProducts(), true)
}

/** href for a category link that keeps the current search/filters (page reset). */
export function categoryLinkHref(slug: string | null, state: ListingState): string {
    return listingHref(slug ? categoryPath(slug) : '/products/', { ...state, page: 1 })
}
