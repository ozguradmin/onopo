import type { Metadata } from 'next'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { resolveSlugCached } from '@/lib/seo-routing'
import { SITE_URL, buildMetadata, productMetaDescription, productPath, productTitle } from '@/lib/seo'
import { getSiteSeo } from '@/lib/seo-server'
import { getProductPageData } from '@/lib/product-data'
import { IMAGE_VARIANTS_ENABLED, imageKey } from '@/lib/images'
import { ProductPage } from '@/components/pdp/ProductPage'

/**
 * /<slug>/ — the canonical product URL (Akakçe, both feeds, the sitemap and JSON-LD use it).
 *
 * Resolution (lib/seo-routing.ts, docs/SEO.md §5), always before anything else is awaited:
 *   active product            → render (200)
 *   other case of the slug    → 308 to the canonical slug
 *   old / renamed slug        → 307 to the fuzzy match
 *   category slug             → 308 /kategori/<slug>/
 *   /tech/ /gaming/ /beauty/ /new/ → 308 to their replacement listing
 *   CMS page slug             → 308 /page/<slug>/
 *   inactive product, unknown slug, file-like names (x.png, manifest.json) → notFound() (real 404)
 *
 * No loading.tsx and no <Suspense> around the page: a streamed shell would freeze the status at 200,
 * so notFound()/redirects could no longer answer 404/308. A D1 failure throws (500, never cached).
 */

type Props = { params: Promise<{ slug: string }> }

/**
 * og:image / twitter:image = the product's first image. Originals are up to 8 MB, too big for link previews, so
 * with image variants on it is the absolute /api/og-image/<key> URL: that route redirects to the 1200w WebP
 * variant when it exists in R2 and to the original otherwise (images uploaded without variants keep a working
 * WhatsApp/Facebook preview). Variants off, or an image outside R2: the stored URL, exactly as before.
 */
function ogImageUrl(stored: string): string {
    const key = IMAGE_VARIANTS_ENABLED ? imageKey(stored) : null
    if (!key) return stored
    return `${SITE_URL}/api/og-image/${key.split('/').map(encodeURIComponent).join('/')}`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const r = await resolveSlugCached((await params).slug)
    if (!r || r.kind !== 'product' || r.redirect) return {} // the page redirects or answers 404
    const data = await getProductPageData(r.id)
    if (!data) return {}
    const { product } = data
    const site = await getSiteSeo()
    // og:image / twitter:image = the product's first image (ogImageUrl above). Its pixel size is not stored
    // anywhere (variants keep the original's aspect ratio and never upscale), so no og:image:width/height.
    // JSON-LD and the feeds keep the originals.
    const ogImage = product.images[0]
    return buildMetadata({
        title: productTitle(product.name),
        description: productMetaDescription(product, site),
        path: productPath(product.slug),
        images: ogImage ? [{ url: ogImageUrl(ogImage), alt: product.name }] : undefined,
        site,
    })
}

export default async function SlugPage({ params }: Props) {
    const r = await resolveSlugCached((await params).slug)
    if (!r) notFound()
    if (r.kind !== 'product') permanentRedirect(r.path)
    if (r.redirect === 'permanent') permanentRedirect(r.path)
    if (r.redirect === 'temporary') redirect(r.path)

    const data = await getProductPageData(r.id)
    if (!data) notFound() // deactivated between the two reads

    const site = await getSiteSeo()
    return <ProductPage data={data} site={site} />
}
