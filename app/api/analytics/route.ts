import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/api-request'
import { getDB } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { addDays, istanbulDay, istanbulDayStartUtc } from '@/lib/analytics'

// GET: Get analytics summary (admin only)
export async function GET(req: NextRequest) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const db = await getDB()

        const url = new URL(req.url)
        const range = url.searchParams.get('range') || 'week' // day, week, month

        // Istanbul calendar days (today = since local midnight, not the last 24 hours), the same days as the
        // Admin › İstatistikler page (lib/analytics.ts). `since` is computed here, never taken from the request.
        const today = istanbulDay(new Date())
        const since = istanbulDayStartUtc(range === 'day' ? today : addDays(today, range === 'week' ? -6 : -29))
        const dateFilter = `AND created_at >= '${since}'`

        // Total page views
        const totalViews = await db.prepare(
            `SELECT COUNT(*) as count FROM analytics WHERE 1=1 ${dateFilter}`
        ).first() as any

        // Views by page
        const pageViews = await db.prepare(
            `SELECT page, COUNT(*) as count FROM analytics WHERE 1=1 ${dateFilter} GROUP BY page ORDER BY count DESC LIMIT 10`
        ).all()

        // Most viewed products
        const productViews = await db.prepare(
            `SELECT a.product_id, p.name, COUNT(*) as count 
             FROM analytics a 
             LEFT JOIN products p ON a.product_id = p.id 
             WHERE a.product_id IS NOT NULL ${dateFilter.replace('created_at', 'a.created_at')}
             GROUP BY a.product_id 
             ORDER BY count DESC 
             LIMIT 10`
        ).all()

        // Daily breakdown
        const dailyViews = await db.prepare(
            `SELECT date(created_at, '+3 hours') as date, COUNT(*) as count 
             FROM analytics 
             WHERE 1=1 ${dateFilter}
             GROUP BY date(created_at, '+3 hours') 
             ORDER BY date DESC 
             LIMIT 30`
        ).all()

        return NextResponse.json({
            totalViews: (totalViews as any)?.count || 0,
            pageViews: pageViews?.results || [],
            productViews: productViews?.results || [],
            dailyViews: dailyViews?.results || []
        })
    } catch (error: any) {
        console.error('Analytics fetch error:', error)
        // Return empty structure instead of crashing
        return NextResponse.json({
            totalViews: 0,
            pageViews: [],
            productViews: [],
            dailyViews: []
        })
    }
}

// POST: Track a page view
export async function POST(req: NextRequest) {
    try {
        const db = await getDB()
        const parsed = await readJsonBody(req)
        if (!parsed.ok) return parsed.response
        const { page, product_id } = parsed.body

        const userAgent = req.headers.get('user-agent') || ''

        await db.prepare(
            'INSERT INTO analytics (page, product_id, user_agent) VALUES (?, ?, ?)'
        ).bind(page, product_id || null, userAgent).run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
