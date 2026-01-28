import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

// GET: Get all homepage sections
export async function GET() {
    try {
        const db = await getDB()
        const { results } = await db.prepare(
            'SELECT * FROM homepage_sections WHERE is_active = 1 ORDER BY display_order ASC'
        ).all()

        // Parse JSON config for each section
        const sections = (results || []).map((s: any) => ({
            ...s,
            config: s.config ? JSON.parse(s.config) : {}
        }))

        return NextResponse.json(sections)
    } catch (error: any) {
        console.error('Sections fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST: Create new section (admin only)
export async function POST(req: NextRequest) {
    try {
        const db = await getDB()

        // Auth check
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { type, title, config, display_order } = await req.json()

        // Get max display_order if not provided
        let order = display_order
        if (order === undefined) {
            const maxOrder = await db.prepare(
                'SELECT MAX(display_order) as max_order FROM homepage_sections'
            ).first() as any
            order = (maxOrder?.max_order || 0) + 1
        }

        const result = await db.prepare(
            'INSERT INTO homepage_sections (type, title, config, display_order) VALUES (?, ?, ?, ?)'
        ).bind(type, title || '', JSON.stringify(config || {}), order).run()

        return NextResponse.json({ success: true, id: result.meta?.last_row_id })
    } catch (error: any) {
        console.error('Section create error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PUT: Reorder all sections
export async function PUT(req: NextRequest) {
    try {
        const db = await getDB()

        // Auth check
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { sections } = await req.json() // Array of { id, display_order }

        for (const section of sections) {
            await db.prepare(
                'UPDATE homepage_sections SET display_order = ? WHERE id = ?'
            ).bind(section.display_order, section.id).run()
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Section reorder error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
