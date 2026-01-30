import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const db = await getDB()
        const params = await props.params
        const id = params.id

        const product = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()

        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        return NextResponse.json({
            ...product,
            images: product.images ? JSON.parse(product.images as string) : []
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const db = await getDB()
        const params = await props.params
        const id = params.id

        // Auth check
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        const {
            name,
            description,
            price,
            original_price,
            stock,
            images,
            category,
            warranty_info,
            delivery_info,
            installment_info,
            is_active,
            product_code,
            whatsapp_order_enabled,
            whatsapp_number,
            free_shipping
        } = body

        // Prepare values with safe defaults and type conversions
        const safePrice = parseFloat(price) || 0
        const safeOriginalPrice = original_price ? parseFloat(original_price) : null

        const intId = parseInt(id)
        let safeStock = parseInt(stock) || 0

        // Handle relative stock update if input string starts with + or -
        if (typeof stock === 'string' && (stock.startsWith('+') || stock.startsWith('-'))) {
            const currentProduct = await db.prepare('SELECT stock FROM products WHERE id = ?').bind(intId).first()
            if (currentProduct) {
                safeStock = (currentProduct.stock || 0) + parseInt(stock)
            }
        }

        const safeIsActive = is_active !== undefined ? (is_active ? 1 : 0) : 1
        const safeWhatsappEnabled = whatsapp_order_enabled ? 1 : 0
        const safeWhatsappNumber = whatsapp_number || ''
        const safeFreeShipping = free_shipping ? 1 : 0

        let safeImages = '[]'
        if (typeof images === 'string') {
            safeImages = images // Already stringified or raw string
        } else if (Array.isArray(images)) {
            safeImages = JSON.stringify(images)
        }

        console.log('Updating product:', intId, body)

        try {
            await db.prepare(
                `UPDATE products SET 
                 name = ?, description = ?, price = ?, original_price = ?, stock = ?, 
                 images = ?, category = ?, warranty_info = ?, delivery_info = ?, installment_info = ?, is_active = ?,
                 product_code = ?, whatsapp_order_enabled = ?, whatsapp_number = ?, free_shipping = ?,
                 updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`
            ).bind(
                name,
                description || '',
                safePrice,
                safeOriginalPrice,
                safeStock,
                safeImages,
                category || '',
                warranty_info || '',
                delivery_info || '',
                installment_info || '',
                safeIsActive,
                product_code || '',
                safeWhatsappEnabled,
                safeWhatsappNumber,
                safeFreeShipping,
                intId
            ).run()
        } catch (err: any) {
            // Fallback if is_active column missing
            if (String(err).includes('no such column')) {
                console.warn('is_active column missing, falling back')
                await db.prepare(
                    `UPDATE products SET 
                     name = ?, description = ?, price = ?, original_price = ?, stock = ?, 
                     images = ?, category = ?, warranty_info = ?, delivery_info = ?, installment_info = ?,
                     updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`
                ).bind(
                    name,
                    description || '',
                    safePrice,
                    safeOriginalPrice,
                    safeStock,
                    safeImages,
                    category || '',
                    warranty_info || '',
                    delivery_info || '',
                    installment_info || '',
                    intId
                ).run()
            } else {
                throw err
            }
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Product update error:', error)
        return NextResponse.json({
            error: error.message,
            details: String(error),
            stack: error.stack
        }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const db = await getDB()
        const params = await props.params
        const id = params.id
        const intId = parseInt(id) // Ensure integer

        // Auth check
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Manual Cascade Delete
        const cleanupQueries = [
            'DELETE FROM order_items WHERE product_id = ?',
            'DELETE FROM favorites WHERE product_id = ?',
            'DELETE FROM featured_products WHERE product_id = ?',
            'DELETE FROM reviews WHERE product_id = ?'
        ]

        for (const query of cleanupQueries) {
            try {
                await db.prepare(query).bind(intId).run()
            } catch (e) {
                console.warn(`Cleanup failed for query: ${query}`, e)
            }
        }

        // Finally delete product
        await db.prepare('DELETE FROM products WHERE id = ?').bind(intId).run()

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Product delete error:', error)
        return NextResponse.json({
            error: error.message,
            details: String(error)
        }, { status: 500 })
    }
}
