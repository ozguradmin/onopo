import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { JsonLd } from '@/components/seo/JsonLd'
import { GuideCards } from '@/components/guides/GuideCards'
import { GUIDES, GUIDES_HUB, GUIDES_PATH, guidePath } from '@/lib/guides'
import { buildMetadata, itemListJsonLd } from '@/lib/seo'
import { getSiteSeo } from '@/lib/seo-server'

/**
 * /rehber/: the shopping guides hub. The texts live in code (lib/guides), so this page needs no database read
 * of its own; the footer, /kategoriler/ and product pages link here.
 */
export async function generateMetadata(): Promise<Metadata> {
    const site = await getSiteSeo()
    return buildMetadata({
        title: GUIDES_HUB.title,
        description: GUIDES_HUB.description,
        path: GUIDES_PATH,
        site,
    })
}

export default function GuidesHubPage() {
    return (
        <div className="bg-canvas pb-14 pt-4 lg:pb-16 lg:pt-6">
            <div className="container-store">
                <Breadcrumb jsonLd items={[{ label: 'Anasayfa', href: '/' }, { label: 'Rehberler' }]} />
                <header className="mt-3 max-w-[68ch]">
                    <h1 className="type-h1 text-ink">Alışveriş rehberleri</h1>
                    <p className="mt-2 text-[15px] leading-6 text-muted">
                        Şarj aleti, kablo, ekran koruyucu, araç şarjı ve powerbank alırken nelere bakmalı? Kısa ve sade
                        rehberlerimizle doğru ürünü seçin.
                    </p>
                </header>
                <GuideCards guides={GUIDES} className="mt-6 lg:mt-8" />
            </div>
            <JsonLd data={itemListJsonLd(GUIDES.map(g => ({ path: guidePath(g.slug), name: g.title })), { name: GUIDES_HUB.title })} />
        </div>
    )
}
