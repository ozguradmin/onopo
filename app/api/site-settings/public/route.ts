import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { settingsObject } from '@/lib/siteSettings'

// GET: public site settings (never the admin-only keys). Unlike /api/site-settings this URL never
// reads the auth cookie, so the response is the same for everyone and can be cached (worker.ts edge cache).
export async function GET() {
    try {
        const db = await getDB()
        const { results } = await db.prepare('SELECT key, value FROM site_settings').all()
        return NextResponse.json(settingsObject((results || []) as any[], false), {
            headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' }
        })
    } catch (error: any) {
        console.error('Public settings fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
