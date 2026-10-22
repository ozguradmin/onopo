/**
 * POST /api/ai/popular/: the weekly popular-questions analysis of the Onopo Asistan (lib/assistant/popular.ts).
 *
 * Only the scheduled handler in worker.ts calls it (Mondays, Europe/Istanbul), in-process, with
 * `Authorization: Bearer <CRON_SECRET>` like /api/cron/update-prices/. The admin button uses
 * /api/admin/assistant/popular/ instead. Answers { status, questions, messages, changed }; worker.ts bumps the
 * cache version when `changed` is true so the storefront picks up the new chips. No chat text is logged.
 */
import { NextResponse } from 'next/server'
import { runPopularAnalysis } from '@/lib/assistant/data'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }

export async function POST(req: Request) {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
    }
    try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare')
        const { env } = await getCloudflareContext({ async: true })
        if (!env.AI) return NextResponse.json({ error: 'ai_binding_missing' }, { status: 503, headers })
        const r = await runPopularAnalysis(env)
        console.log(`ai_popular status=${r.status} messages=${r.messages} n=${r.questions.length}`)
        return NextResponse.json({ status: r.status, questions: r.questions, messages: r.messages, changed: r.status === 'updated' }, { headers })
    } catch (err) {
        console.error('ai_popular_failed', err instanceof Error ? err.name : 'error')
        return NextResponse.json({ error: 'failed' }, { status: 500, headers })
    }
}
