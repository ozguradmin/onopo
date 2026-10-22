/**
 * Onopo Asistan: the chat UI's message model and the one function that folds a server event into it
 * (SPEC §10.8). Pure and isomorphic: node --test checks it, and the hook (useAssistantChat.ts) only
 * moves events from the stream into here.
 *
 * Why a model of our own instead of keeping raw events: the panel re-renders one assistant message per
 * event, history for the next request is derived from it (only finished, validated text: no cards, no
 * reasoning, which the protocol never carries anyway), and sessionStorage keeps it across page loads.
 *
 * Rules that the server also follows but the UI must not depend on: the first WhatsApp card of a turn wins,
 * cards keep their arrival order, and a `done` ends the turn even if a step was still shown as active.
 */
import {
    buildWhatsappMessage,
    formatPriceTR,
    maskPII,
    LIMITS,
    type AssistantEvent,
    type CardProduct,
    type ChipAction,
    type ErrorCode,
    type HandoffReason,
    type HistoryMessage,
    type StepId,
    type Suggestion,
} from '@/lib/assistant/contract'
import { displayPrice } from '@/lib/format'

export type CardEvent = Extract<AssistantEvent, { t: 'products' | 'compare' | 'links' | 'store_info' }>
export type WhatsappEvent = Extract<AssistantEvent, { t: 'whatsapp' }>
export type UiErrorCode = ErrorCode | 'network' | 'offline'

export interface UiStep {
    id: StepId
    state: 'active' | 'done'
    n?: number
}

export interface UiMessage {
    id: string
    role: 'user' | 'assistant'
    text: string
    createdAt: number
    steps: UiStep[]
    cards: CardEvent[]
    whatsapp: WhatsappEvent | null
    suggestions: Suggestion[]
    status: 'streaming' | 'done' | 'error' | 'stopped'
    error: { code: UiErrorCode; retryAfter?: number } | null
    productIds: number[]
    wa: boolean
    stale?: Record<number, 'price' | 'gone'>
    /** user: the chip that sent it (resent as is by "Tekrar dene") */
    chip?: ChipAction
    /** assistant: a card the UI added itself (header button, sold out, chip); never sent as history */
    local?: boolean
}

let seq = 0

export function newMessageId(): string {
    seq = (seq + 1) % 1_000_000
    return `m${Date.now().toString(36)}${seq.toString(36)}`
}

function base(role: UiMessage['role'], now: number): UiMessage {
    return {
        id: newMessageId(), role, text: '', createdAt: now, steps: [], cards: [], whatsapp: null,
        suggestions: [], status: 'done', error: null, productIds: [], wa: false,
    }
}

export function userMessage(text: string, chip?: ChipAction, now = Date.now()): UiMessage {
    const m = base('user', now)
    m.text = text
    if (chip) m.chip = chip
    return m
}

export function assistantMessage(now = Date.now()): UiMessage {
    const m = base('assistant', now)
    m.status = 'streaming'
    return m
}

/** Active steps become done when the turn ends (a done label of null then hides them). */
export function settleSteps(steps: UiStep[]): UiStep[] {
    return steps.some(s => s.state === 'active') ? steps.map(s => (s.state === 'active' ? { ...s, state: 'done' as const } : s)) : steps
}

export function applyEvent(msg: UiMessage, ev: AssistantEvent): UiMessage {
    switch (ev.t) {
        case 'text':
            return { ...msg, text: msg.text + ev.v }
        case 'step': {
            const i = msg.steps.findIndex(s => s.id === ev.id)
            const step: UiStep = ev.n != null ? { id: ev.id, state: ev.state, n: ev.n } : { id: ev.id, state: ev.state }
            if (i < 0) return { ...msg, steps: [...msg.steps, step] }
            const steps = msg.steps.slice()
            steps[i] = ev.n == null && steps[i].n != null ? { ...step, n: steps[i].n } : step
            return { ...msg, steps }
        }
        case 'products':
        case 'compare':
        case 'links':
        case 'store_info':
            return { ...msg, cards: [...msg.cards, ev] }
        case 'whatsapp':
            return msg.whatsapp ? msg : { ...msg, whatsapp: ev, wa: true }
        case 'suggestions':
            return { ...msg, suggestions: ev.chips.slice(0, 3) }
        case 'error':
            return { ...msg, error: ev.retryAfter != null ? { code: ev.code, retryAfter: ev.retryAfter } : { code: ev.code } }
        case 'done':
            return {
                ...msg,
                status: ev.finish === 'error' || msg.error ? 'error' : 'done',
                productIds: ev.productIds.slice(),
                wa: ev.wa || msg.wa,
                steps: settleSteps(msg.steps),
            }
        default:
            // meta and device are handled by the hook (waBase, the phone model pill)
            return msg
    }
}

/** The last finished messages as request history (SPEC §10.8 step 2): text only, oldest first. */
export function toHistory(messages: UiMessage[], max: number = LIMITS.historyMaxMessages): HistoryMessage[] {
    const out: HistoryMessage[] = []
    for (const m of messages) {
        if (m.local || (m.status !== 'done' && m.status !== 'stopped')) continue
        const text = m.text.trim().slice(0, LIMITS.historyMessageMaxChars)
        if (!text) continue
        const h: HistoryMessage = { role: m.role, text }
        if (m.role === 'assistant') {
            if (m.productIds.length) h.productIds = m.productIds.slice(0, 12)
            if (m.wa) h.wa = true
        }
        out.push(h)
    }
    return out.slice(-max)
}

/** Text of the visitor's last message (the summary of a WhatsApp card the UI builds itself). */
export function lastUserText(messages: UiMessage[]): string {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'user') return messages[i].text
    return ''
}

/**
 * A WhatsApp card built in the browser (header button, sold-out card, `chip: 'whatsapp'`, error rows):
 * same message builder as the server, summary masked, number only inside `waBase`.
 */
export function localWhatsapp(opts: {
    reason: HandoffReason
    summary: string
    waBase: string
    product?: CardProduct | null
    variant?: 'full' | 'compact'
}): WhatsappEvent {
    const p = opts.product ?? null
    return {
        t: 'whatsapp',
        variant: opts.variant ?? 'full',
        reason: opts.reason,
        message: buildWhatsappMessage(
            opts.reason,
            maskPII(opts.summary),
            p ? { name: p.name, code: p.code, href: p.href, displayPrice: p.displayPrice } : null,
        ),
        waBase: opts.waBase,
        productIds: p ? [p.id] : [],
    }
}

/** An assistant message that only holds a local WhatsApp card. */
export function localCardMessage(card: WhatsappEvent, now = Date.now()): UiMessage {
    const m = base('assistant', now)
    m.whatsapp = card
    m.wa = true
    m.local = true
    return m
}

export interface IndexPrice {
    id: number
    price: number
    original_price: number | null
    stock: number
}

/**
 * A chat restored after more than 30 minutes: refresh card prices and stock from the search index by id
 * (SPEC §10.8). A changed price is marked 'price' ("Fiyat güncellendi"), a product no longer sold 'gone'.
 */
export function patchStaleCards(messages: UiMessage[], index: IndexPrice[]): UiMessage[] {
    const byId = new Map(index.map(i => [Number(i.id), i]))
    return messages.map(m => {
        if (!m.cards.some(c => c.t === 'products' || c.t === 'compare')) return m
        const stale: Record<number, 'price' | 'gone'> = { ...(m.stale ?? {}) }
        const patch = (p: CardProduct): CardProduct => {
            const row = byId.get(p.id)
            if (!row) {
                stale[p.id] = 'gone'
                return { ...p, inStock: false }
            }
            const price = Number(row.price)
            const original = row.original_price != null && Number(row.original_price) > price ? Number(row.original_price) : null
            if (Math.abs(price - p.price) > 0.001) stale[p.id] = 'price'
            return { ...p, price, displayPrice: displayPrice(price), originalPrice: original, inStock: Number(row.stock) > 0 }
        }
        const cards = m.cards.map((c): CardEvent => {
            if (c.t === 'products') return { ...c, products: c.products.map(patch) }
            if (c.t !== 'compare') return c
            const products = c.products.map(patch)
            const rows = c.rows.map(r => {
                if (r.label === 'Fiyat') return { ...r, values: products.map(p => formatPriceTR(p.displayPrice)) }
                if (r.label === 'Stok') return { ...r, values: products.map(p => (p.inStock ? 'Var' : 'Tükendi')) }
                return r
            })
            return { ...c, products, rows }
        })
        return { ...m, cards, stale }
    })
}

