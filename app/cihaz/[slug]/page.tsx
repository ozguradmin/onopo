import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { Breadcrumb, type BreadcrumbItem } from '@/components/ui/Breadcrumb'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { GuideLinkList } from '@/components/guides/GuideCards'
import { DeviceGroupNav, DeviceModelChips, DeviceProductGroups } from '@/components/devices/DeviceLinks'
import { getShippingSettings } from '@/lib/catalog'
import {
    DEVICES_HUB,
    DEVICES_PATH,
    deviceBrandOf,
    deviceH1,
    deviceIntro,
    devicePageProducts,
    devicePath,
    deviceTitle,
    groupDeviceProducts,
    isIndexableDevicePage,
    relatedDeviceGuides,
    siblingDevicePages,
} from '@/lib/devices'
import { getDeviceData } from '@/lib/devices/server'
import { getReviewStatsMapSafe } from '@/lib/reviews'
import { buildMetadata, categoryMetaDescription, itemListJsonLd, productPath } from '@/lib/seo'
import { getSiteSeo } from '@/lib/seo-server'
import { normalizeSlugParam } from '@/lib/seo-routing'

/**
 * /cihaz/<slug>/: a brand ("iphone", "samsung", "xiaomi-redmi" …) or a model ("iphone-15-pro-max") with at least
 * MIN_DEVICE_PRODUCTS active products (lib/devices; the list follows the live catalogue). Products grouped by type,
 * in stock first. A page whose products are all sold out, or a model page filled mostly by the connector rule,
 * still answers 200, with noindex (isIndexableDevicePage).
 * An unknown slug is a real 404 (lib/redirects.ts never guesses under /cihaz/); another case of a known slug is
 * a 308 to it. No loading.tsx / Suspense: the status is decided first.
 */
type Params = Promise<{ slug: string }>

async function resolve(rawSlug: string) {
    const slug = normalizeSlugParam(rawSlug) ?? ''
    const data = await getDeviceData()
    const page = data.catalog.bySlug.get(slug) ?? null
    if (page) return { page, data, redirect: false }
    const lower = data.catalog.bySlug.get(slug.toLowerCase())
    return lower ? { page: lower, data, redirect: true } : null
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const r = await resolve((await params).slug)
    if (!r || r.redirect) return { title: 'Sayfa bulunamadı', robots: { index: false, follow: true } }
    const { page, data } = r
    const products = devicePageProducts(page, data.products)
    const groups = groupDeviceProducts(products)
    const site = await getSiteSeo()
    const prices = products.map(p => p.display_price).filter(n => n > 0)
    const image = products.find(p => p.in_stock && p.image)?.image ?? null
    return buildMetadata({
        title: deviceTitle(page, groups),
        description: categoryMetaDescription(deviceH1(page), { count: products.length, minPrice: prices.length ? Math.min(...prices) : undefined, productNames: products.map(p => p.name) }, site),
        path: devicePath(page.slug),
        images: image ? [image] : undefined,
        noindex: !isIndexableDevicePage(page, data.products),
        site,
    })
}

export default async function DevicePage({ params }: { params: Params }) {
    const r = await resolve((await params).slug)
    if (!r) notFound()
    if (r.redirect) permanentRedirect(devicePath(r.page.slug))
    const { page, data } = r

    const products = devicePageProducts(page, data.products)
    const groups = groupDeviceProducts(products)
    const brand = deviceBrandOf(data.catalog, page)
    const siblings = page.kind === 'model' ? siblingDevicePages(data.catalog, page) : []
    const guides = relatedDeviceGuides(products)
    const indexable = isIndexableDevicePage(page, data.products)
    const [shipping, ratings] = await Promise.all([getShippingSettings(), getReviewStatsMapSafe()])

    const crumbs: BreadcrumbItem[] = [{ label: 'Anasayfa', href: '/' }, { label: DEVICES_HUB.crumb, href: DEVICES_PATH }]
    if (page.kind === 'model' && brand?.hasPage) crumbs.push({ label: brand.label, href: devicePath(brand.slug) })
    crumbs.push({ label: deviceH1(page) })
    const listed = groups.flatMap(g => g.products)

    return (
        <div className="bg-canvas pb-14 pt-4 lg:pb-16 lg:pt-6">
            <div className="container-store">
                <Breadcrumb jsonLd items={crumbs} />
                <header className="mt-3 max-w-[72ch]">
                    <p className="type-micro text-brand-600">Cihaza göre</p>
                    <h1 className="type-h1 mt-1 text-ink">{deviceH1(page)}</h1>
                    <p className="mt-2 text-[15px] leading-6 text-muted">{deviceIntro(page, groups, brand)}</p>
                </header>

                {page.kind === 'brand' && brand && brand.models.length > 0 && (
                    <nav aria-labelledby="cihaz-modeller" className="mt-5">
                        <h2 id="cihaz-modeller" className="type-micro text-muted">Modeller</h2>
                        <DeviceModelChips models={brand.models} className="mt-2" />
                    </nav>
                )}

                <DeviceGroupNav groups={groups} className="mt-5" />
                <DeviceProductGroups groups={groups} ratings={ratings} freeShippingThreshold={shipping.freeShippingThreshold} className="mt-8 lg:mt-10" />

                {page.kind === 'model' && brand && (siblings.length > 0 || brand.hasPage) && (
                    <section aria-labelledby="cihaz-diger-modeller" className="mt-12 lg:mt-16">
                        <SectionHeader
                            id="cihaz-diger-modeller"
                            title={`Diğer ${brand.label} modelleri`}
                            href={brand.hasPage ? devicePath(brand.slug) : undefined}
                            linkLabel={`Tüm ${brand.label} ürünleri`}
                        />
                        <DeviceModelChips models={brand.models.filter(m => m.hasPage && m.slug !== page.slug)} />
                    </section>
                )}

                {guides.length > 0 && (
                    <section aria-labelledby="cihaz-rehberler" className="mt-12 lg:mt-16">
                        <SectionHeader id="cihaz-rehberler" title="İlgili rehberler" href="/rehber/" linkLabel="Tüm rehberler" />
                        <GuideLinkList guides={guides} />
                    </section>
                )}

                <p className="mt-10">
                    <Link href={DEVICES_PATH} prefetch={false} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline">
                        Tüm cihazlar
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </p>
            </div>
            {indexable && listed.length > 0 && (
                <JsonLd data={itemListJsonLd(listed.map(p => ({ path: productPath(p.slug), name: p.name })), { name: deviceH1(page) })} />
            )}
        </div>
    )
}
