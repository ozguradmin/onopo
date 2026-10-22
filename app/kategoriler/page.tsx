import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { CategoriesGrid } from '@/components/home/ShortcutTiles'
import { QuickSearchChips } from '@/components/home/HomeHero'
import { getHomeData } from '@/lib/home-data'
import { formatAmount } from '@/lib/format'
import { buildMetadata } from '@/lib/seo'
import { getSiteSeo } from '@/lib/seo-server'

/**
 * /kategoriler/: every way into the catalogue on one page (the bottom nav's "Kategoriler" tab, the drawer's
 * "Tüm kategorileri gör" and the home page's "Tüm kategoriler" link). Product types (listing filters), the
 * real categories with products, and the device searches, all with live counts from lib/home-data.
 * Indexable hub page; the old /categories/ URL still redirects to /products/ (lib/seo-routing).
 */
export async function generateMetadata(): Promise<Metadata> {
    const site = await getSiteSeo()
    return buildMetadata({
        title: 'Kategoriler',
        description: 'Şarj aletleri, kablolar, ekran koruyucular, araç şarjı ve diğer telefon aksesuarları: Onopo Store kategorileri ve ürün türleri.',
        path: '/kategoriler/',
        site,
    })
}

export default async function CategoriesHubPage() {
    const data = await getHomeData()
    const types = data.shortcuts.filter(s => s.kind === 'type')
    const categories = data.shortcuts.filter(s => s.kind === 'category')
    const stats = data.stats
    const lead = stats && stats.productCount > 0
        ? `${stats.productCount} ürün${stats.minPrice ? `, ${formatAmount(stats.minPrice)}'den başlayan fiyatlarla` : ''}.`
        : ''

    return (
        <div className="bg-canvas pb-14 pt-4 lg:pb-16 lg:pt-6">
            {data.failed.length > 0 && <div hidden data-onopo-nocache="" />}
            <div className="container-store">
                <Breadcrumb items={[{ label: 'Anasayfa', href: '/' }, { label: 'Kategoriler' }]} jsonLd />
                <h1 className="type-h1 mt-3 text-ink">Kategoriler</h1>
                {lead && <p className="mt-1 text-sm leading-6 text-muted lg:text-[15px]">{lead}</p>}
            </div>

            <CategoriesGrid id="kategoriler-turler" title="Ürün türleri" items={types} className="mt-6 lg:mt-8" />
            <CategoriesGrid id="kategoriler-kategoriler" title="Kategoriler" items={categories} className="mt-8 lg:mt-10" />

            <QuickSearchChips
                items={data.quickSearches}
                className="container-store mt-8 lg:mt-10"
                listClassName="flex-wrap"
            />
        </div>
    )
}
