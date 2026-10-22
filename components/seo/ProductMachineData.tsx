import { JsonLd } from './JsonLd'
import { productInfoHtml, productJsonLd, type ProductSeoInput, type ReviewJsonLdInput, type ReviewStats, type SiteSeo } from '@/lib/seo'

/**
 * Machine-readable product data that Akakçe's crawler (and Google) read from the server HTML of /<slug>/:
 * the Product JSON-LD (pretty-printed, as today) and the hidden #product-info block.
 * Every product page must render this once, on the server. See docs/SEO.md, "Akakçe crawl contract".
 *
 *   const site = await getSiteSeo()
 *   <ProductMachineData product={product} site={site} reviews={{ count, average }} reviewItems={reviews} />
 *
 * `product` is the products row (images as stored: JSON string or array). Prices are rounded with
 * roundPrice() exactly like checkout (app/api/orders/route.ts), so JSON-LD, the hidden block and the
 * charged amount agree. `reviewItems` (the real reviews, newest first) add up to 5 `review` entries next to
 * aggregateRating; both are left out when there are no reviews.
 */
export function ProductMachineData({
    product,
    site,
    reviews,
    reviewItems,
}: {
    product: ProductSeoInput
    site?: SiteSeo
    reviews?: ReviewStats | null
    reviewItems?: ReviewJsonLdInput[] | null
}) {
    return (
        <>
            <JsonLd data={productJsonLd(product, { site, reviews, reviewItems })} pretty />
            <div id="product-info" style={{ display: 'none' }} dangerouslySetInnerHTML={{ __html: productInfoHtml(product) }} />
        </>
    )
}

export default ProductMachineData
