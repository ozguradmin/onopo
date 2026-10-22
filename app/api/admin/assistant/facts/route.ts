/**
 * /api/admin/assistant/facts/: the Onopo Asistan's product facts lines (admin only).
 *
 * GET  → { total, ready, missing }: how many active products have a fresh line written by the chat model.
 * POST { exclude?: number[] } → writes missing or outdated lines for ~20 s, one call every 4 s with retries on
 *        rate limits (lib/assistant/facts-auto.ts), and answers { done, failed, failedIds, remaining, total,
 *        ready, stopped }. The "Ürün bilgilerini yenile" button on /admin/assistant repeats the request while
 *        `remaining` > 0, sending the ids that failed so far in `exclude`, until `stopped` is a real error.
 *        Lines are also written automatically (after admin saves and by the daily cron); the button only
 *        hurries them. Until a product has a line, the assistant uses a deterministic extract of its description.
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { fillProductFacts, staleFactItems } from '@/lib/assistant/data'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }
/** One request works this long, so the page can show progress (each call starts 4 s after the previous). */
const REQUEST_WINDOW_MS = 20_000

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

export async function POST(req: Request) {
    const denied = await requireAdmin()
    if (denied) return denied
    try {
        const body = (await req.json().catch(() => null)) as { exclude?: unknown } | null
        const exclude = Array.isArray(body?.exclude)
            ? body.exclude.map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 500)
            : []
        const { getCloudflareContext } = await import('@opennextjs/cloudflare')
        const { env } = await getCloudflareContext({ async: true })
        if (!env.AI) return NextResponse.json({ error: 'Yapay zekâ bağlantısı yok.' }, { status: 503, headers })
        const r = await fillProductFacts(env, { deadline: Date.now() + REQUEST_WINDOW_MS, exclude })
        return NextResponse.json(r, { headers })
    } catch (err) {
        console.error('ai_admin_facts_fill_failed', err instanceof Error ? err.name : 'error')
        return NextResponse.json({ error: 'Ürün bilgileri yenilenemedi.' }, { status: 500, headers })
    }
}
