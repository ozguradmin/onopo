/**
 * GET /api/admin/assistant/: usage of the Onopo Asistan for the last 7 days (admin only, SPEC 8.3).
 * Everything comes from the content-free tables: ai_usage_daily (global row) and ai_chat_events.
 * There is no chat text to show, because none is stored.
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getDB } from '@/lib/db'
import { ensureTables, type D1Lite } from '@/lib/assistant/limits'
import { istanbulDay } from '@/lib/assistant/facts'

export const dynamic = 'force-dynamic'

interface AssistantUsageDay {
    day: string
    turns: number
    modelCalls: number
    costUsd: number
    modes: Record<string, number>
    outcomes: { fallback: number; busy: number; error: number; timeout: number; blocked: number }
    handoffs: number
    addToCart: number
    waClicks: number
    firstTextP50: number | null
}

function median(values: number[]): number | null {
    if (!values.length) return null
    const s = [...values].sort((a, b) => a - b)
    const mid = Math.floor(s.length / 2)
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

export async function GET() {
    const denied = await requireAdmin()
    if (denied) return denied
    const headers = { 'Cache-Control': 'no-store' }
    try {
        const db = await getDB()
        await ensureTables(db as unknown as D1Lite)
        const now = new Date()
        const days = Array.from({ length: 7 }, (_, i) => istanbulDay(now, 6 - i))
        const from = days[0]
        const [usage, turnStats, uiStats, firstText] = await db.batch([
            db.prepare("SELECT day, turns, model_calls, cost_micro_usd FROM ai_usage_daily WHERE bucket = 'global' AND day >= ?").bind(from),
            db.prepare(`SELECT day, mode, outcome, COUNT(*) AS n, SUM(CASE WHEN handoff IS NOT NULL THEN 1 ELSE 0 END) AS handoffs
FROM ai_chat_events WHERE kind = 'turn' AND day >= ? GROUP BY day, mode, outcome`).bind(from),
            db.prepare("SELECT day, outcome, COUNT(*) AS n FROM ai_chat_events WHERE kind = 'ui' AND day >= ? AND outcome IN ('add_to_cart', 'wa_click') GROUP BY day, outcome").bind(from),
            db.prepare("SELECT day, first_text_ms FROM ai_chat_events WHERE kind = 'turn' AND day >= ? AND first_text_ms IS NOT NULL ORDER BY id DESC LIMIT 2000").bind(from),
        ])
        const byDay = new Map<string, AssistantUsageDay>(days.map(day => [day, {
            day, turns: 0, modelCalls: 0, costUsd: 0, modes: {},
            outcomes: { fallback: 0, busy: 0, error: 0, timeout: 0, blocked: 0 },
            handoffs: 0, addToCart: 0, waClicks: 0, firstTextP50: null,
        }]))
        for (const r of (usage.results ?? []) as { day: string; turns: number; model_calls: number; cost_micro_usd: number }[]) {
            const d = byDay.get(r.day)
            if (!d) continue
            d.turns = Number(r.turns) || 0
            d.modelCalls = Number(r.model_calls) || 0
            d.costUsd = Math.round((Number(r.cost_micro_usd) || 0) / 100) / 10_000
        }
        for (const r of (turnStats.results ?? []) as { day: string; mode: string | null; outcome: string | null; n: number; handoffs: number }[]) {
            const d = byDay.get(r.day)
            if (!d) continue
            const n = Number(r.n) || 0
            const mode = r.mode || 'llm'
            d.modes[mode] = (d.modes[mode] ?? 0) + n
            const o = r.outcome as keyof AssistantUsageDay['outcomes']
            if (o in d.outcomes) d.outcomes[o] += n
            d.handoffs += Number(r.handoffs) || 0
        }
        for (const r of (uiStats.results ?? []) as { day: string; outcome: string; n: number }[]) {
            const d = byDay.get(r.day)
            if (!d) continue
            if (r.outcome === 'add_to_cart') d.addToCart += Number(r.n) || 0
            if (r.outcome === 'wa_click') d.waClicks += Number(r.n) || 0
        }
        const firstByDay = new Map<string, number[]>()
        for (const r of (firstText.results ?? []) as { day: string; first_text_ms: number }[]) {
            const list = firstByDay.get(r.day) ?? []
            list.push(Number(r.first_text_ms) || 0)
            firstByDay.set(r.day, list)
        }
        for (const [day, list] of firstByDay) {
            const d = byDay.get(day)
            if (d) d.firstTextP50 = median(list)
        }
        return NextResponse.json({ days: [...byDay.values()] }, { headers })
    } catch (err) {
        console.error('ai_admin_usage_failed', err instanceof Error ? err.name : 'error')
        return NextResponse.json({ error: 'Kullanım verisi alınamadı.' }, { status: 500, headers })
    }
}
