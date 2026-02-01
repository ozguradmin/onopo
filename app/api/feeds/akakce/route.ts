// Akakçe Product Feed - XML Format
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
}

// Helper to extract fields from description
function extractFromDescription(description: string) {
    const cleanDesc = description.replace(/<[^>]*>?/gm, ' ')

    // Extract Brand - Stop at known next fields or end of string
    // Looks for "Marka" followed by text until "Ürün Kodu", "Barkod", "Desi", "Varyant" or end
    const brandMatch = cleanDesc.match(/Marka\s*[:\-\s]*([^{\n\r]+?)(?=\s*(?:Ürün Kodu|Barkod|Desi|Varyant|$))/i)
    let brand = brandMatch ? brandMatch[1].trim() : ''

    // Extract Barcode
    const barcodeMatch = cleanDesc.match(/Barkod\s*[:\-\s]*([A-Z0-9]+)/i)
    const barcode = barcodeMatch ? barcodeMatch[1].trim() : ''

    // Extract Product Code
    const codeMatch = cleanDesc.match(/Ürün Kodu\s*[:\-\s]*([^{\n\r]+?)(?=\s*(?:Barkod|Desi|Varyant|$))/i)
    const productCode = codeMatch ? codeMatch[1].trim() : ''

    return { brand, barcode, productCode }
}

export async function GET() {
    try {
        const db = await getDB()

        // Fetch site settings
        const settingsResults = await db.prepare(
            `SELECT key, value FROM site_settings WHERE key IN ('site_name', 'site_url')`
        ).all()

        const settings: Settings = {
            site_name: 'Onopo',
            site_url: 'https://onopostore.com'
        }

        if (settingsResults.results) {
            for (const row of settingsResults.results as { key: string, value: string }[]) {
                if (row.key === 'site_name') settings.site_name = row.value
                if (row.key === 'site_url') settings.site_url = row.value
            }
        }

        // Fetch all active products
        const { results: products } = await db.prepare(
            `SELECT id, name, slug, description, price, original_price, stock, images, category, is_active, free_shipping, product_code 
             FROM products WHERE is_active = 1 AND stock > 0`
        ).all() as { results: Product[] }

        // Build XML items
        const xmlItems = products.map(product => {
            const images = product.images ? JSON.parse(product.images) : []
            const mainImage = images[0] || ''

            // Clean URL (trim whitespace)
            const productUrl = `${settings.site_url}/${product.slug}`.trim()

            // Extract metadata from description
            const extracted = extractFromDescription(product.description || '')

            // Determine Brand: Extracted > First Word of Name > Default 'Onopo'
            let brand = extracted.brand
            if (!brand && product.name) {
                const firstWord = product.name.split(' ')[0]
                if (firstWord && firstWord.length > 2) brand = firstWord
            }
            if (!brand) brand = 'Onopo'

            // Determine Barcode/GTIN
            const barcode = extracted.barcode || '' // Leave empty if not found

            // Determine SKU/Product Code
            const sku = product.product_code || extracted.productCode || product.id.toString()

            // Description cleaning
            const cleanDescription = stripHtml(product.description || '', 5000)

            // Price logic
            const currentPrice = product.price.toFixed(2)
            const oldPrice = (product.original_price && product.original_price > product.price)
                ? product.original_price.toFixed(2)
                : ''

            return `  <urun>
    <id>${product.id}</id>
    <sku>${escapeCDATA(sku)}</sku>
    <barkod>${escapeCDATA(barcode)}</barkod>
    <isim><![CDATA[${escapeCDATA(product.name)}]]></isim>
    <aciklama><![CDATA[${escapeCDATA(cleanDescription)}]]></aciklama>
    <marka><![CDATA[${escapeCDATA(brand)}]]></marka>
    <kategori><![CDATA[${escapeCDATA(product.category || 'Genel')}]]></kategori>
    <link>${productUrl}</link>
    <resim>${mainImage.trim()}</resim>
    <resimler>
      ${images.map((img: string) => `<resim>${img.trim()}</resim>`).join('\n      ')}
    </resimler>
    <fiyat>${currentPrice}</fiyat>
    ${oldPrice ? `<piyasa_fiyati>${oldPrice}</piyasa_fiyati>` : ''}
    <para_birimi>TRY</para_birimi>
    <stok>${product.stock}</stok>
    <kargo_ucreti>${product.free_shipping ? '0' : '29.90'}</kargo_ucreti>
    <durum>Yeni</durum>
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
