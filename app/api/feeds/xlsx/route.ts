// XLSX Product Export
import { NextResponse } from 'next/server'// Product Export to Excel (XLSX)
import { getDB } from '@/lib/db'
import * as XLSX from 'xlsx'
import { stripHtml } from '@/lib/stripHtml'
import { requireAdmin } from '@/lib/auth'
import { parseShippingSettings, shippingCost as computeShippingCost } from '@/lib/pricing'
import { canonicalOrigin, exportImageUrl, feedPrices, parseImages } from '@/lib/feeds'
import { hasGtinColumn } from '@/lib/gtin'

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
    gtin?: string | null
    created_at: string
}

export async function GET() {
    try {
        const db = await getDB()

        // The admin panel gets the full export (inactive products too, stored prices: the admin product
        // import reads 'Fiyat (₺)' back). Everyone else gets active products only, priced exactly as the
        // checkout charges them.
        const isAdmin = (await requireAdmin()) === null

        // products.gtin once migrations/2026-10-22-product-gtin.sql has run (the column stays empty until then)
        const gtinColumn = (await hasGtinColumn(db)) ? ', gtin' : ''
        const { results: products } = await db.prepare(
            `SELECT id, name, description, price, original_price, stock, images, category, is_active, free_shipping, product_code, created_at${gtinColumn}
             FROM products ${isAdmin ? '' : 'WHERE is_active = 1 '}ORDER BY id DESC`
        ).all() as { results: Product[] }

        // Fetch shipping settings
        const shippingSettings = await db.prepare(
            `SELECT free_shipping_threshold, shipping_cost FROM shipping_settings LIMIT 1`
        ).first()

        const shipping = parseShippingSettings(shippingSettings)
        const origin = canonicalOrigin(null)

        // Prepare data for Excel
        const data = products.map((product: any) => {
            const images = parseImages(product.images)
            const imageUrl = exportImageUrl(images[0], origin, isAdmin)
            const { price: chargedPrice, listPrice } = feedPrices(product.price, product.original_price)

            // Clean description
            const cleanDescription = stripHtml(product.description || '', 30000)

            // Shipping for one unit, as the order API computes it
            const shippingPriceValue = computeShippingCost(chargedPrice, Number(product.free_shipping) === 1, shipping)

            return {
                'ID': product.id,
                'Ürün Adı': product.name,
                'Açıklama': cleanDescription,
                'Fiyat (₺)': isAdmin ? product.price : chargedPrice,
                'Eski Fiyat (₺)': isAdmin ? (product.original_price || '') : (listPrice ?? ''),
                'Stok': product.stock,
                'Kategori': product.category || '',
                'Ürün Kodu': product.product_code || '',
                'Ücretsiz Kargo': product.free_shipping ? 'Evet' : 'Hayır',
                'Kargo Ücreti': shippingPriceValue.toFixed(2),
                'Aktif': product.is_active ? 'Evet' : 'Hayır',
                'Görsel URL': imageUrl,
                'Oluşturma Tarihi': product.created_at || '',
                'Barkod (GTIN)': product.gtin || ''
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
                'Cache-Control': 'private, no-cache',
                'Vary': 'Cookie'
            }
        })
    } catch (error: any) {
        console.error('XLSX Export Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
