/**
 * /products/ — all products, search results (?q=) and the legacy ?category= entry point.
 * Server-rendered from lib/catalog listProducts(); filters, sort and paging are URL state (see
 * components/listing/listing-state.ts). No loading.tsx and no Suspense around the content: the
 * redirect for ?category= and the 404 for an out-of-range ?page= must keep their status codes, and
 * the in-page search box must never be swapped for a skeleton while the visitor types.
 */
import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound, permanentRedirect } from 'next/navigation'
import { JsonLd } from '@/components/seo/JsonLd'
import { ListingView } from '@/components/listing/ListingView'
import { activeFilterCount, listingQueryString, parseListingState, type ListingState } from '@/components/listing/listing-state'
import { getActiveProducts } from '@/lib/catalog'
import { catalogueIntro, loadListing } from '@/lib/listing-data'
import { breadcrumbJsonLd, buildMetadata, itemListJsonLd, listingMetaDescription, productPath } from '@/lib/seo'
import { getSiteSeo } from '@/lib/seo-server'
import { listingSeo, resolveListingCategory } from '@/lib/seo-routing'

type SearchParams = Record<string, string | string[] | undefined>

interface PageProps {
    searchParams: Promise<SearchParams>
}

const BASE_PATH = '/products/'

function categoryParam(sp: SearchParams): string {
    const v = sp.category
    return (Array.isArray(v) ? v[0] ?? '' : v ?? '').trim()
}

const resolveCategoryParam = cache((value: string) => resolveListingCategory(value))

/** ?category=<name or slug> → /kategori/<slug>/ (308), keeping the other listing parameters. */
async function legacyCategoryRedirect(sp: SearchParams): Promise<string | null> {
    const value = categoryParam(sp)
    if (!value) return null
    const target = await resolveCategoryParam(value)
    if (!target) return null
    return `${target}${listingQueryString(parseListingState(sp))}`
}

function lowestPrice(prices: number[]): number | undefined {
    const valid = prices.filter(n => n > 0)
    return valid.length ? Math.min(...valid) : undefined
}

/**
 * "Yeni Gelenler" (the menus' /products/?sort=newest, formerly /new/): newest first with no search, no
 * filter and no unknown ?category=. It is named after the menu item; robots and canonical stay those
 * of any sort variant (noindex, follow; no canonical).
 */
function isNewArrivals(sp: SearchParams, state: ListingState): boolean {
    return state.sort === 'newest' && !state.q.trim() && activeFilterCount(state) === 0 && !categoryParam(sp)
}

function isNoindex(sp: SearchParams, state: ListingState, total: number, pageSize: number) {
    const ls = listingSeo(sp, { totalItems: total, pageSize })
    return { ls, noindex: ls.noindex || state.discounted || state.inStock }
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
    const sp = await searchParams
    if (await legacyCategoryRedirect(sp)) return {}
    const state = parseListingState(sp)
    const [site, data, all] = await Promise.all([getSiteSeo(), loadListing(BASE_PATH, null, state), getActiveProducts()])
    const { ls, noindex } = isNoindex(sp, state, data.result.total, data.pageSize)
    if (ls.outOfRange) return {}
    const q = state.q.trim()
    const name = isNewArrivals(sp, state) ? 'Yeni Gelenler' : 'Tüm Ürünler'
    const title = q ? `«${q}» için arama sonuçları` : ls.page > 1 ? `${name} - Sayfa ${ls.page}` : name
    const description = listingMetaDescription(
        {
            count: q ? data.result.total : all.length,
            minPrice: q ? data.result.priceRange?.min : lowestPrice(all.map(p => p.display_price)),
            productNames: all.map(p => p.name),
        },
        site,
        { query: q || undefined, page: ls.page },
    )
    return buildMetadata({ title, description, path: BASE_PATH, query: ls.canonicalQuery, noindex, site })
}

export default async function ProductsPage({ searchParams }: PageProps) {
    const sp = await searchParams
    // Legacy links (/products/?category=Cep Telefonu Aksesuarları) keep working: 308 to the category page
    const target = await legacyCategoryRedirect(sp)
    if (target) permanentRedirect(target)

    const state = parseListingState(sp)
    const data = await loadListing(BASE_PATH, null, state)
    const { ls, noindex } = isNoindex(sp, state, data.result.total, data.pageSize)
    if (ls.outOfRange) notFound()

    const q = state.q.trim()
    const unknownCategory = categoryParam(sp)
    const intro = q ? null : await catalogueIntro()
    const newArrivals = isNewArrivals(sp, state)
    const breadcrumb = q
        ? [{ label: 'Anasayfa', href: '/' }, { label: 'Tüm Ürünler', href: BASE_PATH }, { label: 'Arama' }]
        : newArrivals
          ? [{ label: 'Anasayfa', href: '/' }, { label: 'Tüm Ürünler', href: BASE_PATH }, { label: 'Yeni Gelenler' }]
          : [{ label: 'Anasayfa', href: '/' }, { label: 'Tüm Ürünler' }]

    const start = (data.result.page - 1) * data.pageSize + 1
    const jsonLd = noindex
        ? null
        : [
            breadcrumbJsonLd([{ name: 'Anasayfa', path: '/' }, { name: 'Tüm Ürünler' }]),
            itemListJsonLd(data.result.items.map(p => ({ path: productPath(p.slug), name: p.name })), { name: 'Tüm Ürünler', startIndex: start }),
        ]

    return (
        <>
            {jsonLd && <JsonLd data={jsonLd} />}
            <ListingView
                data={data}
                h1={q ? <>Arama: “{q}”</> : newArrivals ? 'Yeni Gelenler' : 'Tüm Ürünler'}
                intro={intro}
                breadcrumb={breadcrumb}
                searchPlaceholder="Ürün, model veya cihaz ara"
                searchLabel="Ürünlerde ara"
                searchInHeader
                notice={
                    unknownCategory ? (
                        <p className="mb-4 rounded-card bg-surface px-4 py-3 text-sm text-ink-2">
                            “{unknownCategory}” kategorisinde şu an ürün yok. Tüm ürünleri gösteriyoruz.
                        </p>
                    ) : null
                }
            />
        </>
    )
}
