import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { ProductRail } from '@/components/home/ProductRail'
import { GuideBody, GuideFaqList, GuideToc, InlineText } from '@/components/guides/GuideBody'
import { GuideCards } from '@/components/guides/GuideCards'
import { GuideArt } from '@/components/guides/GuideArt'
import { getShippingSettings } from '@/lib/catalog'
import { GUIDES, GUIDES_PATH, formatGuideDate, getGuide, guidePath, guideReadingMinutes, parseInlineLinks } from '@/lib/guides'
import { getGuideImages, getGuideProducts } from '@/lib/guides/server'
import { absoluteImageUrl } from '@/lib/images'
import { articleJsonLd, buildMetadata, faqPageJsonLd, itemListJsonLd, productPath } from '@/lib/seo'
import { getSiteSeo } from '@/lib/seo-server'
import { normalizeSlugParam } from '@/lib/seo-routing'

/**
 * /rehber/<slug>/: one shopping guide (text from lib/guides/content, related products live from D1).
 * An unknown slug is a real 404 (never guessed: lib/redirects.ts does not fuzzy-match under /rehber/);
 * another case of a known slug is a 308 to it. No loading.tsx / Suspense: the status is decided first.
 * The header picture, og:image and the Article image are our own photos of the guide's in-stock products
 * (lib/guides selectGuideImages); the "Diğer rehberler" cards get theirs the same way.
 */
type Params = Promise<{ slug: string }>

function plain(text: string): string {
    return parseInlineLinks(text).map(p => (typeof p === 'string' ? p : p.label)).join('')
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const guide = getGuide(normalizeSlugParam((await params).slug) ?? '')
    if (!guide) return { title: 'Sayfa bulunamadı', robots: { index: false, follow: true } }
    const [site, { images }] = await Promise.all([getSiteSeo(), getGuideImages()])
    return buildMetadata({
        title: guide.title,
        description: guide.description,
        path: guidePath(guide.slug),
        type: 'article',
        images: (images[guide.slug] ?? []).map(p => ({ url: absoluteImageUrl(p.image), alt: p.alt })),
        site,
    })
}

export default async function GuidePage({ params }: { params: Params }) {
    const slug = normalizeSlugParam((await params).slug) ?? ''
    const guide = getGuide(slug)
    if (!guide) {
        const lower = getGuide(slug.toLowerCase())
        if (lower) permanentRedirect(guidePath(lower.slug))
        notFound()
    }

    const [{ products, failed }, guideImages, shipping, site] = await Promise.all([getGuideProducts(guide), getGuideImages(), getShippingSettings(), getSiteSeo()])
    const others = GUIDES.filter(g => g.slug !== guide.slug)
    const path = guidePath(guide.slug)
    const photos = guideImages.images[guide.slug] ?? []
    const jsonLd = [
        articleJsonLd({
            headline: guide.title,
            description: guide.description,
            path,
            datePublished: guide.datePublished,
            dateModified: guide.dateModified,
            // Originals, like every JSON-LD image (lib/images)
            images: photos.map(p => absoluteImageUrl(p.image)),
        }, site),
        guide.faq.length > 0 ? faqPageJsonLd(guide.faq.map(f => ({ question: f.q, answer: plain(f.a) }))) : null,
        products.length > 0 ? itemListJsonLd(products.map(p => ({ path: productPath(p.slug), name: p.name })), { name: guide.productsTitle }) : null,
    ]

    return (
        <div className="bg-canvas pb-14 pt-4 lg:pb-16 lg:pt-6">
            {/* The products could not be read: this render must not be edge-cached */}
            {(failed || guideImages.failed) && <div hidden data-onopo-nocache="" />}
            <div className="container-store">
                <Breadcrumb jsonLd items={[{ label: 'Anasayfa', href: '/' }, { label: 'Rehberler', href: GUIDES_PATH }, { label: guide.title }]} />

                <div className="mt-5 lg:mt-8 lg:grid lg:grid-cols-12 lg:gap-12">
                    <article className="min-w-0 lg:col-span-8">
                        <header className="max-w-[68ch] border-b border-line pb-5 lg:pb-6">
                            <p className="type-micro text-brand-600">Alışveriş rehberi</p>
                            <h1 className="type-h1 mt-1.5 text-ink">{guide.title}</h1>
                            <p className="mt-3 text-base leading-7 text-ink-2 lg:text-[17px] lg:leading-7">
                                <InlineText text={guide.intro} />
                            </p>
                            <p className="mt-3 text-[13px] text-muted">
                                Güncelleme: <time dateTime={guide.dateModified}>{formatGuideDate(guide.dateModified)}</time>
                                {' · '}
                                {guideReadingMinutes(guide)} dk okuma
                            </p>
                            <GuideArt images={photos} variant="hero" eager className="mt-5" />
                        </header>

                        <GuideToc sections={guide.sections} faq={guide.faq.length > 0} className="mt-6 rounded-sheet border border-line bg-surface px-4 py-3 lg:hidden" />

                        <div className="mt-8 max-w-[68ch]">
                            <GuideBody sections={guide.sections} />
                            <GuideFaqList items={guide.faq} />
                        </div>
                    </article>

                    <aside className="hidden lg:col-span-4 lg:block">
                        <GuideToc sections={guide.sections} faq={guide.faq.length > 0} className="sticky top-[88px] rounded-sheet border border-line bg-surface px-5 py-4" />
                    </aside>
                </div>
            </div>

            {products.length > 0 && (
                <ProductRail
                    id="rehber-urunler"
                    title={guide.productsTitle}
                    products={products}
                    freeShippingThreshold={shipping.freeShippingThreshold}
                    compact
                    className="mt-12 lg:mt-16"
                />
            )}

            <section aria-labelledby="diger-rehberler" className="container-store mt-12 lg:mt-16">
                <SectionHeader id="diger-rehberler" title="Diğer rehberler" href={GUIDES_PATH} linkLabel="Tüm rehberler" />
                <GuideCards guides={others} images={guideImages.images} headingLevel="h3" />
            </section>

            <JsonLd data={jsonLd} />
        </div>
    )
}
