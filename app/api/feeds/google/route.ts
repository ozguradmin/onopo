// Google Merchant Center Product Feed - RSS 2.0 XML (items: lib/google-feed.ts)
import { getDB } from '@/lib/db'
import { parseShippingSettings } from '@/lib/pricing'
import { canonicalOrigin } from '@/lib/feeds'
import { googleFeedXml, type GoogleFeedProduct } from '@/lib/google-feed'
import { hasGtinColumn } from '@/lib/gtin'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const db = await getDB()

        // Fetch site settings
        const settingsResults = await db.prepare(
            `SELECT key, value FROM site_settings WHERE key IN ('site_name', 'site_url', 'currency')`
        ).all()

        const settings = {
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

        // Google needs absolute, canonical URLs: https://onopostore.com/<slug>/ and absolute image links
        const origin = canonicalOrigin(settings.site_url)

        // Every active product, sold-out ones too (g:availability out_of_stock). products.gtin only once
        // migrations/2026-10-22-product-gtin.sql has run.
        const gtinColumn = (await hasGtinColumn(db)) ? ', gtin' : ''
        const { results: products } = await db.prepare(
            `SELECT id, name, slug, description, price, original_price, stock, images, category, free_shipping, product_code${gtinColumn}
             FROM products WHERE is_active = 1 ORDER BY id ASC`
        ).all() as { results: GoogleFeedProduct[] }

        const xml = googleFeedXml(products ?? [], {
            origin,
            siteName: settings.site_name,
            brand: settings.site_name,
            currency: settings.currency || 'TRY',
            shipping: parseShippingSettings(shippingSettings),
        })

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
