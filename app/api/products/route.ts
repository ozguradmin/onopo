import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'



export async function GET(req: NextRequest) {
    try {
        const db = await getDB()
        // Simple select for now, maybe pagination later
        const { results } = await db.prepare('SELECT * FROM products ORDER BY created_at DESC').all()

        // Parse images JSON
        const products = results.map((p: any) => ({
            ...p,
            images: p.images ? JSON.parse(p.images) : []
        }))

        return NextResponse.json(products)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const db = await getDB()

        // Auth check
        const token = req.cookies.get('token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        const { name, slug, description, price, original_price, stock, images, category } = body

        if (!name || !slug || !price) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const runResult = await db.prepare(
            `INSERT INTO products (name, slug, description, price, original_price, stock, images, category) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            name,
            slug,
            description || '',
            price,
            original_price || null,
            stock || 0,
            JSON.stringify(images || []),
            category || 'Uncategorized'
        ).run()

        if (!runResult.success) {
            throw new Error('Failed to create product')
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
