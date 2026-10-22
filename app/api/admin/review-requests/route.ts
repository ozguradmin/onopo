/**
 * Admin › Yorumlar, "Değerlendirme e-postaları" box (lib/order-reviews.ts).
 *   GET  → { ready, enabled, days, sent, failed, reviews }   the switch and the last 30 days' numbers
 *   POST { enabled: boolean } → same shape                  switches the daily e-mails on or off
 * Counts only: no address, no order list. Not a storefront write (lib/edge-cache.ts exception list).
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { readJsonBody } from '@/lib/api-request'
import { getDB } from '@/lib/db'
import { REVIEW_REQUESTS_SETTING, reviewRequestStats, type ReviewsDb } from '@/lib/order-reviews'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET() {
    const denied = await requireAdmin()
    if (denied) return denied
    try {
        const db = (await getDB()) as unknown as ReviewsDb
        return NextResponse.json(await reviewRequestStats(db), { headers })
    } catch (err) {
        console.error('review_requests_stats_failed', err instanceof Error ? err.message : 'error')
        return NextResponse.json({ error: 'Veriler okunamadı.' }, { status: 500, headers })
    }
}

export async function POST(req: Request) {
    const denied = await requireAdmin()
    if (denied) return denied
    const parsed = await readJsonBody(req)
    if (!parsed.ok) return parsed.response
    if (typeof parsed.body.enabled !== 'boolean') return NextResponse.json({ error: 'enabled true ya da false olmalı.' }, { status: 400, headers })
    try {
        const db = await getDB()
        await db
            .prepare('INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
            .bind(REVIEW_REQUESTS_SETTING, parsed.body.enabled ? '1' : '0')
            .run()
        return NextResponse.json(await reviewRequestStats(db as unknown as ReviewsDb), { headers })
    } catch (err) {
        console.error('review_requests_toggle_failed', err instanceof Error ? err.message : 'error')
        return NextResponse.json({ error: 'Ayar kaydedilemedi.' }, { status: 500, headers })
    }
}
