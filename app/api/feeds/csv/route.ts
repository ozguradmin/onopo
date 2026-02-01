// CSV Product Export
import { getDB } from '@/lib/db'
import { stripHtml } from '@/lib/stripHtml'

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

        // Fetch all products (including inactive for full export)
        const { results: products } = await db.prepare(
            `SELECT id, name, description, price, original_price, stock, images, category, is_active, free_shipping, product_code, created_at 
             FROM products ORDER BY id DESC`
        ).all() as { results: Product[] }

        // Fetch shipping settings
        const shippingSettings = await db.prepare(
            `SELECT free_shipping_threshold, shipping_cost FROM shipping_settings LIMIT 1`
        ).first()

        const freeThreshold = shippingSettings ? parseFloat(shippingSettings.free_shipping_threshold) : 500.00
        const baseShippingCost = shippingSettings ? parseFloat(shippingSettings.shipping_cost) : 100.00

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
            const images = product.images ? JSON.parse(product.images) : []
            const imageUrl = images[0] || ''

            // Clean description for CSV
            const cleanDescription = stripHtml(product.description || '', 10000)
                .replace(/"/g, '""') // Escape quotes for CSV

            let calculatedShippingCost = 0;
            if (!product.free_shipping) {
                if (product.price < freeThreshold) {
                    calculatedShippingCost = baseShippingCost;
                }
            }

            return [
                product.id,
                `"${product.name.replace(/"/g, '""')}"`,
                `"${cleanDescription}"`,
                product.price,
                product.original_price || '',
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
                'Cache-Control': 'no-cache'
            }
        })
    } catch (error) {
        console.error('CSV Export Error:', error)
        return new Response('Export error', { status: 500 })
    }
}
