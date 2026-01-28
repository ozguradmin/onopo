import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'

export const runtime = 'edge'

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
        const token = req.cookies.get('token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        const { name, slug, description, price, original_price, stock, images, category } = body

        const runResult = await db.prepare(
            `UPDATE products SET 
             name = ?, slug = ?, description = ?, price = ?, original_price = ?, stock = ?, images = ?, category = ?
             WHERE id = ?`
        ).bind(
            name,
            slug,
            description,
            price,
            original_price,
            stock,
            JSON.stringify(images),
            category,
            id
        ).run()

        if (!runResult.success) {
            throw new Error('Failed to update product')
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const db = await getDB()
        const params = await props.params
        const id = params.id

        // Auth check
        const token = req.cookies.get('token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run()

        return NextResponse.json({ success: true })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
