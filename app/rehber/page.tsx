import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { JsonLd } from '@/components/seo/JsonLd'
import { GuideCards } from '@/components/guides/GuideCards'
import { GUIDES, GUIDES_HUB, GUIDES_PATH, guidePath } from '@/lib/guides'
import { getGuideImages } from '@/lib/guides/server'
import { absoluteImageUrl } from '@/lib/images'
import { buildMetadata, itemListJsonLd } from '@/lib/seo'
import { getSiteSeo } from '@/lib/seo-server'

/**
 * /rehber/: the shopping guides hub. The texts live in code (lib/guides); the cards' pictures are our own photos of
 * each guide's in-stock products (getGuideImages, the request's one catalogue read). The footer, /kategoriler/ and
 * product pages link here.
 */
export async function generateMetadata(): Promise<Metadata> {
    const [site, { images }] = await Promise.all([getSiteSeo(), getGuideImages()])
    // og:image: the first guide's product photos (originals on images.onopostore.com)
    const photos = GUIDES.map(g => images[g.slug] ?? []).find(list => list.length > 0) ?? []
    return buildMetadata({
        title: GUIDES_HUB.title,
        description: GUIDES_HUB.description,
        path: GUIDES_PATH,
        images: photos.map(p => ({ url: absoluteImageUrl(p.image), alt: p.alt })),
        site,
    })
}

export default async function GuidesHubPage() {
    const { images, failed } = await getGuideImages()
    return (
        <div className="bg-canvas pb-14 pt-4 lg:pb-16 lg:pt-6">
            {/* The catalogue could not be read (no pictures): this render must not be edge-cached */}
            {failed && <div hidden data-onopo-nocache="" />}
            <div className="container-store">
                <Breadcrumb jsonLd items={[{ label: 'Anasayfa', href: '/' }, { label: 'Rehberler' }]} />
                <header className="mt-3 max-w-[68ch]">
                    <h1 className="type-h1 text-ink">Alışveriş rehberleri</h1>
                    <p className="mt-2 text-[15px] leading-6 text-muted">
                        Şarj aleti, kablo, ekran koruyucu, araç şarjı ve powerbank alırken nelere bakmalı? Kısa ve sade
                        rehberlerimizle doğru ürünü seçin.
                    </p>
                </header>
                <GuideCards guides={GUIDES} images={images} eagerImages={1} className="mt-6 lg:mt-8" />
            </div>
            <JsonLd data={itemListJsonLd(GUIDES.map(g => ({ path: guidePath(g.slug), name: g.title })), { name: GUIDES_HUB.title })} />
        </div>
    )
}
