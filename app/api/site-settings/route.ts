import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT, requireAdmin } from '@/lib/auth'
import { cookies } from 'next/headers'

// Settings that only the admin panel may read (e.g. where 2FA codes and order notifications go)
const ADMIN_ONLY_KEYS = new Set(['admin_email'])

// GET: Get site settings (admin-only keys are returned to admins only)
export async function GET() {
    try {
        const db = await getDB()
        const { results } = await db.prepare('SELECT key, value FROM site_settings').all()
        const isAdmin = (await requireAdmin()) === null

        // Convert to object
        const settings: Record<string, string> = {}
        for (const row of (results || [])) {
            const key = (row as any).key
            if (!isAdmin && ADMIN_ONLY_KEYS.has(key)) continue
            settings[key] = (row as any).value
        }

        // Public settings are cached for 5 minutes; the admin view must never be cached
        return NextResponse.json(settings, {
            headers: {
                'Cache-Control': isAdmin ? 'private, no-store' : 'public, s-maxage=300, stale-while-revalidate=600',
                'Vary': 'Cookie'
            }
        })
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
        if (!payload || payload.role !== 'admin') {
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
