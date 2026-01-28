import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

// GET: Get analytics summary
export async function GET(req: NextRequest) {
    try {
        const db = await getDB()

        const url = new URL(req.url)
        const range = url.searchParams.get('range') || 'week' // day, week, month

        let dateFilter = ''
        if (range === 'day') {
            dateFilter = "AND created_at >= datetime('now', '-1 day')"
        } else if (range === 'week') {
            dateFilter = "AND created_at >= datetime('now', '-7 days')"
        } else if (range === 'month') {
            dateFilter = "AND created_at >= datetime('now', '-30 days')"
        }

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
             WHERE a.product_id IS NOT NULL ${dateFilter}
             GROUP BY a.product_id 
             ORDER BY count DESC 
             LIMIT 10`
        ).all()

        // Daily breakdown
        const dailyViews = await db.prepare(
            `SELECT DATE(created_at) as date, COUNT(*) as count 
             FROM analytics 
             WHERE 1=1 ${dateFilter}
             GROUP BY DATE(created_at) 
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
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST: Track a page view
export async function POST(req: NextRequest) {
    try {
        const db = await getDB()
        const { page, product_id } = await req.json()

        const userAgent = req.headers.get('user-agent') || ''

        await db.prepare(
            'INSERT INTO analytics (page, product_id, user_agent) VALUES (?, ?, ?)'
        ).bind(page, product_id || null, userAgent).run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
