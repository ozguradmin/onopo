/**
 * GET /api/admin/assistant/conversations/?from=YYYY-MM-DD&to=YYYY-MM-DD&q=<search>&page=1 (admin only)
 * → { rows: ConversationSummary[]; total; page; pageSize }: stored Onopo Asistan conversations, newest
 * activity first, 30 a page. `q` searches the (masked) message texts; the dates are Istanbul days of the
 * first message. The shapes live in lib/assistant/transcripts.ts (shared with the admin "Sohbetler" page).
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getDB } from '@/lib/db'
import { listConversations, parseListParams } from '@/lib/assistant/transcripts'
import type { D1Lite } from '@/lib/assistant/limits'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(req: Request) {
    const denied = await requireAdmin()
    if (denied) return denied
    try {
        const db = await getDB()
        const params = parseListParams(new URL(req.url).searchParams)
        return NextResponse.json(await listConversations(db as unknown as D1Lite, params), { headers })
    } catch (err) {
        console.error('ai_admin_conversations_failed', err instanceof Error ? err.name : 'error')
        return NextResponse.json({ error: 'Sohbetler alınamadı.' }, { status: 500, headers })
    }
}
