import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

async function isAdminSession(): Promise<boolean> {
    const token = (await cookies()).get('auth_token')?.value
    if (!token) return false
    const payload = await verifyJWT(token)
    return !!payload && payload.role === 'admin'
}

// GET: Get all active homepage sections. Admin › Ana Sayfa asks with ?includeAll=true and then, for a
// verified admin session only, also gets the hidden ones (is_active = 0) so they can be switched back on.
// includeAll requests and requests with auth_token are never edge-cached (lib/edge-cache.ts).
export async function GET(req: NextRequest) {
    try {
        const db = await getDB()
        const includeHidden = req.nextUrl.searchParams.get('includeAll') === 'true' && await isAdminSession()
        const { results } = await db.prepare(
            includeHidden
                ? 'SELECT * FROM homepage_sections ORDER BY display_order ASC, id ASC'
                : 'SELECT * FROM homepage_sections WHERE is_active = 1 ORDER BY display_order ASC'
        ).all()

        // Parse JSON config for each section
        // Parse JSON config for each section (handle both string and object)
        const sections = (results || []).map((s: any) => {
            let config = {}
            if (typeof s.config === 'string') {
                try {
                    config = JSON.parse(s.config)
                } catch {
                    console.error('Failed to parse config string:', s.config)
                }
            } else if (typeof s.config === 'object' && s.config !== null) {
                config = s.config
            }
            return {
                ...s,
                config
            }
        })

        return NextResponse.json(sections, includeHidden ? { headers: { 'Cache-Control': 'private, no-store' } } : undefined)
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
        if (!payload || payload.role !== 'admin') {
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
        if (!payload || payload.role !== 'admin') {
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
