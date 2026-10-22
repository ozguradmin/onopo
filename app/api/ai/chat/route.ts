/**
 * POST /api/ai/chat/: the Onopo Asistan chat turn (SPEC 8.1). Streams text/event-stream, one JSON
 * AssistantEvent per `data:` line.
 *
 * This file is only the adapter: guards that answer with a JSON error before any stream (origin, bots,
 * body, kill switch, maintenance, rate limits, the daily per-IP cap), then runTurn (lib/assistant/turn.ts)
 * writes events into a TransformStream while ctx.waitUntil keeps the Worker alive. No chat text is logged
 * or stored anywhere; only the content-free TurnLog goes to D1.
 */
import { NextResponse } from 'next/server'
import { isBotUserAgent } from '@/lib/bot-user-agent'
import { ERROR_STATUS, encodeEvent, type AssistantEvent, type ErrorCode } from '@/lib/assistant/contract'
import { parseChatRequest } from '@/lib/assistant/request'
import { runTurn } from '@/lib/assistant/turn'
import { clientIp, getAssistantSettings, isAssistantEnabled, isMaintenance, makeTurnDeps, type AssistantSettings } from '@/lib/assistant/data'
import { countIpTurn, IP_DAILY_TURNS, ipKey, recordTurn, type D1Lite } from '@/lib/assistant/limits'
import { secondsUntilIstanbulMidnight } from '@/lib/assistant/facts'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store' }
const MAX_BODY_BYTES = 16 * 1024

function fail(code: ErrorCode, retryAfter?: number) {
    console.log(`ai_chat_reject code=${code}`)
    return NextResponse.json(retryAfter != null ? { error: code, retryAfter } : { error: code }, {
        status: ERROR_STATUS[code],
        headers: retryAfter != null ? { ...noStore, 'Retry-After': String(retryAfter) } : noStore,
    })
}

/** Same-origin browser requests only: the Origin header must name this host. */
function sameOrigin(req: Request): boolean {
    const origin = req.headers.get('origin')
    if (!origin) return false
    try {
        return new URL(origin).host === new URL(req.url).host
    } catch {
        return false
    }
}

export async function POST(req: Request) {
    // 1. Origin, bots, content type, size
    if (!sameOrigin(req) || isBotUserAgent(req.headers.get('user-agent'))) return fail('forbidden')
    if (!(req.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) return fail('bad_request')
    const declared = Number(req.headers.get('content-length') ?? '0')
    if (declared > MAX_BODY_BYTES) return fail('bad_request')

    // 2. Body → ChatRequest
    const raw = await req.text().catch(() => null)
    if (raw == null || raw.length > MAX_BODY_BYTES) return fail('bad_request')
    let body: unknown
    try {
        body = JSON.parse(raw)
    } catch {
        return fail('bad_request')
    }
    const parsed = parseChatRequest(body)
    if (!parsed.ok) return fail(parsed.code)

    // Imported lazily like lib/db.ts does, so the build never evaluates the Cloudflare context
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env, ctx } = await getCloudflareContext({ async: true })
    const db = env.DB

    // 3. Kill switch, maintenance, binding
    let settings: AssistantSettings
    try {
        settings = await getAssistantSettings(db)
    } catch {
        return fail('busy')
    }
    if (!isAssistantEnabled(settings)) return fail('off')
    if (isMaintenance(settings)) return fail('maintenance')
    if (!env.AI) return fail('off')

    // 4. Workers Rate Limiting (a missing binding allows)
    const ip = clientIp(req)
    const key = ipKey(ip)
    try {
        if (env.CHAT_RL_BURST && !(await env.CHAT_RL_BURST.limit({ key })).success) return fail('rate_limited', 10)
        if (env.CHAT_RL_MIN && !(await env.CHAT_RL_MIN.limit({ key })).success) return fail('rate_limited', 60)
    } catch {
        // A rate-limit outage must not take the assistant down
    }

    // 5. Daily per-IP cap (D1, hashed IP)
    const now = new Date()
    try {
        if ((await countIpTurn(db as unknown as D1Lite, ip, now)) > IP_DAILY_TURNS) return fail('rate_limited', secondsUntilIstanbulMidnight(now))
    } catch {
        // Counter unavailable: the binding limits and the budget still hold
    }

    // The stream
    const deps = makeTurnDeps(env, req, settings)
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
    const writer = writable.getWriter()
    const enc = new TextEncoder()
    const turnAbort = new AbortController()
    req.signal?.addEventListener('abort', () => turnAbort.abort())
    const emit = (ev: AssistantEvent) => {
        writer.write(enc.encode(encodeEvent(ev))).catch(() => turnAbort.abort())
    }
    ctx.waitUntil((async () => {
        try {
            const log = await runTurn(parsed.req, deps, emit, turnAbort.signal)
            console.log(`ai_turn outcome=${log.outcome} ms=${log.totalMs} calls=${log.modelCalls}`)
            await recordTurn(db as unknown as D1Lite, log)
        } catch (err) {
            console.error('ai_turn_failed', err instanceof Error ? err.name : 'error')
            emit({ t: 'error', code: 'upstream' })
            emit({ t: 'done', finish: 'error', productIds: [], wa: false })
        } finally {
            await writer.close().catch(() => {})
        }
    })())
    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'private, no-store, no-transform',
            'X-Accel-Buffering': 'no',
            'X-Content-Type-Options': 'nosniff',
        },
    })
}
