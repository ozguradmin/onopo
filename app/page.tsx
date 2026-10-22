import type { Metadata } from 'next'
import { RefreshCw } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { CampaignBanners } from '@/components/home/CampaignBanners'
import { HomeAbout, QuickSearchChips } from '@/components/home/HomeHero'
import { HomeProductSection, HomeSections, isProductSection, SECTION_GAP } from '@/components/home/HomeSections'
import { ProductRail } from '@/components/home/ProductRail'
import { ShortcutTiles } from '@/components/home/ShortcutTiles'
import { SectionHeader } from '@/components/ui/SectionHeader'
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
 * The two product rows at the top: tight gaps and compact cards, so on a 390×844 phone the first row
 * is complete and the second row's cards start above the bottom bar; on 1440×900 the first row's
 * prices are above the fold.
 */
const TOP_GAP = 'mt-3 lg:mt-5'
const TOP_HEADER = 'mb-2.5 lg:mb-4'

/**
 * Home page (Server Component). Shoppers come for products and offers, as on the big Turkish stores:
 * the "Kampanyalar" slider first (admin Hero slides when that section is on, then the campaign
 * banners built from live data, lib/campaigns), right under it the first two admin product rows as
 * compact cards, then the category row, the trust strip, the device chips, the other Admin › Ana
 * Sayfa sections in admin order, and the "Onopo Store hakkında" block with the page H1 at the end.
 * Everything is in the server HTML.
 *
 * Data failures never take the whole page down: a failed part is left out, the rest renders, and the
 * HTML carries the data-onopo-nocache marker so the edge cache does not keep the degraded page.
 */
export default async function Home() {
    const data = await getHomeData()
    const { sections, slides, shortcuts, failed } = data
    const threshold = data.shipping.freeShippingThreshold

    // Nothing could be loaded at all (D1 down): a real error (500), never an empty 200 page
    if (failed.includes('products') && failed.includes('sections') && failed.includes('hero')) {
        throw new Error('Home page data unavailable')
    }

    // The first two product rows in admin order go to the top, under the campaign slider
    const topSections = sections.filter(isProductSection).slice(0, 2)
    // The admin slider (Admin › Ana Sayfa "Hero Slider" switch) joins the campaign slider at the top
    const heroSection = sections.find(s => s.type === 'hero')
    const skip = [...topSections.map(s => s.id), heroSection?.id].filter((id): id is number => id != null)

    const hasCategoriesSection = sections.some(s => s.type === 'categories')
    const categoryShortcuts = shortcuts.filter(s => s.kind === 'category')
    // When the admin shows a categories section, the row keeps to product types (no duplicates)
    const rowShortcuts = hasCategoriesSection ? shortcuts.filter(s => s.kind === 'type') : shortcuts

    const productsFailed = failed.includes('products') || failed.includes('sections')

    return (
        <div className="pb-12 lg:pb-16">
            {failed.length > 0 && <div hidden data-onopo-nocache="" />}

            <CampaignBanners campaigns={data.campaigns} heroSlides={heroSection ? slides : []} className="mt-3 lg:mt-4" />

            {/* First products: the first two admin product rows, else the newest products (none active, or the sections failed) */}
            {topSections.length > 0 ? (
                topSections.map((section, i) => (
                    <HomeProductSection
                        key={section.id}
                        section={section}
                        freeShippingThreshold={threshold}
                        priorityCount={i === 0 ? 2 : 0}
                        headerClassName={TOP_HEADER}
                        compact
                        className={i === 0 ? TOP_GAP : 'mt-5 lg:mt-8'}
                    />
                ))
            ) : data.fallbackProducts.length > 0 ? (
                <ProductRail
                    id="home-newest"
                    title="Yeni Ürünler"
                    description="Stoklara en son giren ürünler"
                    href="/products/"
                    products={data.fallbackProducts}
                    freeShippingThreshold={threshold}
                    priorityCount={2}
                    headerClassName={TOP_HEADER}
                    compact
                    className={TOP_GAP}
                />
            ) : productsFailed ? (
                <div className={`container-store ${TOP_GAP}`}>
                    <EmptyState
                        icon={<RefreshCw />}
                        title="Ürünler şu an yüklenemedi"
                        description="Kısa bir sorun oluştu. Sayfayı yenileyerek tekrar deneyebilirsiniz."
                        action={{ label: 'Tüm ürünlere git', href: '/products/' }}
                        className="rounded-card border border-line"
                    />
                </div>
            ) : null}

            {rowShortcuts.length > 0 && (
                <section aria-labelledby="home-categories-title" className={`container-store ${SECTION_GAP}`}>
                    <SectionHeader id="home-categories-title" title="Kategoriler" href="/kategoriler/" linkLabel="Tüm kategoriler" className="mb-3 lg:mb-4" />
                    <ShortcutTiles items={rowShortcuts} label="Kategoriler" />
                </section>
            )}

            <QuickSearchChips
                items={data.quickSearches}
                className="container-store mt-6 lg:mt-8"
                listClassName="no-scrollbar -mx-4 overflow-x-auto px-4 md:-mx-6 md:px-6 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
            />

            <HomeSections
                sections={sections}
                slides={[]}
                categoryShortcuts={categoryShortcuts}
                freeShippingThreshold={threshold}
                skip={skip}
            />

            <HomeAbout h1={data.intro.h1} text={data.intro.lead} className={SECTION_GAP} />
        </div>
    )
}
