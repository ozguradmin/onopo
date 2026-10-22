/**
 * GET /api/analytics/stats/?days=7|30: everything Admin › İstatistikler shows (admin only, never cached).
 * Page views, distinct visitors (cookieless, see lib/analytics.ts), the daily chart, most viewed products and
 * pages, devices, traffic sources, Onopo Asistan usage and orders per range. The work is in lib/analytics-db.ts.
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getDB } from '@/lib/db'
import { loadStats, type D1Lite } from '@/lib/analytics-db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const denied = await requireAdmin()
    if (denied) return denied
    const headers = { 'Cache-Control': 'private, no-store' }
    try {
        const days = new URL(req.url).searchParams.get('days') === '7' ? 7 : 30
        const db = await getDB()
        const stats = await loadStats(db as unknown as D1Lite, { days })
        return NextResponse.json(stats, { headers })
    } catch (err) {
        console.error('analytics_stats_failed', err instanceof Error ? err.message : 'error')
        return NextResponse.json({ error: 'İstatistikler alınamadı.' }, { status: 500, headers })
    }
}
