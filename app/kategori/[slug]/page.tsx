/**
 * /kategori/<slug>/ — category listing (server-rendered, canonical category URL).
 *
 * - Unknown slug or a category without active products → notFound() (real 404).
 * - Other spelling of the slug (case) → 308 to the canonical /kategori/<slug>/.
 * - H1 = category name, real-data intro, visible breadcrumb + BreadcrumbList, ItemList of this page.
 * - Filters/sort/search on the page are noindex,follow; ?page=N is self-canonical (docs/SEO.md §6).
 * No loading.tsx / Suspense around the content: the 404 and the redirect must keep their status codes.
 */
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { JsonLd } from '@/components/seo/JsonLd'
import { ListingView } from '@/components/listing/ListingView'
import { listingQueryString, parseListingState } from '@/components/listing/listing-state'
import { categoryIntro, loadListing } from '@/lib/listing-data'
import { getActiveProducts } from '@/lib/catalog'
import { breadcrumbJsonLd, buildMetadata, categoryMetaDescription, categoryTitle, foldTr, itemListJsonLd, productPath } from '@/lib/seo'
import { getSiteSeo } from '@/lib/seo-server'
import { listingSeo, normalizeSlugParam, resolveCategoryCached, type CategoryInfo } from '@/lib/seo-routing'

type SearchParams = Record<string, string | string[] | undefined>

interface PageProps {
    params: Promise<{ slug: string }>
    searchParams: Promise<SearchParams>
}

/** The category for this URL, or null (404). `redirect` is set when the slug is spelled differently. */
async function resolve(rawSlug: string): Promise<{ category: CategoryInfo; redirect: boolean } | null> {
    const slug = normalizeSlugParam(rawSlug)
    if (!slug) return null
    const category = await resolveCategoryCached(slug)
    if (!category || category.productCount === 0) return null
    return { category, redirect: category.slug !== slug }
}

async function categoryFacts(category: CategoryInfo) {
    const key = (s: string) => foldTr(s).trim()
    const products = (await getActiveProducts()).filter(p => {
        const c = key(p.category)
        return c !== '' && (c === key(category.name) || c === key(category.slug))
    })
    const prices = products.map(p => p.display_price).filter(n => n > 0)
    return {
        count: products.length || category.productCount,
        minPrice: prices.length ? Math.min(...prices) : undefined,
        productNames: products.map(p => p.name),
        image: products.find(p => p.in_stock && p.image)?.image ?? products[0]?.image ?? null,
    }
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
    const r = await resolve((await params).slug)
    if (!r || r.redirect) return {}
    const { category } = r
    const sp = await searchParams
    const state = parseListingState(sp)
    const [site, data, facts] = await Promise.all([getSiteSeo(), loadListing(category.path, category.slug, state), categoryFacts(category)])
    const ls = listingSeo(sp, { totalItems: data.result.total, pageSize: data.pageSize })
    if (ls.outOfRange) return {}
    return buildMetadata({
        title: categoryTitle(category.name, ls.page),
        description: categoryMetaDescription(category.name, facts, site, ls.page),
        path: category.path,
        query: ls.canonicalQuery,
        noindex: ls.noindex || state.discounted || state.inStock,
        images: facts.image ? [facts.image] : undefined,
        site,
    })
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
    const r = await resolve((await params).slug)
    if (!r) notFound()
    const sp = await searchParams
    const state = parseListingState(sp)
    if (r.redirect) permanentRedirect(`${r.category.path}${listingQueryString(state)}`)
    const { category } = r

    const data = await loadListing(category.path, category.slug, state)
    const ls = listingSeo(sp, { totalItems: data.result.total, pageSize: data.pageSize })
    if (ls.outOfRange) notFound()
    const noindex = ls.noindex || state.discounted || state.inStock

    const intro = await categoryIntro(category)
    const start = (data.result.page - 1) * data.pageSize + 1
    const crumbs = [{ name: 'Anasayfa', path: '/' }, { name: category.name }]
    const jsonLd = [
        breadcrumbJsonLd(crumbs),
        ...(noindex
            ? []
            : [itemListJsonLd(data.result.items.map(p => ({ path: productPath(p.slug), name: p.name })), { name: category.name, startIndex: start })]),
    ]

    return (
        <>
            <JsonLd data={jsonLd} />
            <ListingView
                data={data}
                h1={category.name}
                intro={intro || null}
                breadcrumb={[{ label: 'Anasayfa', href: '/' }, { label: category.name }]}
                searchPlaceholder="Bu kategoride ara"
                searchLabel={`${category.name} kategorisinde ara`}
            />
        </>
    )
}
