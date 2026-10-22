/**
 * /api/admin/assistant/popular/: the "popular questions" chips of the empty chat (admin only).
 *
 * GET  → { questions, meta }: the stored list (site_settings.ai_popular_questions, public) and when / how it
 *        was set (ai_popular_questions_meta, admin only).
 * POST → runs the weekly analysis now ("Şimdi analiz et"): { status, questions, messages, meta }. With fewer
 *        than 20 messages in the last 7 days, or no valid answer, the old list stays (status says why).
 * PUT  { questions: string[] } → the admin's own list (validated like the analysis output; [] clears it).
 * Writes go through worker.ts like every /api/admin/ write, so the cache version is bumped after them.
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { runPopularAnalysis } from '@/lib/assistant/data'
import { cleanQuestions, readPopular, writePopular } from '@/lib/assistant/popular'
import type { D1Lite } from '@/lib/assistant/limits'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }

async function env() {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    return (await getCloudflareContext({ async: true })).env
}

export async function GET() {
    const denied = await requireAdmin()
    if (denied) return denied
    try {
        const e = await env()
        return NextResponse.json(await readPopular(e.DB as unknown as D1Lite), { headers })
    } catch (err) {
        console.error('ai_admin_popular_failed', err instanceof Error ? err.name : 'error')
        return NextResponse.json({ error: 'Sorular okunamadı.' }, { status: 500, headers })
    }
}

export async function POST() {
    const denied = await requireAdmin()
    if (denied) return denied
    try {
        const e = await env()
        if (!e.AI) return NextResponse.json({ error: 'Yapay zekâ bağlantısı yok.' }, { status: 503, headers })
        const r = await runPopularAnalysis(e)
        const state = await readPopular(e.DB as unknown as D1Lite)
        return NextResponse.json({ status: r.status, questions: state.questions, messages: r.messages, meta: state.meta }, { headers })
    } catch (err) {
        console.error('ai_admin_popular_run_failed', err instanceof Error ? err.name : 'error')
        return NextResponse.json({ error: 'Analiz yapılamadı.' }, { status: 500, headers })
    }
}

export async function PUT(req: Request) {
    const denied = await requireAdmin()
    if (denied) return denied
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400, headers })
    }
    const raw = (body as { questions?: unknown })?.questions
    if (!Array.isArray(raw) || raw.length > 3) return NextResponse.json({ error: 'En çok 3 soru girilebilir.' }, { status: 400, headers })
    const filled = raw.filter(q => typeof q === 'string' && q.trim() !== '')
    const questions = cleanQuestions(filled)
    if (questions.length !== filled.length) {
        return NextResponse.json({ error: 'Her soru 4–32 karakter olmalı; numara, bağlantı ya da kişisel bilgi içermemeli.' }, { status: 400, headers })
    }
    try {
        const e = await env()
        const db = e.DB as unknown as D1Lite
        await writePopular(db, questions, { at: new Date().toISOString(), source: 'admin', messages: 0 })
        return NextResponse.json(await readPopular(db), { headers })
    } catch (err) {
        console.error('ai_admin_popular_save_failed', err instanceof Error ? err.name : 'error')
        return NextResponse.json({ error: 'Kaydedilemedi.' }, { status: 500, headers })
    }
}
