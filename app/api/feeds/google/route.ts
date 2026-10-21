// Google Merchant Center Product Feed - RSS 2.0 / Atom XML Format
import { getDB } from '@/lib/db'
import { stripHtml } from '@/lib/stripHtml'
import { parseShippingSettings, shippingCost as computeShippingCost } from '@/lib/pricing'
import { absoluteImageUrl, canonicalOrigin, escapeXml, feedPrices, parseImages, productPageUrl } from '@/lib/feeds'

export const dynamic = 'force-dynamic'

interface Product {
    id: number
    name: string
    slug: string
    description: string
    price: number
    original_price: number | null
    stock: number
    images: string
    category: string
    is_active: number
    free_shipping: number | null
    product_code: string | null
}

interface Settings {
    site_name: string
    site_url: string
    currency: string
}

export async function GET() {
    try {
        const db = await getDB()

        // Fetch site settings
        const settingsResults = await db.prepare(
            `SELECT key, value FROM site_settings WHERE key IN ('site_name', 'site_url', 'currency')`
        ).all()

        const settings: Settings = {
            site_name: 'Onopo',
            site_url: 'https://onopostore.com',
            currency: 'TRY'
        }

        if (settingsResults.results) {
            for (const row of settingsResults.results as { key: string, value: string }[]) {
                if (row.key === 'site_name') settings.site_name = row.value
                if (row.key === 'site_url') settings.site_url = row.value
                if (row.key === 'currency') settings.currency = row.value
            }
        }

        // Fetch shipping settings
        const shippingSettings = await db.prepare(
            `SELECT free_shipping_threshold, shipping_cost FROM shipping_settings LIMIT 1`
        ).first()

        const shipping = parseShippingSettings(shippingSettings)

        // Google needs absolute, canonical URLs: https://onopostore.com/<slug>/ and absolute image links
        const origin = canonicalOrigin(settings.site_url)

        // Determine currency
        let currency = 'TRY'
        if (settingsResults.results) {
            const currencySetting = (settingsResults.results as any[]).find(r => r.key === 'currency')
            if (currencySetting) currency = currencySetting.value
        }

        // Fetch all active products with slug
        const { results: products } = await db.prepare(
            `SELECT id, name, slug, description, price, original_price, stock, images, category, is_active, free_shipping, product_code 
             FROM products WHERE is_active = 1 AND stock > 0`
        ).all() as { results: Product[] }

        // Build XML items
        const xmlItems = products.map((product: any) => {
            const images = parseImages(product.images)
            const imageUrl = absoluteImageUrl(images[0], origin)
            const productUrl = productPageUrl(origin, product.slug, product.id)
            const availability = product.stock > 0 ? 'in_stock' : 'out_of_stock'

            // Prices exactly as the checkout charges them (lib/pricing.ts). g:price is the regular price;
            // g:sale_price only when the crossed-out original price is really higher.
            const { price, listPrice } = feedPrices(product.price, product.original_price)

            // Clean description
            const cleanDescription = stripHtml(product.description || '', 5000)

            // Shipping for one unit, as the order API computes it
            const shippingPriceValue = computeShippingCost(price, Number(product.free_shipping) === 1, shipping)

            return `  <item>
    <g:id>${product.id}</g:id>
    <g:title><![CDATA[${escapeCDATA(product.name)}]]></g:title>
    <g:description><![CDATA[${escapeCDATA(cleanDescription)}]]></g:description>
    <g:link>${escapeXml(productUrl)}</g:link>
    <g:image_link>${escapeXml(imageUrl)}</g:image_link>
    <g:brand><![CDATA[${escapeCDATA(settings.site_name)}]]></g:brand>
    <g:condition>new</g:condition>
    <g:availability>${availability}</g:availability>
    <g:price>${(listPrice ?? price).toFixed(2)} ${currency}</g:price>
    <g:shipping>
      <g:country>TR</g:country>
      <g:service>Standard</g:service>
      <g:price>${shippingPriceValue.toFixed(2)} ${currency}</g:price>
    </g:shipping>
    ${listPrice ? `<g:sale_price>${price.toFixed(2)} ${currency}</g:sale_price>` : ''}
    ${product.product_code ? `<g:mpn>${escapeXml(product.product_code)}</g:mpn>` : ''}
  </item>`
        }).join('\n')

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(settings.site_name)} - Ürün Kataloğu</title>
    <link>${origin}</link>
    <description>${escapeXml(settings.site_name)} ürün kataloğu - Google Merchant Center</description>
${xmlItems}
  </channel>
</rss>`

        return new Response(xml, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, max-age=3600'
            }
        })
    } catch (error) {
        console.error('Google Feed Error:', error)
        return new Response('Feed error', { status: 500 })
    }
}

function escapeCDATA(str: string): string {
    return str.replace(/]]>/g, ']]]]><![CDATA[>')
}
