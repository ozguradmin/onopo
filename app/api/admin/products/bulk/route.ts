import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// POST: Bulk Import Products
export async function POST(req: NextRequest) {
    try {
        const db = await getDB()

        // Auth check
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { products } = await req.json()

        if (!Array.isArray(products) || products.length === 0) {
            return NextResponse.json({ error: 'No products provided' }, { status: 400 })
        }

        console.log(`Starting bulk import of ${products.length} products...`)

        // Auto-create categories from products
        const uniqueCategories = [...new Set(products.map((p: any) => p.category).filter(Boolean))]
        console.log(`Found ${uniqueCategories.length} unique categories:`, uniqueCategories)

        for (const categoryName of uniqueCategories) {
            try {
                const slug = String(categoryName)
                    .toLowerCase()
                    .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u')
                    .replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/ı/g, 'i')
                    .replace(/[^a-z0-9\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                    .trim()

                await db.prepare('INSERT OR IGNORE INTO categories (name, slug, icon) VALUES (?, ?, ?)')
                    .bind(categoryName, slug, 'package')
                    .run()
                console.log(`Category added/exists: ${categoryName} -> ${slug}`)
            } catch (catErr) {
                console.log(`Category insert skipped for ${categoryName}:`, catErr)
            }
        }

        let successCount = 0
        let errorCount = 0
        let errors: any[] = []

        // Transaction-like approach (loop)
        for (const product of products) {
            try {
                // Basic Validation
                if (!product.name || product.price === undefined) {
                    throw new Error(`Missing name or price for product: ${JSON.stringify(product)}`)
                }

                const slug = product.name
                    .toLowerCase()
                    .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u')
                    .replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/ı/g, 'i')
                    .replace(/İ/g, 'i').replace(/Ş/g, 's').replace(/Ğ/g, 'g')
                    .replace(/Ü/g, 'u').replace(/Ö/g, 'o').replace(/Ç/g, 'c')
                    .replace(/[^a-z0-9\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                    .trim()

                const numericPrice = typeof product.price === 'number' ? product.price : parseFloat(String(product.price))

                await db.prepare(
                    `INSERT INTO products (
                        name, slug, description, price, original_price, stock, images, category, 
                        is_active, product_code, delivery_info, whatsapp_order_enabled, whatsapp_number
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
                ).bind(
                    product.name,
                    slug,
                    product.description || '',
                    numericPrice,
                    product.original_price || null,
                    product.stock || 0,
                    JSON.stringify(product.images || []),
                    product.category || 'Genel',
                    product.product_code || '',
                    product.delivery_info || '',
                    product.whatsapp_order_enabled ? 1 : 0,
                    product.whatsapp_number || '905058217547'
                ).run()

                successCount++
            } catch (err: any) {
                console.error('Bulk import item error:', err)
                errorCount++
                errors.push({ product: product.name, error: err.message })
            }
        }

        return NextResponse.json({
            success: true,
            imported: successCount,
            failed: errorCount,
            errors: errors.slice(0, 5) // Return max 5 errors to avoid huge payload
        })

    } catch (error: any) {
        console.error('Bulk import fatal error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE: Delete ALL Products
export async function DELETE(req: NextRequest) {
    try {
        const db = await getDB()

        // Auth check
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        // Delete all products
        await db.prepare('DELETE FROM products').run()

        // Also delete all categories
        await db.prepare('DELETE FROM categories').run()

        return NextResponse.json({ success: true, message: 'All products and categories deleted' })
    } catch (error: any) {
        console.error('Bulk delete error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
