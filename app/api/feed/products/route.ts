import { getDB } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const db = await getDB()
        const { results } = await db.prepare(`
            SELECT id, name, description, slug, price, images, category, stock 
            FROM products 
            WHERE is_active = 1
        `).all()

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://onopo.com'
        const xmlItems = results.map((product: any) => {
            const images = JSON.parse(product.images || '[]')
            const image = images[0] || ''

            return `
            <item>
                <g:id>${product.id}</g:id>
                <g:title>${escapeXml(product.name)}</g:title>
                <g:description>${escapeXml(product.description || product.name)}</g:description>
                <g:link>${baseUrl}/${product.slug}</g:link>
                <g:image_link>${image}</g:image_link>
                <g:availability>${product.stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
                <g:price>${product.price} TRY</g:price>
                <g:brand>Onopo</g:brand>
                <g:condition>new</g:condition>
                <g:google_product_category>Electronics > Communications > Telephony > Mobile Phone Accessories</g:google_product_category>
                <g:product_type>${escapeXml(product.category)}</g:product_type>
            </item>`
        }).join('')

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
    <channel>
        <title>Onopo Store Product Feed</title>
        <link>${baseUrl}</link>
        <description>Premium Technology and Lifestyle Products</description>
        ${xmlItems}
    </channel>
</rss>`

        return new NextResponse(xml, {
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
            }
        })
    } catch (error) {
        console.error(error)
        return NextResponse.json({ error: 'Feed generation failed' }, { status: 500 })
    }
}

function escapeXml(unsafe: string) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;'
            case '>': return '&gt;'
            case '&': return '&amp;'
            case '\'': return '&apos;'
            case '"': return '&quot;'
            default: return c
        }
    })
}
