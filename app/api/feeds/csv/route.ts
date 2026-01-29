// CSV Product Export
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
            'Oluşturma Tarihi'
        ]

        // CSV Rows
        const rows = products.map(product => {
            const images = product.images ? JSON.parse(product.images) : []
            const imageUrl = images[0] || ''

            // Clean description for CSV
            const cleanDescription = (product.description || '')
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .replace(/"/g, '""') // Escape quotes for CSV
                .trim()

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
                product.created_at || ''
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
