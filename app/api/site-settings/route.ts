import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

// GET: Get all site settings
export async function GET() {
    try {
        const db = await getDB()
        const { results } = await db.prepare('SELECT key, value FROM site_settings').all()

        // Convert to object
        const settings: Record<string, string> = {}
        for (const row of (results || [])) {
            settings[(row as any).key] = (row as any).value
        }

        return NextResponse.json(settings)
    } catch (error: any) {
        console.error('Settings fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST: Update site settings (admin only)
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

        const settings = await req.json()

        // Update each setting
        for (const [key, value] of Object.entries(settings)) {
            await db.prepare(
                'INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
            ).bind(key, value as string).run()
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Settings update error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
