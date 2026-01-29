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
                    .replace(/[^a-z0-9\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                    .trim() + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000)

                const numericPrice = typeof product.price === 'number' ? product.price : parseFloat(String(product.price))

                await db.prepare(
                    `INSERT INTO products (
                        name, slug, description, price, original_price, stock, images, category, 
                        is_active, product_code
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
                ).bind(
                    product.name,
                    slug,
                    product.description || '',
                    numericPrice,
                    product.original_price || null,
                    product.stock || 0,
                    JSON.stringify(product.images || []),
                    product.category || 'Genel',
                    product.product_code || ''
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

        // Optional: Reset sequence if needed, but not critical
        // await db.prepare("DELETE FROM sqlite_sequence WHERE name='products'").run()

        return NextResponse.json({ success: true, message: 'All products deleted' })
    } catch (error: any) {
        console.error('Bulk delete error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
