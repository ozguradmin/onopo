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
            installment_info
        } = body

        // Prepare values with safe defaults and type conversions
        const safePrice = parseFloat(price) || 0
        const safeOriginalPrice = original_price ? parseFloat(original_price) : null
        const safeStock = parseInt(stock) || 0

        let safeImages = '[]'
        if (typeof images === 'string') {
            safeImages = images // Already stringified or raw string
        } else if (Array.isArray(images)) {
            safeImages = JSON.stringify(images)
        }

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
            id
        ).run()

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Product update error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
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

        await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run()

        return NextResponse.json({ success: true })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
