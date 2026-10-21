// CSV Product Export
import { getDB } from '@/lib/db'
import { stripHtml } from '@/lib/stripHtml'
import { requireAdmin } from '@/lib/auth'
import { parseShippingSettings, shippingCost as computeShippingCost } from '@/lib/pricing'
import { absoluteImageUrl, canonicalOrigin, feedPrices, parseImages } from '@/lib/feeds'

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
    created_at: string
}

export async function GET() {
    try {
        const db = await getDB()

        // The admin panel (Entegrasyonlar) gets the full export: inactive products too, and the stored
        // prices, so the file can be edited and imported back. Everyone else gets active products only,
        // priced exactly as the checkout charges them.
        const isAdmin = (await requireAdmin()) === null

        const { results: products } = await db.prepare(
            `SELECT id, name, description, price, original_price, stock, images, category, is_active, free_shipping, product_code, created_at
             FROM products ${isAdmin ? '' : 'WHERE is_active = 1 '}ORDER BY id DESC`
        ).all() as { results: Product[] }

        // Fetch shipping settings
        const shippingSettings = await db.prepare(
            `SELECT free_shipping_threshold, shipping_cost FROM shipping_settings LIMIT 1`
        ).first()

        const shipping = parseShippingSettings(shippingSettings)
        const origin = canonicalOrigin(null)

        // CSV Header
        const headers = [
            'ID',
            'Ürün Adı',
            'Açıklama',
            'Fiyat',
            'Eski Fiyat',
            'Stok',
            'Kategori',
            'Ürün Kodu',
            'Ücretsiz Kargo',
            'Aktif',
            'Görsel URL',
            'Oluşturma Tarihi',
            'Kargo Ücreti' // Added Kargo Ücreti header
        ]

        // CSV Rows
        const rows = products.map(product => {
            const images = parseImages(product.images)
            const imageUrl = absoluteImageUrl(images[0], origin)
            const { price: chargedPrice, listPrice } = feedPrices(product.price, product.original_price)

            // Clean description for CSV
            const cleanDescription = stripHtml(product.description || '', 10000)
                .replace(/"/g, '""') // Escape quotes for CSV

            // Shipping for one unit, as the order API computes it
            const calculatedShippingCost = computeShippingCost(chargedPrice, Number(product.free_shipping) === 1, shipping)

            return [
                product.id,
                `"${product.name.replace(/"/g, '""')}"`,
                `"${cleanDescription}"`,
                isAdmin ? product.price : chargedPrice,
                isAdmin ? (product.original_price || '') : (listPrice ?? ''),
                product.stock,
                `"${(product.category || '').replace(/"/g, '""')}"`,
                product.product_code || '',
                product.free_shipping ? 'Evet' : 'Hayır',
                product.is_active ? 'Evet' : 'Hayır',
                imageUrl,
                product.created_at || '',
                calculatedShippingCost.toFixed(2) // Added calculated shipping cost
            ].join(',')
        })

        // Combine header and rows
        const csv = [headers.join(','), ...rows].join('\n')

        // Add BOM for Turkish character support in Excel
        const bom = '\uFEFF'

        return new Response(bom + csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="urunler.csv"',
                'Cache-Control': 'private, no-cache',
                'Vary': 'Cookie'
            }
        })
    } catch (error) {
        console.error('CSV Export Error:', error)
        return new Response('Export error', { status: 500 })
    }
}
