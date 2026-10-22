/**
 * Onopo Asistan: request validation and input cleaning (pure, isomorphic).
 *
 * Why: everything in a chat request is untrusted, including the history, which a visitor can edit.
 * This module turns a JSON body into a typed ChatRequest or one ErrorCode, and cleans the text before
 * masking (zero-width and bidi characters are a common way to smuggle instructions past filters).
 * The masked text (maskPII after sanitize) is the only version that reaches the router, the model,
 * suggestions or a WhatsApp summary.
 */
import type { ChatRequest, ChipAction, ErrorCode, HandoffReason, HistoryMessage, PageContext, UiEventBody, UiEventType } from './contract'
import { LIMITS, maskPII } from './contract'

/** Zero-width and bidi controls (U+200B–200F, U+202A–202E, U+2060–2064, U+FEFF), built from code points so the source stays ASCII. */
const INVISIBLE = new RegExp(`[${[[0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2064], [0xfeff, 0xfeff]].map(([a, b]) => `${String.fromCharCode(a)}-${String.fromCharCode(b)}`).join('')}]`, 'g')

/** NFKC, no zero-width/bidi/control characters (except \n), at most two newlines in a row, trimmed. */
export function sanitize(text: string): string {
    return String(text ?? '')
        .normalize('NFKC')
        .replace(/\r\n?/g, '\n')
        .replace(INVISIBLE, '')
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

export const CHIP_ACTIONS: readonly ChipAction[] = ['faq_shipping', 'faq_cutoff', 'faq_returns', 'faq_installments', 'faq_payment']
export const HANDOFF_REASONS: readonly HandoffReason[] = [
    'whatsapp_order', 'order_status', 'return', 'payment', 'bulk', 'compatibility', 'product_request', 'complaint', 'human', 'other',
]
const UI_EVENT_TYPES: readonly UiEventType[] = ['open', 'card_click', 'add_to_cart', 'wa_shown', 'wa_click', 'stop', 'new_chat', 'cart_change', 'cart_undo']
const UI_SOURCES = ['launcher', 'nudge', 'search', 'header', 'chip', 'card'] as const

export const CONVERSATION_ID_RE = /^[A-Za-z0-9-]{8,64}$/
const SLUG_RE = /^[a-z0-9-]{1,120}$/

export type ParseResult = { ok: true; req: ChatRequest } | { ok: false; code: ErrorCode }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isPosInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0

/**
 * A page context the server can use; anything malformed becomes { type: 'other' } instead of failing the
 * whole chat (a stale client or an odd slug should never cost the visitor an answer).
 */
function parsePage(v: unknown): PageContext {
    if (!isObj(v)) return { type: 'other' }
    switch (v.type) {
        case 'home':
            return { type: 'home' }
        case 'product':
        case 'category':
        case 'page':
            return typeof v.slug === 'string' && SLUG_RE.test(v.slug) ? { type: v.type, slug: v.slug } : { type: 'other' }
        case 'listing': {
            const out: { type: 'listing'; query?: string; facets?: string[] } = { type: 'listing' }
            if (typeof v.query === 'string') {
                // Masked like the message: the query reaches the router and the model's turn context
                const q = maskPII(sanitize(v.query).replace(/\s+/g, ' ').slice(0, 100))
                if (q) out.query = q
            }
            if (Array.isArray(v.facets)) {
                const facets = v.facets.filter((f): f is string => typeof f === 'string' && /^[a-z0-9-]{1,30}$/.test(f)).slice(0, 8)
                if (facets.length) out.facets = facets
            }
            return out
        }
        default:
            return { type: 'other' }
    }
}

function parseHistory(v: unknown): HistoryMessage[] | null {
    if (v == null) return []
    if (!Array.isArray(v)) return null
    const out: HistoryMessage[] = []
    // The client sends at most the last 10; keep the newest 10 if it ever sends more
    for (const h of v.slice(-LIMITS.historyMaxMessages)) {
        if (!isObj(h) || (h.role !== 'user' && h.role !== 'assistant') || typeof h.text !== 'string') return null
        const msg: HistoryMessage = { role: h.role, text: h.text.slice(0, LIMITS.historyMessageMaxChars) }
        if (h.role === 'assistant') {
            if (Array.isArray(h.productIds)) {
                const ids = h.productIds.filter(isPosInt).slice(0, 8)
                if (ids.length) msg.productIds = ids
            }
            if (h.wa === true) msg.wa = true
        }
        out.push(msg)
    }
    return out
}

/** Section 8.1 (2): every rule of the chat request. */
export function parseChatRequest(body: unknown): ParseResult {
    const bad: ParseResult = { ok: false, code: 'bad_request' }
    if (!isObj(body) || body.v !== 1) return bad
    if (typeof body.conversationId !== 'string' || !CONVERSATION_ID_RE.test(body.conversationId)) return bad
    if (typeof body.input !== 'string') return bad
    const input = body.input.trim()
    if (input.length > LIMITS.serverMaxChars) return { ok: false, code: 'too_long' }
    if (!sanitize(input)) return bad

    let chip: ChipAction | undefined
    if (body.chip != null) {
        if (typeof body.chip !== 'string' || !(CHIP_ACTIONS as readonly string[]).includes(body.chip)) return bad
        chip = body.chip as ChipAction
    }

    const history = parseHistory(body.history)
    if (!history) return bad

    if (!isObj(body.context)) return bad
    const ctx = body.context
    const turn = ctx.turn
    if (typeof turn !== 'number' || !Number.isInteger(turn) || turn < 1 || turn > 200) return bad
    if (turn > LIMITS.conversationMaxUserTurns) return { ok: false, code: 'conversation_limit' }

    let cart: { id: number; qty: number }[] = []
    if (ctx.cart != null) {
        if (!Array.isArray(ctx.cart)) return bad
        for (const line of ctx.cart.slice(0, LIMITS.cartMaxLines)) {
            if (!isObj(line) || !isPosInt(line.id) || typeof line.qty !== 'number' || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 99) return bad
            cart.push({ id: line.id, qty: line.qty })
        }
    }
    cart = cart.slice(0, LIMITS.cartMaxLines)

    let device: string | null = null
    if (ctx.device != null) {
        if (typeof ctx.device !== 'string') return bad
        const d = sanitize(ctx.device).replace(/\s+/g, ' ')
        if (d.length > 40) return bad
        // A tampered client could put anything here; it reaches the model, so it is masked like the message
        device = maskPII(d) || null
    }

    return {
        ok: true,
        req: {
            v: 1,
            conversationId: body.conversationId,
            input,
            ...(chip ? { chip } : {}),
            history,
            context: { page: parsePage(ctx.page), cart, device, turn },
        },
    }
}

/** POST /api/ai/event/ body → UiEventBody, or null when invalid. Content-free by construction. */
export function parseUiEvent(body: unknown): UiEventBody | null {
    if (!isObj(body) || body.v !== 1) return null
    if (typeof body.conversationId !== 'string' || !CONVERSATION_ID_RE.test(body.conversationId)) return null
    if (typeof body.type !== 'string' || !(UI_EVENT_TYPES as readonly string[]).includes(body.type)) return null
    const ev: UiEventBody = { v: 1, conversationId: body.conversationId, type: body.type as UiEventType }
    if (body.productId != null) {
        if (!isPosInt(body.productId)) return null
        ev.productId = body.productId
    }
    if (body.reason != null) {
        if (typeof body.reason !== 'string' || !(HANDOFF_REASONS as readonly string[]).includes(body.reason)) return null
        ev.reason = body.reason as HandoffReason
    }
    if (body.source != null) {
        if (typeof body.source !== 'string' || !(UI_SOURCES as readonly string[]).includes(body.source)) return null
        ev.source = body.source as UiEventBody['source']
    }
    return ev
}
