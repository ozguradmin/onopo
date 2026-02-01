// Google Merchant Center Product Feed - RSS 2.0 / Atom XML Format
import { getDB } from '@/lib/db'
import { stripHtml } from '@/lib/stripHtml'

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

        // Fetch all active products with slug
        const { results: products } = await db.prepare(
            `SELECT id, name, slug, description, price, original_price, stock, images, category, is_active, free_shipping, product_code 
             FROM products WHERE is_active = 1 AND stock > 0`
        ).all() as { results: Product[] }

        // Build Google Merchant XML feed
        const xmlItems = products.map(product => {
            const images = product.images ? JSON.parse(product.images) : []
            const imageUrl = images[0] || ''
            const availability = product.stock > 0 ? 'in_stock' : 'out_of_stock'
            const condition = 'new'
            // Use slug-based URL for proper SEO
            const productUrl = `${settings.site_url}/${product.slug}`

            // Clean description - remove HTML and limit length
            const cleanDescription = stripHtml(product.description || '', 5000)

            return `    <item>
      <g:id>${product.id}</g:id>
      <g:title><![CDATA[${escapeCDATA(product.name)}]]></g:title>
      <g:description><![CDATA[${escapeCDATA(cleanDescription)}]]></g:description>
      <g:link>${productUrl}</g:link>
      <g:image_link>${imageUrl}</g:image_link>
      <g:availability>${availability}</g:availability>
      <g:price>${product.price.toFixed(2)} ${settings.currency}</g:price>
      ${product.original_price && product.original_price > product.price ? `<g:sale_price>${product.price.toFixed(2)} ${settings.currency}</g:sale_price>` : ''}
      <g:condition>${condition}</g:condition>
      <g:brand><![CDATA[${escapeCDATA(settings.site_name)}]]></g:brand>
      <g:product_type><![CDATA[${escapeCDATA(product.category || 'Genel')}]]></g:product_type>
      ${product.product_code ? `<g:mpn>${escapeXml(product.product_code)}</g:mpn>` : ''}
      ${product.free_shipping ? '<g:shipping><g:price>0 TRY</g:price></g:shipping>' : ''}
    </item>`
        }).join('\n')

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(settings.site_name)} - Ürün Kataloğu</title>
    <link>${settings.site_url}</link>
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

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

function escapeCDATA(str: string): string {
    return str.replace(/]]>/g, ']]]]><![CDATA[>')
}
