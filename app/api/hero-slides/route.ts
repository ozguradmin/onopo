import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// GET: Get all hero slides
export async function GET() {
    try {
        const db = await getDB()
        const { results } = await db.prepare(
            'SELECT * FROM hero_slides WHERE is_active = 1 ORDER BY display_order ASC'
        ).all()
        return NextResponse.json(results || [])
    } catch (error: any) {
        console.error('Hero slides fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PUT: Update all hero slides (admin only)
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

        const { slides } = await req.json()

        // Delete existing slides and insert new ones
        await db.prepare('DELETE FROM hero_slides').run()

        for (let i = 0; i < slides.length; i++) {
            const slide = slides[i]
            await db.prepare(
                `INSERT INTO hero_slides (title, subtitle, button_text, button_link, image_url, display_order, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, 1)`
            ).bind(
                slide.title || '',
                slide.subtitle || '',
                slide.button_text || '',
                slide.button_link || '',
                slide.image_url || '',
                i + 1
            ).run()
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Hero slides update error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
