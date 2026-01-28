import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

// PUT: Update a review
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        const db = await getDB()
        const { rating, comment } = await req.json()

        await db.prepare(
            'UPDATE reviews SET rating = ?, comment = ? WHERE id = ?'
        ).bind(rating || 5, comment || '', id).run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Review update error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE: Delete a review
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        const db = await getDB()
        await db.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Review delete error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
