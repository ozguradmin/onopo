import type { Metadata } from 'next'
import { RefreshCw } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { HeroCarousel } from '@/components/home/HeroCarousel'
import { HERO_HEIGHT_CLASS, HomeAbout, HomeIntro, PromoBanner, QuickSearchChips, toCarouselSlides } from '@/components/home/HomeHero'
import { HomeProductSection, HomeSections, isProductSection, SECTION_GAP } from '@/components/home/HomeSections'
import { ProductRail } from '@/components/home/ProductRail'
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
 * Category row → first product row, and that row's heading → its cards: kept tight, so the first cards'
 * prices stay above the fold at 360×740 and 1024×768 even for the tallest card (2-line name,
 * compatibility line, spec chips, old price) next to one without the "Kargo bedava" line.
 */
const TOP_GAP = 'mt-4'
const TOP_HEADER = 'lg:mb-4'

/**
 * Home page (Server Component, design spec §8). Shoppers come for products and prices, so the top is
 * products first, as on the big Turkish stores: the page H1 as one small line, a compact category row,
 * then right away the first admin product row ("Öne Çıkan Ürünler"), whose first cards (image, name,
 * price) are above the fold on phones (360×740 and up) and desktops (1024×768 and up). Then the slim
 * promo banner (or the admin slider), the trust strip, the device chips, the other Admin › Ana Sayfa
 * sections in admin order and the "Onopo Store hakkında" text. Everything is in the server HTML.
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

    // The first product row in admin order goes to the top, right under the category row
    const topSection = sections.find(isProductSection) ?? null

    // The admin slider shows only for an active 'hero' section (Admin › Ana Sayfa switch, as on the old
    // site). It never sits above the first product row: when the section comes before that row in admin
    // order, it takes the promo slot right under the row; otherwise it stays where it sits and the promo
    // slot shows the banner built from store data. No active hero section → no slides anywhere.
    const heroSection = sections.find(s => s.type === 'hero')
    const heroBeforeTop = !!heroSection && (!topSection || sections.indexOf(heroSection) < sections.indexOf(topSection))
    const heroInSlot = heroBeforeTop && slides.length > 0
    const heroInPlace = !!heroSection && !heroBeforeTop && slides.length > 0
    const skip = [topSection?.id, heroSection && !heroInPlace ? heroSection.id : undefined].filter((id): id is number => id != null)

    const hasCategoriesSection = sections.some(s => s.type === 'categories')
    const categoryShortcuts = shortcuts.filter(s => s.kind === 'category')
    // When the admin shows a categories section, the top row keeps to product types (no duplicates)
    const topShortcuts = hasCategoriesSection ? shortcuts.filter(s => s.kind === 'type') : shortcuts

    const productsFailed = failed.includes('products') || failed.includes('sections')

    return (
        <div className="pb-12 lg:pb-16">
            {failed.length > 0 && <div hidden data-onopo-nocache="" />}

            <HomeIntro h1={data.intro.h1} shortcuts={topShortcuts} />

            {/* First products: the first admin product row, else the newest products (none active, or the sections failed) */}
            {topSection ? (
                <HomeProductSection section={topSection} freeShippingThreshold={threshold} priorityCount={2} headerClassName={TOP_HEADER} className={TOP_GAP} />
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

            {heroInSlot ? (
                <div className={`container-store ${SECTION_GAP}`}>
                    <div className={HERO_HEIGHT_CLASS}>
                        <HeroCarousel slides={toCarouselSlides(slides)} priority={false} />
                    </div>
                </div>
            ) : (
                <PromoBanner stats={data.stats} className={SECTION_GAP} />
            )}

            <TrustStrip items={data.trust} className="mt-6 lg:mt-8" />

            <QuickSearchChips
                items={data.quickSearches}
                className="container-store mt-6 lg:mt-8"
                listClassName="no-scrollbar -mx-4 overflow-x-auto px-4 md:-mx-6 md:px-6 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
            />

            <HomeSections
                sections={sections}
                slides={heroInPlace ? slides : []}
                categoryShortcuts={categoryShortcuts}
                freeShippingThreshold={threshold}
                skip={skip}
            />

            <HomeAbout text={data.intro.lead} className={SECTION_GAP} />
        </div>
    )
}
