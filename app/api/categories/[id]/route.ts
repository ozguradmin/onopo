import { requireAdmin } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

// PUT: Update category
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const { id } = await params
        const db = await getDB()
        const { name, icon } = await req.json()

        if (!name) {
            return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
        }

        // Products point at their category by NAME (products.category): a rename moves them along in the same
        // transaction, otherwise the category would lose all its products. The slug (public URL) stays.
        await db.batch([
            db.prepare('UPDATE products SET category = ? WHERE category = (SELECT name FROM categories WHERE id = ?) AND category <> ?')
                .bind(name, id, name),
            db.prepare('UPDATE categories SET name = ?, icon = ? WHERE id = ?')
                .bind(name, icon || 'package', id),
        ])

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Category update error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE: Remove category
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const { id } = await params
        const db = await getDB()

        await db.prepare('DELETE FROM categories WHERE id = ?')
            .bind(id)
            .run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Category delete error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
