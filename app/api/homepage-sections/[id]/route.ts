import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

// GET: Get a specific section
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const db = await getDB()

        const section = await db.prepare(
            'SELECT * FROM homepage_sections WHERE id = ?'
        ).bind(id).first()

        if (!section) {
            return NextResponse.json({ error: 'Section not found' }, { status: 404 })
        }

        return NextResponse.json({
            ...section,
            config: (section as any).config ? JSON.parse((section as any).config) : {}
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PUT: Update a section
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const db = await getDB()

        // Auth check
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { title, config, is_active } = await req.json()

        await db.prepare(
            `UPDATE homepage_sections SET 
             title = COALESCE(?, title),
             config = COALESCE(?, config),
             is_active = COALESCE(?, is_active),
             updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
        ).bind(
            title || null,
            config ? JSON.stringify(config) : null,
            is_active !== undefined ? (is_active ? 1 : 0) : null,
            id
        ).run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE: Delete a section
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const db = await getDB()

        // Auth check
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        await db.prepare('DELETE FROM homepage_sections WHERE id = ?').bind(id).run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
