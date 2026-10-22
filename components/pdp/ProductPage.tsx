import * as React from 'react'
import { preload } from 'react-dom'
import Link from 'next/link'
import { ArrowDown, BadgeCheck, BookOpen, ChevronRight, PenLine, RotateCcw, ShieldCheck, Truck } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Badge } from '@/components/ui/badge'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { ProductMachineData } from '@/components/seo/ProductMachineData'
import { ProductCard } from '@/components/product/ProductCard'
import { breadcrumbJsonLd, categoryPath, faqPageJsonLd, productBrand, type SiteSeo } from '@/lib/seo'
import { brandOf, displayName, specChips } from '@/lib/search'
import { guideForProduct, guidePath } from '@/lib/guides'
import { formatDateTR, formatTL } from '@/lib/format'
import { productImageSrcSet, productImageUrl } from '@/lib/images'
import type { ProductPageData } from '@/lib/product-data'
import { getReviewStatsMapSafe } from '@/lib/reviews'
import { buildProductFaq } from '@/lib/product-faq'
import { unitPrice } from '@/lib/pricing'
import { ProductGallery } from './ProductGallery'
import { BuyBox } from './BuyBox'
import { InfoSection } from './InfoSection'
import { ProductFaq } from './ProductFaq'
import { ProductDescription, SpecsTable } from './ProductDescription'
import { ProductRail, ProductRailItem } from './ProductRail'
import { ReviewForm } from './ReviewForm'
import { Stars, formatRating } from './Stars'
import { infoText, parseDescription, type SpecRow } from './description-parser'

const RAIL_SIZES = '(max-width: 639px) 42vw, (max-width: 1023px) 31vw, 290px'
/** Must match MAIN_SIZES in ProductGallery (used for the LCP preload once image variants exist). */
const GALLERY_SIZES = '(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 620px'

function SpecChips({ chips, className }: { chips: string[]; className: string }) {
    return (
        <ul className={`flex-wrap gap-1.5 ${className}`} aria-label="Öne çıkan özellikler">
            {chips.map(c => (
                <li key={c}>
                    <Badge variant="neutral" className="h-7 px-2.5 text-xs">{c}</Badge>
                </li>
            ))}
        </ul>
    )
}

function whatsappLink(numberRaw: string | null | undefined, text: string): string | null {
    const digits = String(numberRaw || '').replace(/\D/g, '')
    if (digits.length < 10) return null
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

/**
 * The product detail page (spec §11), server-rendered: breadcrumb, gallery, title, rating row, buy
 * box, trust points, description / specs / shipping-and-returns, reviews and related products.
 * Machine data for Akakçe and Google (Product JSON-LD + hidden #product-info, BreadcrumbList) is
 * rendered once, here, on the server.
 */
export async function ProductPage({ data, site }: { data: ProductPageData; site: SiteSeo }) {
    const { product, reviews, reviewStats, variations, related, category, shipping, maxInstallments, settings } = data
    const relatedRatings = related.length > 0 ? await getReviewStatsMapSafe() : null
    const soldOut = !product.in_stock
    const parsed = parseDescription(product.description, product.name)
    // One shopping guide that fits the product (lib/guides PRODUCT_GUIDE_ORDER), linked under the description
    const guide = guideForProduct(product)

    // ---- facts -------------------------------------------------------------------------------
    const code = product.product_code
    const specBrand = parsed.specs.find(r => r.label === 'Marka')?.value
    const brand = brandOf(product.name) || specBrand || productBrand(product) || null
    const chips = specChips(product.name, 3)

    const handling = site.handlingTime ? `Siparişler ödeme onayından sonra ${site.handlingTime.minDays}-${site.handlingTime.maxDays} iş günü içinde kargoya verilir.` : null
    const deliveryText = infoText(product.delivery_info) || data.featuresDelivery || handling
    const warrantyText = infoText(product.warranty_info) || null
    const returnPolicy = site.returnPolicy

    const specRows: SpecRow[] = []
    const brandRow = specBrand || productBrand(product)
    if (brandRow) specRows.push({ label: 'Marka', value: brandRow })
    const codeRow = code || parsed.specs.find(r => r.label === 'Ürün kodu')?.value
    if (codeRow) specRows.push({ label: 'Ürün kodu', value: codeRow })
    for (const r of parsed.specs) if (r.label !== 'Marka' && r.label !== 'Ürün kodu') specRows.push(r)
    if (product.category) specRows.push({ label: 'Kategori', value: product.category })
    if (warrantyText) specRows.push({ label: 'Garanti', value: warrantyText })

    const whatsappNumber = product.whatsapp_number || settings.whatsapp_number
    const codeText = code || '-'
    const whatsappHref = product.whatsapp_order_enabled
        ? whatsappLink(
            whatsappNumber,
            soldOut
                ? `Merhaba, ${product.name} (Kod: ${codeText}) ürünü tekrar stoğa girecek mi?`
                : `Merhaba, ${product.name} (Kod: ${codeText}) siparişi vermek istiyorum.`,
        )
        : null

    // ---- visible name: the H1 and the last crumb. A leading "onopo" goes (the eyebrow above the H1 shows the
    // brand: brandOf() is set exactly when the name starts with it) and the casing is fixed (iPhone, USB, 20W).
    // The raw name stays in <title> (productTitle), JSON-LD, #product-info, feeds, alt texts and the cart. ----
    const heading = displayName(product.name)

    // ---- breadcrumb (visible from md + JSON-LD with the same items; the JSON-LD keeps the raw name) ----------
    const crumbCategory = category ? { label: category.name, href: categoryPath(category.slug) } : { label: 'Tüm Ürünler', href: '/products/' }
    const crumbs: Array<{ label: string; href?: string }> = [{ label: 'Anasayfa', href: '/' }, crumbCategory, { label: product.name }]
    const crumbLd = breadcrumbJsonLd(crumbs.map(c => ({ name: c.label, path: c.href })))
    const visibleCrumbs = [...crumbs.slice(0, -1), { label: heading }]

    // ---- rating row: real average when reviews exist, else 5 filled stars "5,0 (0)" (owner decision) ----
    const ratingValue = reviewStats.count > 0 ? reviewStats.average : 5

    // ---- trust points: only claims the shop makes (site settings, CMS shipping page, features) -----
    const trust = [
        { icon: ShieldCheck, title: 'Güvenli ödeme', text: maxInstallments ? 'PayTR · 256-bit SSL' : '256-bit SSL ile şifreli' },
        returnPolicy
            ? { icon: RotateCcw, title: `${returnPolicy.days} gün içinde iade`, text: returnPolicy.freeReturn ? 'Anlaşmalı kargoyla ücretsiz' : 'Kolay iade süreci' }
            : null,
        data.featuresDelivery || handling ? { icon: Truck, title: 'Hızlı kargo', text: data.featuresDelivery || `${site.handlingTime!.minDays}-${site.handlingTime!.maxDays} iş gününde kargoda` } : null,
    ].filter((t): t is NonNullable<typeof t> => Boolean(t))

    // The first gallery image is the LCP element: let the browser fetch it from the <head>
    const lcp = product.images[0]
    if (lcp) {
        const srcSet = productImageSrcSet(lcp, [400, 800, 1200])
        preload(productImageUrl(lcp, 1200), {
            as: 'image',
            fetchPriority: 'high',
            ...(srcSet ? { imageSrcSet: srcSet, imageSizes: GALLERY_SIZES } : {}),
        })
    }

    const threshold = shipping.freeShippingThreshold
    const hasDescription = parsed.blocks.length > 0 || !!parsed.tagline

    // ---- "Sık sorulan sorular": only questions the data answers (lib/product-faq.ts); the FAQPage JSON-LD
    // carries exactly the visible items. Shipping from shipping_settings as read (no defaults), like the JSON-LD.
    const faq = buildProductFaq({
        product: {
            name: product.name,
            price: unitPrice(product.price),
            in_stock: product.in_stock,
            free_shipping: product.free_shipping,
            installment_info: infoText(product.installment_info) || null,
        },
        shipping: { freeShippingThreshold: site.freeShippingThreshold, shippingCost: site.shippingCost },
        handlingTime: site.handlingTime,
        returnPolicy,
        maxInstallments,
    })

    return (
        <>
            {/* Akakçe / Google contract: Product JSON-LD + hidden #product-info, once, server-rendered */}
            <ProductMachineData product={product} site={site} reviews={reviewStats.count > 0 ? reviewStats : null} reviewItems={reviews} />
            <JsonLd data={crumbLd} />
            {faq.length > 0 && <JsonLd data={faqPageJsonLd(faq)} />}
            {data.partial && <div hidden data-onopo-nocache="" />}

            <div className="bg-canvas">
                {/* Phones: no visible breadcrumb (the photo starts right under the header; the BreadcrumbList
                    JSON-LD above stays). From md: one line, li:shrink-0 keeps every crumb whole. */}
                <Container className="hidden pb-3 pt-3 md:block lg:pb-4 lg:pt-5">
                    <Breadcrumb items={visibleCrumbs} className="[&_li]:shrink-0" />
                </Container>

                {/* ---------------- Above the fold ----------------
                    Phones: one column, built so the first screen (390x844) shows the photo (4:3), the title
                    (18px, at most 3 lines), the rating, the price and "Sepete Ekle" + "Hemen Al" (BuyBox puts
                    its info lines under the buttons); trust points and spec chips follow. md–lg (768–1279): two equal columns,
                    the trust points under the gallery so the left column is not an empty strip next to the
                    long info column, and a 22/24px H1 so price, quantity and "Sepete Ekle" fit in the first
                    screen at 1024x768. xl (≥1280): 7/5 with a sticky gallery, trust points under the info. */}
                <Container as="section" aria-labelledby="pdp-title" className="pb-8 lg:pb-14">
                    <div className="md:grid md:grid-cols-2 md:grid-rows-[auto_1fr] md:gap-x-8 md:gap-y-5 lg:gap-x-10 xl:grid-cols-12 xl:gap-x-12">
                        <div className="md:col-start-1 md:row-start-1 md:self-start xl:sticky xl:top-24 xl:col-span-7 xl:row-span-2">
                            <ProductGallery
                                images={product.images}
                                name={product.name}
                                soldOut={soldOut}
                                // The discount is shown once, next to the price (BuyBox)
                                badges={soldOut ? <Badge variant="soldout">Tükendi</Badge> : null}
                            />
                        </div>

                        <div className="mt-3 min-w-0 md:col-start-2 md:row-span-2 md:row-start-1 md:mt-0 xl:col-span-5 xl:col-start-8 xl:row-span-1">
                            {(brand || code) && (
                                <p className="text-xs font-semibold leading-4 tracking-[0.04em] text-muted">
                                    {brand && <span className="uppercase">{brand}</span>}
                                    {brand && code && <span aria-hidden="true"> · </span>}
                                    {/* product codes keep their own case ("trml1", "İPHONE 15") */}
                                    {code && <span>Kod: {code}</span>}
                                </p>
                            )}
                            <h1 id="pdp-title" className="mt-1 text-pretty text-lg font-bold leading-6 tracking-[-0.01em] text-ink max-md:line-clamp-3 md:mt-1.5 md:text-[22px] md:leading-[30px] lg:text-2xl lg:leading-8 xl:text-[28px] xl:leading-9">
                                {heading}
                            </h1>

                            <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm leading-5 md:mt-2">
                                <a href="#yorumlar" className="-my-2 inline-flex min-h-11 items-center gap-1.5 rounded-thumb text-ink hover:underline hover:underline-offset-4">
                                    <Stars value={ratingValue} className="text-[15px]" />
                                    <span className="font-semibold tabular-nums">{formatRating(ratingValue)}</span>
                                    <span className="text-muted tabular-nums">
                                        ({reviewStats.count}<span className="sr-only"> değerlendirme</span>)
                                    </span>
                                </a>
                                <span className="h-4 w-px bg-line-strong" aria-hidden="true" />
                                <a href="#yorum-yaz" className="-my-2 inline-flex min-h-11 items-center rounded-thumb font-semibold text-brand-600 underline-offset-4 hover:text-brand-700 hover:underline">
                                    Yorum yaz
                                </a>
                            </div>

                            {/* Spec chips: here from md, under the buy box on phones (one copy is display:none) */}
                            {chips.length > 0 && <SpecChips chips={chips} className="mt-2 hidden md:flex" />}

                            {/* Phones: 12px rhythm so price and buttons fit in the first screen.
                                1024–1279: 4px tighter rhythm here and in BuyBox so the CTA row stays in a 1024x768 first screen */}
                            <div className="mt-3 border-t border-line pt-3 md:mt-5 md:pt-5 lg:mt-4 lg:pt-4 xl:mt-5 xl:pt-5">
                                <BuyBox
                                    product={{
                                        id: product.id,
                                        name: product.name,
                                        slug: product.slug,
                                        price: product.price,
                                        original_price: product.original_price,
                                        stock: product.stock,
                                        image: product.image,
                                        category: product.category,
                                        free_shipping: product.free_shipping,
                                    }}
                                    variations={variations.map(v => ({ id: v.id, name: v.name, value: v.value, price_modifier: v.price_modifier, stock: v.stock, image_url: v.image_url }))}
                                    freeShippingThreshold={threshold}
                                    maxInstallments={maxInstallments}
                                    installmentInfo={infoText(product.installment_info) || null}
                                    deliveryText={deliveryText}
                                    whatsappHref={whatsappHref}
                                />
                            </div>

                            {chips.length > 0 && <SpecChips chips={chips} className="mt-4 flex md:hidden" />}

                            {soldOut && related.length > 0 && (
                                <a href="#benzer-urunler" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-600 underline-offset-4 hover:text-brand-700 hover:underline">
                                    Benzer ürünlere göz at <ArrowDown className="h-4 w-4" aria-hidden="true" />
                                </a>
                            )}
                        </div>

                        {trust.length > 0 && (
                            <ul className="mt-5 min-w-0 divide-y divide-line self-start rounded-card border border-line md:col-start-1 md:row-start-2 md:mt-0 xl:col-span-5 xl:col-start-8">
                                {trust.map(t => (
                                    <li key={t.title} className="flex items-center gap-3 px-4 py-3">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
                                            <t.icon className="h-[18px] w-[18px]" />
                                        </span>
                                        <span className="min-w-0 text-sm leading-5">
                                            <span className="block font-semibold text-ink">{t.title}</span>
                                            <span className="block text-[13px] text-muted">{t.text}</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </Container>

                {/* ---------------- Details ---------------- */}
                <div className="border-t border-line">
                    <Container className="lg:section-y">
                        <div className="lg:grid lg:grid-cols-2 lg:gap-10 xl:grid-cols-12 xl:gap-12">
                            <div className="min-w-0 xl:col-span-7">
                                {hasDescription ? (
                                    <InfoSection id="aciklama" title="Ürün açıklaması" defaultOpen>
                                        <ProductDescription tagline={parsed.tagline} blocks={parsed.blocks} />
                                    </InfoSection>
                                ) : (
                                    <InfoSection id="ozellikler" title="Teknik özellikler" defaultOpen>
                                        <SpecsTable rows={specRows} />
                                    </InfoSection>
                                )}
                                {guide && (
                                    <Link
                                        href={guidePath(guide.slug)}
                                        prefetch={false}
                                        className="group my-4 flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 transition-colors duration-150 hover:border-brand-100 hover:bg-brand-50 lg:mb-0 lg:mt-8"
                                    >
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 shadow-card" aria-hidden="true">
                                            <BookOpen className="h-[18px] w-[18px]" strokeWidth={1.75} />
                                        </span>
                                        <span className="min-w-0 flex-1 text-sm leading-5">
                                            <span className="block text-[13px] text-muted">İlgili rehber</span>
                                            <span className="block font-semibold text-ink group-hover:text-brand-700">{guide.title}</span>
                                        </span>
                                        <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
                                    </Link>
                                )}
                            </div>
                            <div className="min-w-0 lg:flex lg:flex-col lg:gap-10 xl:col-span-5">
                                {hasDescription && specRows.length > 0 && (
                                    <InfoSection id="ozellikler" title="Teknik özellikler">
                                        <SpecsTable rows={specRows} />
                                    </InfoSection>
                                )}
                                {/* The last row: the reviews section's top border closes it (no double hairline) */}
                                <InfoSection id="kargo-iade" title="Kargo ve iade" className="border-b-0">
                                    <dl className="flex flex-col gap-4 text-sm leading-6 text-ink-2">
                                        {deliveryText && (
                                            <div>
                                                <dt className="font-semibold text-ink">Teslimat</dt>
                                                <dd>{deliveryText}</dd>
                                            </div>
                                        )}
                                        <div>
                                            <dt className="font-semibold text-ink">Kargo ücreti</dt>
                                            <dd>
                                                {product.free_shipping
                                                    ? 'Bu üründe kargo bedava.'
                                                    : threshold > 0
                                                        ? `${formatTL(threshold)} ve üzeri siparişlerde kargo bedava. Altındaki siparişlerde kargo ücreti ${formatTL(shipping.shippingCost)}.`
                                                        : `Kargo ücreti ${formatTL(shipping.shippingCost)}.`}
                                            </dd>
                                        </div>
                                        {returnPolicy && (
                                            <div>
                                                <dt className="font-semibold text-ink">İade</dt>
                                                <dd>
                                                    Teslimattan itibaren {returnPolicy.days} gün içinde iade talebinde bulunabilirsin.
                                                    {returnPolicy.freeReturn && ' Anlaşmalı kargo firmasıyla gönderilen iadelerde kargo ücretini biz karşılarız.'}
                                                </dd>
                                            </div>
                                        )}
                                        {warrantyText && (
                                            <div>
                                                <dt className="font-semibold text-ink">Garanti</dt>
                                                <dd>{warrantyText}</dd>
                                            </div>
                                        )}
                                    </dl>
                                    <Link href="/page/shipping/" prefetch={false} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand-600 underline-offset-4 hover:text-brand-700 hover:underline">
                                        Kargo ve iade koşullarının tamamı
                                    </Link>
                                </InfoSection>
                            </div>
                        </div>
                    </Container>
                </div>

                {/* ---------------- FAQ ---------------- */}
                <ProductFaq items={faq} />

                {/* ---------------- Reviews ---------------- */}
                <section id="yorumlar" aria-labelledby="yorumlar-baslik" className="scroll-mt-24 border-t border-line">
                    <Container className="section-y">
                        {/* One tree for both states, so the review form keeps its state when the list appears after a post */}
                        <div className={reviewStats.count > 0 ? 'lg:grid lg:grid-cols-12 lg:gap-12' : undefined}>
                            <div className={reviewStats.count > 0 ? 'lg:col-span-4' : 'max-w-2xl'}>
                                <h2 id="yorumlar-baslik" className="type-h2 text-ink">
                                    Değerlendirmeler <span className="font-semibold text-muted tabular-nums">({reviewStats.count})</span>
                                </h2>
                                {reviewStats.count > 0 ? (
                                    <div className="mt-4 flex items-center gap-4 rounded-card bg-surface p-4">
                                        <p className="text-[40px] font-extrabold leading-none tracking-tight text-ink tabular-nums">
                                            {formatRating(reviewStats.average)}
                                            <span className="sr-only"> / 5</span>
                                        </p>
                                        <div>
                                            <Stars value={reviewStats.average} className="text-lg" />
                                            <p className="mt-1 text-sm text-muted">{reviewStats.count} değerlendirme</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-4 flex items-start gap-3 rounded-card bg-surface p-4">
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 shadow-card" aria-hidden="true">
                                            <PenLine className="h-5 w-5" />
                                        </span>
                                        <div>
                                            <p className="font-semibold text-ink">Bu ürün için henüz değerlendirme yok</p>
                                            <p className="mt-0.5 text-sm leading-5 text-muted">Ürünü aldıysan deneyimini paylaş, diğer alışverişçilere yardımcı ol.</p>
                                        </div>
                                    </div>
                                )}
                                <div className="mt-4">
                                    <ReviewForm productId={product.id} hasReviews={reviewStats.count > 0} />
                                </div>
                            </div>

                            {reviewStats.count > 0 && (
                                <ul className="mt-6 flex flex-col divide-y divide-line lg:col-span-8 lg:mt-0">
                                    {reviews.map(r => (
                                        <li key={r.id} className="py-5 first:pt-0 lg:first:pt-1">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700" aria-hidden="true">
                                                        {r.author.charAt(0).toLocaleUpperCase('tr-TR')}
                                                    </span>
                                                    <div>
                                                        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-ink">
                                                            {r.author}
                                                            {r.verified && (
                                                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                                                                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                                                    Doğrulanmış alıcı
                                                                </span>
                                                            )}
                                                        </p>
                                                        {r.created_at && <p className="text-xs text-muted">{formatDateTR(r.created_at)}</p>}
                                                    </div>
                                                </div>
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Stars value={r.rating} className="text-sm" />
                                                    <span className="sr-only">5 üzerinden {r.rating} puan</span>
                                                </span>
                                            </div>
                                            {r.comment && <p className="mt-3 max-w-[68ch] whitespace-pre-line break-words text-[15px] leading-6 text-ink-2">{r.comment}</p>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </Container>
                </section>

                {/* ---------------- Related ---------------- */}
                {related.length > 0 && (
                    <section id="benzer-urunler" aria-labelledby="benzer-baslik" className="scroll-mt-24 bg-surface">
                        <Container className="section-y">
                            <SectionHeader
                                id="benzer-baslik"
                                title="Benzer ürünler"
                                href={category ? categoryPath(category.slug) : '/products/'}
                                linkLabel="Tümünü gör"
                            />
                            <ProductRail label="Benzer ürünler">
                                {related.map(p => (
                                    <ProductRailItem key={p.id}>
                                        <ProductCard product={p} freeShippingThreshold={threshold} rating={relatedRatings ? relatedRatings.get(p.id) ?? null : undefined} sizes={RAIL_SIZES} headingLevel="h3" />
                                    </ProductRailItem>
                                ))}
                            </ProductRail>
                        </Container>
                    </section>
                )}
            </div>
        </>
    )
}

export default ProductPage
