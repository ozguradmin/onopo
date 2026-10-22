import type { Metadata } from 'next'
import { RefreshCw } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { HomeHero, QuickSearchChips } from '@/components/home/HomeHero'
import { HomeSections, SECTION_GAP } from '@/components/home/HomeSections'
import { ProductRail } from '@/components/home/ProductRail'
import { ShortcutTiles } from '@/components/home/ShortcutTiles'
import { TrustStrip } from '@/components/home/TrustStrip'
import { getActiveProducts } from '@/lib/catalog'
import { getHomeData } from '@/lib/home-data'
import { buildMetadata, homeMetaDescription, homeTitle } from '@/lib/seo'
import { getSiteSeo } from '@/lib/seo-server'

// Title and description from the product types the store really sells (lib/seo, docs/SEO.md §2);
// canonical https://onopostore.com/ and the default og:image (/og-image.jpg).
export async function generateMetadata(): Promise<Metadata> {
    const site = await getSiteSeo()
    let names: string[] = []
    try {
        names = (await getActiveProducts()).map(p => p.name)
    } catch {
        // homeTitle/homeMetaDescription fall back to the store defaults
    }
    return buildMetadata({
        absoluteTitle: homeTitle(names),
        description: homeMetaDescription(names, site),
        path: '/',
        site,
    })
}

/**
 * Home page (Server Component, design spec §8). Everything above the fold is in the server HTML:
 * hero (Admin › Ana Sayfa › Hero slides, or a banner built from real data) with the page H1,
 * shortcut tiles, trust strip; then the Admin › Ana Sayfa sections in admin order.
 *
 * Data failures never take the whole page down: a failed part is left out, the rest renders, and the
 * HTML carries the data-onopo-nocache marker so the edge cache does not keep the degraded page.
 */
export default async function Home() {
    const data = await getHomeData()
    const { sections, slides, shortcuts, failed } = data

    // Nothing could be loaded at all (D1 down): a real error (500), never an empty 200 page
    if (failed.includes('products') && failed.includes('sections') && failed.includes('hero')) {
        throw new Error('Home page data unavailable')
    }

    // The admin slider shows only for an active 'hero' section (Admin › Ana Sayfa switch, as on the old
    // site): at the top when that section comes first, otherwise where it sits. The top then shows
    // the banner built from store data. No active hero section → no slides anywhere.
    const heroSection = sections.find(s => s.type === 'hero')
    const heroOnTop = !!heroSection && sections[0]?.id === heroSection.id
    const heroInPlace = !!heroSection && !heroOnTop && slides.length > 0
    const topSlides = heroOnTop ? slides : []

    const hasCategoriesSection = sections.some(s => s.type === 'categories')
    const categoryShortcuts = shortcuts.filter(s => s.kind === 'category')
    // When the admin shows a categories section, the top row keeps to product types (no duplicates)
    const topShortcuts = hasCategoriesSection ? shortcuts.filter(s => s.kind === 'type') : shortcuts

    const hasProductRows = sections.some(s => (s.type === 'products' || s.type === 'new_products') && (s.products?.length ?? 0) > 0)
    const productsFailed = failed.includes('products') || failed.includes('sections')

    return (
        <div className="pb-12 lg:pb-16">
            {failed.length > 0 && <div hidden data-onopo-nocache="" />}

            <HomeHero
                slides={topSlides}
                intro={data.intro}
                stats={data.stats}
                quickSearches={data.quickSearches}
                freeShippingThreshold={data.shipping.freeShippingThreshold}
                featuredCategory={data.featuredCategory}
            />

            <ShortcutTiles items={topShortcuts} className="mt-6 lg:mt-10" />

            <TrustStrip items={data.trust} className="mt-6 lg:mt-8" />

            {/* Device chips sit in the hero panel on desktop; on phones they follow the trust strip */}
            <QuickSearchChips
                items={data.quickSearches}
                className="container-store mt-6 lg:hidden"
                listClassName="no-scrollbar -mx-4 overflow-x-auto px-4 md:-mx-6 md:px-6"
            />

            <HomeSections
                sections={sections}
                slides={heroInPlace ? slides : []}
                categoryShortcuts={categoryShortcuts}
                freeShippingThreshold={data.shipping.freeShippingThreshold}
                skip={heroSection && !heroInPlace ? [heroSection.id] : []}
            />

            {/* No product row from the admin (none active, or the sections failed): newest products */}
            {!hasProductRows && data.fallbackProducts.length > 0 && (
                <ProductRail
                    id="home-newest"
                    title="Yeni Ürünler"
                    description="Stoklara en son giren ürünler"
                    href="/products/"
                    products={data.fallbackProducts}
                    freeShippingThreshold={data.shipping.freeShippingThreshold}
                    className={SECTION_GAP}
                />
            )}

            {productsFailed && data.fallbackProducts.length === 0 && (
                <div className={`container-store ${SECTION_GAP}`}>
                    <EmptyState
                        icon={<RefreshCw />}
                        title="Ürünler şu an yüklenemedi"
                        description="Kısa bir sorun oluştu. Sayfayı yenileyerek tekrar deneyebilirsiniz."
                        action={{ label: 'Tüm ürünlere git', href: '/products/' }}
                        className="rounded-card border border-line"
                    />
                </div>
            )}
        </div>
    )
}
