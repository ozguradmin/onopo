import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { JsonLd } from '@/components/seo/JsonLd'
import { DeviceBrandCards } from '@/components/devices/DeviceLinks'
import { DEVICES_HUB, deviceH1, devicePath, isIndexableDevicePage } from '@/lib/devices'
import { getDeviceData, type DeviceData } from '@/lib/devices/server'
import { buildMetadata, categoryMetaDescription, itemListJsonLd } from '@/lib/seo'
import { getSiteSeo } from '@/lib/seo-server'

/**
 * /cihaz/: the device pages hub ("Cihaza göre"): every brand with a page, its product count and its model pages
 * (lib/devices, live from the active products). Brands too small for a page are listed at the bottom with a
 * search link. Indexable while at least one device page is; /kategoriler/ and product pages link here.
 */
async function loadHub(): Promise<{ data: DeviceData | null; indexable: DeviceData['catalog']['pages'] }> {
    try {
        const data = await getDeviceData()
        return { data, indexable: data.catalog.pages.filter(p => isIndexableDevicePage(p, data.products)) }
    } catch (error) {
        console.error('[cihaz] hub could not be loaded', error)
        return { data: null, indexable: [] }
    }
}

export async function generateMetadata(): Promise<Metadata> {
    const [{ data, indexable }, site] = await Promise.all([loadHub(), getSiteSeo()])
    const ids = new Set(indexable.flatMap(p => p.productIds))
    const products = (data?.products ?? []).filter(p => ids.has(p.id))
    const prices = products.map(p => p.display_price).filter(n => n > 0)
    return buildMetadata({
        title: DEVICES_HUB.title,
        description: categoryMetaDescription(DEVICES_HUB.h1, { count: products.length, minPrice: prices.length ? Math.min(...prices) : undefined, productNames: products.map(p => p.name) }, site),
        path: '/cihaz/',
        noindex: indexable.length === 0,
        site,
    })
}

export default async function DevicesHubPage() {
    const { data, indexable } = await loadHub()
    const brands = data?.catalog.brands ?? []
    const brandPages = brands.filter(b => b.hasPage).length
    const modelPages = data?.catalog.pages.filter(p => p.kind === 'model').length ?? 0
    // Brands with products but no page of their own (fewer products than a page needs): a search link
    const small = brands.filter(b => !b.hasPage && !b.models.some(m => m.hasPage))

    return (
        <div className="bg-canvas pb-14 pt-4 lg:pb-16 lg:pt-6">
            {/* The catalogue could not be read: this render must not be edge-cached */}
            {!data && <div hidden data-onopo-nocache="" />}
            <div className="container-store">
                <Breadcrumb jsonLd items={[{ label: 'Anasayfa', href: '/' }, { label: DEVICES_HUB.crumb }]} />
                <header className="mt-3 max-w-[68ch]">
                    <h1 className="type-h1 text-ink">{DEVICES_HUB.h1}</h1>
                    <p className="mt-2 text-[15px] leading-6 text-muted">
                        {brandPages > 0
                            ? `Telefonunuzun ya da tabletinizin markasını ve modelini seçin; ekran koruyucu, şarj aleti ve kabloları tek sayfada görün. ${brandPages} marka${modelPages > 0 ? ` ve ${modelPages} model` : ''} için sayfa var.`
                            : 'Cihaz sayfaları şu an gösterilemiyor. Tüm ürünlere göz atabilirsiniz.'}
                    </p>
                </header>

                <DeviceBrandCards brands={brands} className="mt-6 lg:mt-8" />

                {small.length > 0 && (
                    <p className="mt-6 text-sm leading-6 text-muted">
                        Diğer cihazlar:{' '}
                        {small.map((b, i) => (
                            <span key={b.id}>
                                {i > 0 && ', '}
                                <Link href={`/products/?q=${encodeURIComponent(b.label)}`} prefetch={false} rel="nofollow" className="font-semibold text-ink-2 underline-offset-2 hover:text-ink hover:underline">
                                    {b.label}
                                </Link>{' '}
                                ({b.productIds.length} ürün)
                            </span>
                        ))}
                    </p>
                )}

                {!data && (
                    <p className="mt-6">
                        <Link href="/products/" prefetch={false} className="text-sm font-semibold text-brand-600 hover:underline">Tüm ürünler</Link>
                    </p>
                )}
            </div>
            {indexable.length > 0 && (
                <JsonLd data={itemListJsonLd(indexable.map(p => ({ path: devicePath(p.slug), name: deviceH1(p) })), { name: DEVICES_HUB.h1 })} />
            )}
        </div>
    )
}
