import { getDB } from '@/lib/db'
import { NextResponse } from 'next/server'
import { stripHtml } from '@/lib/stripHtml'
import { parseShippingSettings, shippingCost as computeShippingCost } from '@/lib/pricing'
import { absoluteImageUrl, canonicalOrigin, escapeXml as escapeXmlText, feedPrices, parseImages, productPageUrl } from '@/lib/feeds'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const db = await getDB()
        // free_shipping exists (the order API and the other feeds read it); needed for the shipping price
        const { results } = await db.prepare(`
            SELECT id, name, slug, description, price, original_price, images, category, stock, product_code, free_shipping
            FROM products
            WHERE is_active = 1 AND stock > 0
        `).all() as { results: any[] }

        const shippingSettings = await db.prepare(
            `SELECT free_shipping_threshold, shipping_cost FROM shipping_settings LIMIT 1`
        ).first()
        const shipping = parseShippingSettings(shippingSettings)

        // Absolute, canonical URLs: https://onopostore.com/<slug>/ and absolute image links
        const baseUrl = canonicalOrigin(process.env.NEXT_PUBLIC_BASE_URL)

        const xmlItems = (results || []).map((product: any) => {
            const images = parseImages(product.images)
            const imageUrl = absoluteImageUrl(images[0], baseUrl) || `${baseUrl}/placeholder.svg`

            // Prices exactly as the checkout charges them; sale price only when the original price is higher
            const { price, listPrice } = feedPrices(product.price, product.original_price)
            const shippingPrice = computeShippingCost(price, Number(product.free_shipping) === 1, shipping)

            // Clean description
            const cleanDescription = stripHtml(product.description || product.name, 5000)

            return `
        <item>
            <g:id>${product.id}</g:id>
            <g:title><![CDATA[${product.name}]]></g:title>
            <g:description><![CDATA[${cleanDescription}]]></g:description>
            <g:link>${escapeXmlText(productPageUrl(baseUrl, product.slug, product.id))}</g:link>
            <g:image_link>${escapeXml(imageUrl)}</g:image_link>
            <g:availability>${product.stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
            <g:price>${(listPrice ?? price).toFixed(2)} TRY</g:price>
            ${listPrice
                    ? `<g:sale_price>${price.toFixed(2)} TRY</g:sale_price>`
                    : ''}
            <g:brand>Onopo</g:brand>
            ${product.product_code ? `<g:mpn>${escapeXml(product.product_code)}</g:mpn>` : ''}
            <g:condition>new</g:condition>
            <g:product_type><![CDATA[${product.category || 'Genel'}]]></g:product_type>
            <g:shipping>
                <g:country>TR</g:country>
                <g:service>Standard</g:service>
                <g:price>${shippingPrice.toFixed(2)} TRY</g:price>
            </g:shipping>
        </item>`
        }).join('')

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
    <channel>
        <title>Onopo Store - Premium Ürünler</title>
        <link>${baseUrl}</link>
        <description>Onopo - Kaliteli Teknoloji ve Yaşam Ürünleri</description>
        ${xmlItems}
    </channel>
</rss>`

        return new NextResponse(xml, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
            }
        })
    } catch (error: any) {
        console.error('Product feed error:', error)
        return NextResponse.json({ error: 'Feed generation failed', details: error.message }, { status: 500 })
    }
}

function escapeXml(unsafe: string) {
    if (!unsafe) return ''
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;'
            case '>': return '&gt;'
            case '&': return '&amp;'
            case "'": return '&apos;'
            case '"': return '&quot;'
            default: return c
        }
    })
}
