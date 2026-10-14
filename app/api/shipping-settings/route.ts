import { requireAdmin } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET() {
    try {
        const db = await getDB()
        const settings = await db.prepare('SELECT * FROM shipping_settings LIMIT 1').first()

        if (!settings) {
            return NextResponse.json({
                free_shipping_threshold: 500,
                shipping_cost: 100
            })
        }

        return NextResponse.json(settings, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
            }
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const body = await req.json()
        const { free_shipping_threshold, shipping_cost } = body

        const db = await getDB()

        await db.prepare(`
            UPDATE shipping_settings 
            SET free_shipping_threshold = ?, shipping_cost = ?, updated_at = CURRENT_TIMESTAMP
        `).bind(free_shipping_threshold, shipping_cost).run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
