import { NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'

export const runtime = 'edge'

export async function GET() {
    try {
        const db = getRequestContext().env.DB
        if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 })

        // Fetch only active menus
        const { results } = await db.prepare("SELECT * FROM menus WHERE is_active = 1 ORDER BY sort_order ASC").run()
        return NextResponse.json(results)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
