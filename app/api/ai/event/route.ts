/**
 * POST /api/ai/event/: content-free UI beacons from the chat panel (SPEC 8.2): open, card_click,
 * add_to_cart, wa_shown, wa_click, stop, new_chat. They feed the admin usage table (add-to-cart and
 * WhatsApp clicks per day). The body carries ids and codes only, never text; it answers 204 at once and
 * writes in ctx.waitUntil.
 */
import { isBotUserAgent } from '@/lib/bot-user-agent'
import { parseUiEvent } from '@/lib/assistant/request'
import { ipKey, recordUiEvent, type D1Lite } from '@/lib/assistant/limits'
import { clientIp } from '@/lib/assistant/data'
import { sha16 } from '@/lib/assistant/turn'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 1024
const noContent = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } })

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
    if (!sameOrigin(req) || isBotUserAgent(req.headers.get('user-agent'))) {
        return Response.json({ error: 'forbidden' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } })
    }
    const raw = await req.text().catch(() => '')
    if (!raw || raw.length > MAX_BODY_BYTES) return Response.json({ error: 'bad_request' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    let body: unknown
    try {
        body = JSON.parse(raw)
    } catch {
        return Response.json({ error: 'bad_request' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    }
    const ev = parseUiEvent(body)
    if (!ev) return Response.json({ error: 'bad_request' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })

    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env, ctx } = await getCloudflareContext({ async: true })
    try {
        if (env.CHAT_RL_BURST && !(await env.CHAT_RL_BURST.limit({ key: `ev:${ipKey(clientIp(req))}` })).success) return noContent()
    } catch {
        // Rate limiting is best-effort for beacons
    }
    ctx.waitUntil((async () => {
        await recordUiEvent(env.DB as unknown as D1Lite, ev, await sha16(ev.conversationId))
    })())
    return noContent()
}
