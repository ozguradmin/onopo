import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET: Get variations for a product
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const db = await getDB()

        const { results } = await db.prepare(
            'SELECT * FROM product_variations WHERE product_id = ? ORDER BY name, value'
        ).bind(id).all()

        return NextResponse.json(results || [])
    } catch (error: any) {
        console.error('Variations fetch error:', error)
        return NextResponse.json([], { status: 500 })
    }
}

// POST: Add or update variations for a product
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const db = await getDB()
        const body = await req.json()
        const { variations } = body

        if (!Array.isArray(variations)) {
            return NextResponse.json({ error: 'Variations array required' }, { status: 400 })
        }

        // Delete existing variations for this product
        await db.prepare('DELETE FROM product_variations WHERE product_id = ?').bind(id).run()

        // Insert new variations
        if (variations.length > 0) {
            const stmt = db.prepare(`
                INSERT INTO product_variations (product_id, name, value, price_modifier, stock, sku, image_url)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `)

            const batch = variations.map((v: any) =>
                stmt.bind(
                    id,
                    v.name || '',
                    v.value || '',
                    v.price_modifier || 0,
                    v.stock || 0,
                    v.sku || null,
                    v.image_url || null
                )
            )

            await db.batch(batch)
        }

        return NextResponse.json({ success: true, count: variations.length })
    } catch (error: any) {
        console.error('Variations save error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE: Delete a specific variation
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const { searchParams } = new URL(req.url)
        const variationId = searchParams.get('variationId')

        if (!variationId) {
            return NextResponse.json({ error: 'variationId required' }, { status: 400 })
        }

        const db = await getDB()
        await db.prepare(
            'DELETE FROM product_variations WHERE id = ? AND product_id = ?'
        ).bind(variationId, id).run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Variation delete error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
