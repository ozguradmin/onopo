/**
 * Google Merchant Center feed items (app/api/feeds/google/route.ts). Pure: the route reads D1 and passes rows
 * and settings in, the tests call it directly.
 *
 * Per product:
 *  - every ACTIVE product, sold-out ones too with g:availability out_of_stock (Merchant keeps the offer and its
 *    history instead of dropping and re-adding it)
 *  - g:image_link = first image, g:additional_image_link = up to 10 more (absolute, same rule as image_link)
 *  - g:gtin only for a valid GS1 barcode (products.gtin, lib/gtin.ts); g:mpn = product_code;
 *    g:identifier_exists no only when there is neither (Google then does not expect one)
 *  - g:product_type = our category > product type ("Cep Telefonu Aksesuarları > Şarj Kablosu"); a selection
 *    category such as "Çok Satanlar" is not a type, so only the product type is used then
 *  - g:google_product_category = numeric id from Google's taxonomy (taxonomy-with-ids.en-US.txt, version
 *    2021-09-21), only where the product type is unambiguous; left out otherwise
 *  - no g:product_highlight / g:product_detail: the only structured product data (ai_product_facts) is
 *    AI-written free text, not reliable enough for Merchant attributes
 */
import { absoluteImageUrl, escapeXml, feedPrices, parseImages, productPageUrl } from './feeds'
import { normalizeGtin, isValidGtin } from './gtin'
import { shippingCost as computeShippingCost, type ShippingSettings } from './pricing'
import { foldTr, isMerchandisingCategory } from './seo'
import { stripHtml } from './stripHtml'

export interface GoogleFeedProduct {
    id: number
    name: string
    slug: string | null
    description: string | null
    price: number
    original_price: number | null
    stock: number
    images: string | null
    category: string | null
    free_shipping: number | null
    product_code: string | null
    gtin?: string | null
}

export interface GoogleFeedContext {
    origin: string
    brand: string
    currency: string
    shipping: ShippingSettings
}

/** Extra images after image_link (Google accepts up to 10). */
export const ADDITIONAL_IMAGE_LIMIT = 10

interface TypeRule {
    test: RegExp
    /** Turkish product type for g:product_type. */
    type: string
    /** Google product taxonomy id, or null when no category fits for sure. */
    google: number | null
}

// Checked in order on the Turkish-folded name; the first match wins. Google ids (taxonomy 2021-09-21):
//   5468   Electronics > Electronics Accessories > Electronics Films & Shields > Screen Protectors
//   505295 Electronics > Electronics Accessories > Power > Power Adapters & Chargers
//   543626 Electronics > Audio > Audio Components > Headphones & Headsets > Headphones
//   1867   Electronics > Electronics Accessories > Cables > Audio & Video Cables
//   259    Electronics > Electronics Accessories > Cables
//   618    Home & Garden > Household Appliance Accessories > Vacuum Accessories
//   619    Home & Garden > Household Appliances > Vacuums
//   500106 Electronics > Print, Copy, Scan & Fax > Printers, Copiers & Fax Machines
//   8008   Electronics > Electronics Accessories > Computer Components > Input Device Accessories > Game Controller Accessories
//   301    Electronics > Electronics Accessories > Computer Components > Input Devices > Game Controllers
const TYPE_RULES: TypeRule[] = [
    { test: /ekran koruyucu/, type: 'Ekran Koruyucu', google: 5468 },
    { test: /arac sarj/, type: 'Araç Şarj Cihazı', google: 505295 },
    { test: /powerbank|power bank/, type: 'Powerbank', google: 505295 },
    { test: /kulaklik/, type: 'Kulaklık', google: 543626 },
    { test: /\baux\b/, type: 'Ses Kablosu', google: 1867 },
    // Before the cable rule: "Şarj Aleti Seti Esnek Kablo", "Şarj Cihazı Adaptör + Şarj Kablosu" are chargers
    { test: /sarj (aleti|cihazi|adaptoru|basligi)/, type: 'Şarj Aleti', google: 505295 },
    { test: /\bkablo(su)?\b/, type: 'Şarj ve Data Kablosu', google: 259 },
    { test: /supurge.*(filtre|hazne|aparat)|hepa filtre|toz haznesi/, type: 'Süpürge Yedek Parçası', google: 618 },
    { test: /supurge/, type: 'El Süpürgesi', google: 619 },
    { test: /yazici/, type: 'Taşınabilir Yazıcı', google: 500106 },
    { test: /(oyun|gamepad|pubg).*(donusturucu|adaptor)|(donusturucu|adaptor).*(oyun|gamepad|pubg)/, type: 'Mobil Oyun Aksesuarı', google: 8008 },
    { test: /gamepad|oyun kumandasi|denetleyici|joystick/, type: 'Oyun Kumandası', google: 301 },
    { test: /oyun|pubg/, type: 'Mobil Oyun Aksesuarı', google: null },
]

/** Product type and Google category for a product name, or null when no rule matches. */
export function classifyProduct(name: string): { type: string; google: number | null } | null {
    const folded = foldTr(name || '').replace(/[^a-z0-9+.\s]/g, ' ').replace(/\s+/g, ' ')
    const rule = TYPE_RULES.find(r => r.test.test(folded))
    return rule ? { type: rule.type, google: rule.google } : null
}

/** g:product_type: "<category> > <type>", or just one of them (a selection category like "Çok Satanlar" is dropped). */
export function productTypePath(category: string | null | undefined, name: string): string | null {
    const cat = String(category ?? '').trim()
    const usableCategory = cat && !isMerchandisingCategory(cat) ? cat : ''
    const type = classifyProduct(name)?.type ?? ''
    if (usableCategory && type) return `${usableCategory} > ${type}`
    return usableCategory || type || null
}

function cdata(text: string): string {
    return `<![CDATA[${String(text).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

/** One <item> of the feed. */
export function googleFeedItem(product: GoogleFeedProduct, ctx: GoogleFeedContext): string {
    const images = parseImages(product.images).map(img => absoluteImageUrl(img, ctx.origin)).filter(Boolean)
    const productUrl = productPageUrl(ctx.origin, product.slug, product.id)
    const availability = Number(product.stock) > 0 ? 'in_stock' : 'out_of_stock'
    // Prices exactly as the checkout charges them (lib/pricing.ts). g:price is the regular price;
    // g:sale_price only when the crossed-out original price is really higher.
    const { price, listPrice } = feedPrices(product.price, product.original_price)
    // Shipping for one unit, as the order API computes it
    const shippingPrice = computeShippingCost(price, Number(product.free_shipping) === 1, ctx.shipping)
    const gtin = normalizeGtin(product.gtin)
    const validGtin = isValidGtin(gtin) ? gtin : null
    const mpn = String(product.product_code ?? '').trim()
    const type = productTypePath(product.category, product.name)
    const google = classifyProduct(product.name)?.google ?? null

    const lines = [
        `    <g:id>${product.id}</g:id>`,
        `    <g:title>${cdata(product.name)}</g:title>`,
        `    <g:description>${cdata(stripHtml(product.description || '', 5000))}</g:description>`,
        `    <g:link>${escapeXml(productUrl)}</g:link>`,
        `    <g:image_link>${escapeXml(images[0] ?? '')}</g:image_link>`,
        ...images.slice(1, 1 + ADDITIONAL_IMAGE_LIMIT).map(url => `    <g:additional_image_link>${escapeXml(url)}</g:additional_image_link>`),
        `    <g:brand>${cdata(ctx.brand)}</g:brand>`,
        `    <g:condition>new</g:condition>`,
        `    <g:availability>${availability}</g:availability>`,
        `    <g:price>${(listPrice ?? price).toFixed(2)} ${escapeXml(ctx.currency)}</g:price>`,
        ...(listPrice ? [`    <g:sale_price>${price.toFixed(2)} ${escapeXml(ctx.currency)}</g:sale_price>`] : []),
        `    <g:shipping>`,
        `      <g:country>TR</g:country>`,
        `      <g:service>Standard</g:service>`,
        `      <g:price>${shippingPrice.toFixed(2)} ${escapeXml(ctx.currency)}</g:price>`,
        `    </g:shipping>`,
        ...(validGtin ? [`    <g:gtin>${validGtin}</g:gtin>`] : []),
        ...(mpn ? [`    <g:mpn>${escapeXml(mpn)}</g:mpn>`] : []),
        ...(!validGtin && !mpn ? ['    <g:identifier_exists>no</g:identifier_exists>'] : []),
        ...(type ? [`    <g:product_type>${cdata(type)}</g:product_type>`] : []),
        ...(google ? [`    <g:google_product_category>${google}</g:google_product_category>`] : []),
    ]
    return `  <item>\n${lines.join('\n')}\n  </item>`
}

/** The whole RSS 2.0 document. */
export function googleFeedXml(products: GoogleFeedProduct[], ctx: GoogleFeedContext & { siteName: string }): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(ctx.siteName)} - Ürün Kataloğu</title>
    <link>${escapeXml(ctx.origin)}</link>
    <description>${escapeXml(ctx.siteName)} ürün kataloğu - Google Merchant Center</description>
${products.map(p => googleFeedItem(p, ctx)).join('\n')}
  </channel>
</rss>`
}
