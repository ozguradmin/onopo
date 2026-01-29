// Akakçe Product Feed - XML Format
import { getDB } from '@/lib/db'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

interface Product {
    id: number
    name: string
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
}

export async function GET() {
    try {
        const db = await getDB()

        // Fetch site settings
        const settingsResults = await db.prepare(
            `SELECT key, value FROM settings WHERE key IN ('site_name', 'site_url')`
        ).all()

        const settings: Settings = {
            site_name: 'Onopo',
            site_url: process.env.NEXT_PUBLIC_BASE_URL || 'https://onopo.com'
        }

        if (settingsResults.results) {
            for (const row of settingsResults.results as { key: string, value: string }[]) {
                if (row.key === 'site_name') settings.site_name = row.value
                if (row.key === 'site_url') settings.site_url = row.value
            }
        }

        // Fetch all active products
        const { results: products } = await db.prepare(
            `SELECT id, name, description, price, original_price, stock, images, category, is_active, free_shipping, product_code 
             FROM products WHERE is_active = 1`
        ).all() as { results: Product[] }

        // Build Akakce XML feed
        const xmlItems = products.map(product => {
            const images = product.images ? JSON.parse(product.images) : []
            const imageUrl = images[0] || ''
            const productUrl = `${settings.site_url}/products/${product.id}`
            const inStock = product.stock > 0 ? 'var' : 'yok'

            // Clean description - remove HTML
            const cleanDescription = (product.description || '')
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 2000)

            return `  <urun>
    <id>${product.id}</id>
    <isim><![CDATA[${escapeCDATA(product.name)}]]></isim>
    <aciklama><![CDATA[${escapeCDATA(cleanDescription)}]]></aciklama>
    <link>${productUrl}</link>
    <resim>${imageUrl}</resim>
    <fiyat>${product.price.toFixed(2)}</fiyat>
    ${product.original_price && product.original_price > product.price ? `<eski_fiyat>${product.original_price.toFixed(2)}</eski_fiyat>` : ''}
    <stok>${inStock}</stok>
    <stok_adedi>${product.stock}</stok_adedi>
    <kategori><![CDATA[${escapeCDATA(product.category || 'Genel')}]]></kategori>
    ${product.product_code ? `<urun_kodu>${escapeXml(product.product_code)}</urun_kodu>` : ''}
    ${product.free_shipping ? '<kargo_ucretsiz>evet</kargo_ucretsiz>' : '<kargo_ucretsiz>hayir</kargo_ucretsiz>'}
    <marka><![CDATA[${escapeCDATA(settings.site_name)}]]></marka>
  </urun>`
        }).join('\n')

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urunler>
  <magaza>
    <isim>${escapeXml(settings.site_name)}</isim>
    <url>${settings.site_url}</url>
  </magaza>
${xmlItems}
</urunler>`

        return new Response(xml, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, max-age=3600'
            }
        })
    } catch (error) {
        console.error('Akakce Feed Error:', error)
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
