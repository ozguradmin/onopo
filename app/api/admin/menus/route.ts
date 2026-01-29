import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'



// GET: List all menus (Public/Admin use)
export async function GET() {
    try {
        const db = await getDB()
        const { results } = await db.prepare("SELECT * FROM menus ORDER BY sort_order ASC").run()
        return NextResponse.json(results)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST: Create a new menu
export async function POST(req: NextRequest) {
    try {
        const db = await getDB()
        const body = await req.json()
        const { title, url, parent_id, sort_order, is_active } = body

        if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

        const result = await db.prepare(
            "INSERT INTO menus (title, url, parent_id, sort_order, is_active) VALUES (?, ?, ?, ?, ?)"
        ).bind(
            title,
            url || '#',
            parent_id || null,
            sort_order || 0,
            is_active !== undefined ? (is_active ? 1 : 0) : 1
        ).run()

        return NextResponse.json({ success: true, id: result.meta.last_row_id })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PUT: Update a menu
export async function PUT(req: NextRequest) {
    try {
        const db = await getDB()
        const body = await req.json()
        const { id, title, url, parent_id, sort_order, is_active } = body

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

        await db.prepare(
            "UPDATE menus SET title = ?, url = ?, parent_id = ?, sort_order = ?, is_active = ? WHERE id = ?"
        ).bind(
            title,
            url || '#',
            parent_id || null,
            sort_order || 0,
            is_active !== undefined ? (is_active ? 1 : 0) : 1,
            id
        ).run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE: Delete a menu
export async function DELETE(req: NextRequest) {
    try {
        const db = await getDB()
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

        await db.prepare("DELETE FROM menus WHERE id = ?").bind(id).run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
