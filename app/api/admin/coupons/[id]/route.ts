
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

        const db = await getDB()
        await db.prepare('DELETE FROM coupons WHERE id = ?').bind(id).run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// Toggle status (PUT)
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id
        const body = await req.json()
        const { is_active } = body

        const db = await getDB()
        await db.prepare('UPDATE coupons SET is_active = ? WHERE id = ?').bind(is_active ? 1 : 0, id).run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
