/**
 * /api/admin/assistant/facts/: the Onopo Asistan's product facts lines (admin only).
 *
 * GET  → { total, ready, missing }: how many active products have a fresh line written by the chat model.
 * POST → fills up to 6 missing or outdated lines (2 model calls at a time) and answers
 *        { done, failed, remaining, total, ready }. The "Ürün bilgilerini yenile" button on /admin/assistant
 *        calls it again while `remaining` > 0, so each request stays short. Until a product has a line,
 *        the assistant uses a deterministic extract of its description (lib/assistant/product-facts.ts).
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { fillProductFacts, staleFactItems } from '@/lib/assistant/data'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }
const BATCH = 6

export async function GET() {
    const denied = await requireAdmin()
    if (denied) return denied
    try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare')
        const { env } = await getCloudflareContext({ async: true })
        const s = await staleFactItems(env.DB)
        return NextResponse.json({ total: s.total, ready: s.ready, missing: s.stale.length }, { headers })
    } catch (err) {
        console.error('ai_admin_facts_failed', err instanceof Error ? err.name : 'error')
        return NextResponse.json({ error: 'Ürün bilgileri okunamadı.' }, { status: 500, headers })
    }
}

export async function POST() {
    const denied = await requireAdmin()
    if (denied) return denied
    try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare')
        const { env } = await getCloudflareContext({ async: true })
        if (!env.AI) return NextResponse.json({ error: 'Yapay zekâ bağlantısı yok.' }, { status: 503, headers })
        const r = await fillProductFacts(env, BATCH, 2)
        return NextResponse.json(r, { headers })
    } catch (err) {
        console.error('ai_admin_facts_fill_failed', err instanceof Error ? err.name : 'error')
        return NextResponse.json({ error: 'Ürün bilgileri yenilenemedi.' }, { status: 500, headers })
    }
}
