// XLSX Product Export
import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import * as XLSX from 'xlsx'

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

        // Fetch all products
        const { results: products } = await db.prepare(
            `SELECT id, name, description, price, original_price, stock, images, category, is_active, free_shipping, product_code, created_at 
             FROM products ORDER BY id DESC`
        ).all() as { results: Product[] }

        // Prepare data for Excel
        const data = products.map(product => {
            const images = product.images ? JSON.parse(product.images) : []
            const imageUrl = images[0] || ''

            // Clean description
            const cleanDescription = (product.description || '')
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()

            return {
                'ID': product.id,
                'Ürün Adı': product.name,
                'Açıklama': cleanDescription,
                'Fiyat (₺)': product.price,
                'Eski Fiyat (₺)': product.original_price || '',
                'Stok': product.stock,
                'Kategori': product.category || '',
                'Ürün Kodu': product.product_code || '',
                'Ücretsiz Kargo': product.free_shipping ? 'Evet' : 'Hayır',
                'Aktif': product.is_active ? 'Evet' : 'Hayır',
                'Görsel URL': imageUrl,
                'Oluşturma Tarihi': product.created_at || ''
            }
        })

        // Create workbook
        const worksheet = XLSX.utils.json_to_sheet(data)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Ürünler')

        // Set column widths
        worksheet['!cols'] = [
            { wch: 6 },   // ID
            { wch: 40 },  // Ürün Adı
            { wch: 50 },  // Açıklama
            { wch: 12 },  // Fiyat
            { wch: 12 },  // Eski Fiyat
            { wch: 8 },   // Stok
            { wch: 25 },  // Kategori
            { wch: 15 },  // Ürün Kodu
            { wch: 12 },  // Ücretsiz Kargo
            { wch: 8 },   // Aktif
            { wch: 50 },  // Görsel URL
            { wch: 20 },  // Oluşturma Tarihi
        ]

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="urunler.xlsx"',
                'Cache-Control': 'no-cache'
            }
        })
    } catch (error: any) {
        console.error('XLSX Export Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
