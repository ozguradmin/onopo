/**
 * Onopo Asistan: the ONE shared contract between the chat API (package A, app/api/ai/*, lib/assistant/*)
 * and the chat UI (package B, components/assistant/*). Isomorphic and dependency-free: node --test loads it.
 * Owned by neither package. Change it only through a SPEC revision, then update both sides.
 */

export const ASSISTANT_API_PATH = '/api/ai/chat/'
export const ASSISTANT_EVENT_PATH = '/api/ai/event/'
export const PROTOCOL_VERSION = 1 as const

export const LIMITS = {
    inputMaxChars: 500,            // UI textarea maxLength (counter from 400)
    serverMaxChars: 800,           // server: 413 too_long above this
    historyMaxMessages: 10,        // client sends at most the last 10 finished messages
    historyMessageMaxChars: 1200,
    conversationMaxUserTurns: 25,
    cartMaxLines: 30,
    waSummaryMaxChars: 160,
    waMessageMaxChars: 600,
    clientTimeoutMs: 35_000,
    slowNoticeMs: 6_000,
    stuckNoticeMs: 15_000,
    persistMaxMessages: 30,
    persistMaxAgeMs: 2 * 60 * 60 * 1000,
} as const

export type GroupKey =
    | 'sarj-aleti' | 'arac-sarj' | 'kablo' | 'ekran-koruyucu-seramik' | 'ekran-koruyucu-9d' | 'ekran-koruyucu'
    | 'kulaklik' | 'powerbank' | 'supurge' | 'yazici' | 'oyun' | 'diger'

export type HandoffReason =
    | 'whatsapp_order' | 'order_status' | 'return' | 'payment' | 'bulk'
    | 'compatibility' | 'product_request' | 'complaint' | 'human' | 'other'

export const HANDOFF_LABELS: Record<HandoffReason, string> = {
    whatsapp_order: 'WhatsApp ile sipariş',
    order_status: 'Sipariş ve kargo durumu',
    return: 'İade / değişim',
    payment: 'Ödeme',
    bulk: 'Toplu alım',
    compatibility: 'Uyumluluk sorusu',
    product_request: 'Ürün talebi',
    complaint: 'Şikâyet',
    human: 'Ekiple görüşme',
    other: 'Soru',
}

/** Quick chips answered by the server WITHOUT a model call, or ('whatsapp') handled locally by the UI. */
export type ChipAction = 'faq_shipping' | 'faq_cutoff' | 'faq_returns' | 'faq_installments' | 'faq_payment'
export interface Suggestion { label: string; chip?: ChipAction | 'whatsapp' }

export type PageContext =
    | { type: 'home' }
    | { type: 'product'; slug: string }
    | { type: 'category'; slug: string }
    | { type: 'listing'; query?: string; facets?: string[] }
    | { type: 'page'; slug: string }
    | { type: 'other' }

export interface HistoryMessage {
    role: 'user' | 'assistant'
    text: string                  // assistant: the validated text only; no cards, no reasoning
    productIds?: number[]         // assistant: products shown in that turn
    wa?: boolean                  // assistant: a WhatsApp card (any variant) was shown in that turn
}

export interface ChatRequest {
    v: 1
    conversationId: string        // crypto.randomUUID(), one per conversation ("Yeni sohbet" makes a new one)
    input: string                 // the new user message (for a chip: the chip label)
    chip?: ChipAction
    history: HistoryMessage[]     // ≤ LIMITS.historyMaxMessages, oldest first, finished messages only
    context: {
        page: PageContext
        cart: { id: number; qty: number }[]   // product id = leading digits of the cart item id
        device: string | null                 // phone model pill
        turn: number                          // 1-based index of this user message in the conversation
    }
}

export interface CardProduct {
    id: number
    slug: string
    href: string                  // productPath(slug), e.g. '/onopo-67w-gan-sarj-seti/'
    name: string                  // displayName(name)
    code: string | null
    price: number                 // RAW D1 price: pass to <Price> and toCartItem as-is
    displayPrice: number          // roundPrice(price): what is charged
    originalPrice: number | null  // raw, only when > price (cards show it like the site; the model never sees it)
    image: string | null          // stored ref '/api/images/<key>'
    rating: { average: number; count: number } | null   // null = no reviews (UI shows the site default stars)
    freeShipping: boolean
    inStock: boolean
    hasVariations: boolean
    isBestSeller: boolean
    whatsappOrder: boolean
    category: string | null
}

export type StepId =
    | 'understand' | 'search' | 'details' | 'prices' | 'compare'
    | 'categories' | 'store_info' | 'whatsapp' | 'deeper' | 'fallback'

/** Active label (shimmer) and done label (✓). {n} is replaced by the step's count; null done = hide when done. */
export const STEP_LABELS: Record<StepId, { active: string; done: string | null }> = {
    understand: { active: 'Sorunu anlıyorum…', done: null },
    search: { active: 'Ürünleri arıyorum…', done: '{n} ürün bulundu' },
    details: { active: 'Ürün bilgilerini okuyorum…', done: 'Ürün bilgileri alındı' },
    prices: { active: 'Güncel fiyatları kontrol ediyorum…', done: 'Fiyatlar güncel' },
    compare: { active: 'Ürünleri karşılaştırıyorum…', done: '{n} ürün karşılaştırıldı' },
    categories: { active: 'Kategorilere bakıyorum…', done: 'Kategori bulundu' },
    store_info: { active: 'Kargo ve ödeme bilgilerine bakıyorum…', done: 'Bilgiler alındı' },
    whatsapp: { active: 'WhatsApp mesajını hazırlıyorum…', done: 'Mesaj hazır' },
    deeper: { active: 'Daha ayrıntılı düşünüyorum…', done: null },
    fallback: { active: 'Yoğunluk var, yanıtı hazırlamaya devam ediyorum…', done: null },
}

export function stepLabel(id: StepId, state: 'active' | 'done', n?: number): string | null {
    const raw = state === 'active' ? STEP_LABELS[id].active : STEP_LABELS[id].done
    if (raw == null) return null
    return raw.replace('{n}', String(n ?? '')).trim()
}

export type ErrorCode =
    | 'bad_request' | 'forbidden' | 'too_long' | 'rate_limited' | 'conversation_limit'
    | 'off' | 'maintenance' | 'busy' | 'timeout' | 'upstream'

/** HTTP status the API uses for each pre-stream error (body: { error: ErrorCode, retryAfter?: number }). */
export const ERROR_STATUS: Record<ErrorCode, number> = {
    bad_request: 400, forbidden: 403, too_long: 413, rate_limited: 429, conversation_limit: 429,
    off: 503, maintenance: 503, busy: 503, timeout: 504, upstream: 502,
}

export interface LinkItem { title: string; href: string; count: number | null; fromPrice: number | null; icon: string | null }
export interface InfoRow { icon: 'truck' | 'clock' | 'card' | 'return' | 'shield' | 'chat'; text: string }

export type AssistantEvent =
    | { t: 'meta'; turnId: string; mode: 'llm' | 'canned' | 'fallback'; waBase: string | null }
    | { t: 'step'; id: StepId; state: 'active' | 'done'; n?: number }
    | { t: 'text'; v: string }
    | { t: 'device'; v: string }
    | { t: 'products'; layout: 'single' | 'carousel'; products: CardProduct[]; moreHref: string | null; total: number | null }
    | { t: 'compare'; products: CardProduct[]; rows: { label: string; values: string[] }[] }
    | { t: 'links'; items: LinkItem[] }
    | { t: 'store_info'; rows: InfoRow[]; href: string | null }
    | { t: 'whatsapp'; variant: 'full' | 'compact'; reason: HandoffReason; message: string; waBase: string; productIds: number[] }
    | { t: 'suggestions'; chips: Suggestion[] }
    | { t: 'error'; code: ErrorCode; retryAfter?: number }
    | { t: 'done'; finish: 'stop' | 'cards' | 'canned' | 'error'; productIds: number[]; wa: boolean }

export type UiEventType = 'open' | 'card_click' | 'add_to_cart' | 'wa_shown' | 'wa_click' | 'stop' | 'new_chat'
export interface UiEventBody {
    v: 1
    conversationId: string
    type: UiEventType
    productId?: number
    reason?: HandoffReason
    source?: 'launcher' | 'nudge' | 'search' | 'header' | 'chip' | 'card'
}

// ---- SSE framing (one JSON event per `data:` line, blank line after each) ----

export function encodeEvent(ev: AssistantEvent): string {
    return `data: ${JSON.stringify(ev)}\n\n`
}

/** Incremental decoder: feed decoded text chunks, get complete events back. Ignores comments and bad JSON. */
export function createEventDecoder(): (chunk: string) => AssistantEvent[] {
    let buf = ''
    return (chunk: string) => {
        buf += chunk.replace(/\r\n/g, '\n')
        const out: AssistantEvent[] = []
        let i: number
        while ((i = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, i)
            buf = buf.slice(i + 2)
            for (const line of block.split('\n')) {
                if (!line.startsWith('data:')) continue
                try { out.push(JSON.parse(line.slice(5).trim()) as AssistantEvent) } catch { /* skip */ }
            }
        }
        return out
    }
}

// ---- Turkish price text ("1.499,99 TL"), same digits as lib/format formatTL ----

export function formatPriceTR(n: number): string {
    const [int, dec] = (Math.round(n * 100) / 100).toFixed(2).split('.')
    return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} TL`
}

// ---- Personal data masking (server: before the model and before any log; UI: auto summaries) ----

const RE_EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu
const RE_IBAN = /\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi
// No lookbehind: older iOS Safari (< 16.4) cannot parse it, and this file ships in the chat chunk
const RE_DIGIT_RUN = /(^|\D)(\d(?:[ -]?\d){9,18})(?!\d)/g
const RE_PHONE = /(?:\+?90[\s-]?)?\(?0?5\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)/g

function isTckn(d: string): boolean {
    if (!/^[1-9]\d{10}$/.test(d)) return false
    const n = [...d].map(Number)
    const odd = n[0] + n[2] + n[4] + n[6] + n[8]
    const even = n[1] + n[3] + n[5] + n[7]
    if ((((odd * 7 - even) % 10) + 10) % 10 !== n[9]) return false
    return n.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === n[10]
}

function luhn(d: string): boolean {
    let sum = 0
    let alt = false
    for (let i = d.length - 1; i >= 0; i--) {
        let x = d.charCodeAt(i) - 48
        if (alt) { x *= 2; if (x > 9) x -= 9 }
        sum += x
        alt = !alt
    }
    return sum % 10 === 0
}

export function maskPII(text: string): string {
    return text
        .replace(RE_EMAIL, '[e-posta]')
        .replace(RE_IBAN, '[iban]')
        .replace(RE_DIGIT_RUN, (m, pre: string, run: string) => {
            const d = run.replace(/\D/g, '')
            if (d.length === 11 && isTckn(d)) return pre + '[tckn]'
            if (d.length >= 13 && luhn(d)) return pre + '[kart]'
            if (/^(?:90)?0?5\d{9}$/.test(d)) return pre + '[telefon]'
            return m
        })
        .replace(RE_PHONE, '[telefon]')
}

// ---- WhatsApp prefill (server builds it for cards; UI uses it for header / sold-out / error cards) ----

export interface WaProductRef { name: string; code: string | null; href: string; displayPrice: number }

export function buildWhatsappMessage(
    reason: HandoffReason, summary: string, product: WaProductRef | null, origin = 'onopostore.com',
): string {
    const clean = maskPII(summary)
        .replace(/https?:\/\/\S+|www\.\S+/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, LIMITS.waSummaryMaxChars)
    const lines = ['Merhaba Onopo, sitedeki yapay zekâ asistanından yazıyorum.', `Konu: ${HANDOFF_LABELS[reason]}`]
    if (reason === 'whatsapp_order' && product) lines.push('Bu ürünü WhatsApp üzerinden sipariş vermek istiyorum.')
    if (clean) lines.push(`Sorum: ${clean}`)
    if (product) {
        lines.push(`Ürün: ${product.name}${product.code ? ` (Kod: ${product.code})` : ''} – ${formatPriceTR(product.displayPrice)}`)
        lines.push(`${origin}${product.href}`)
    }
    if (reason === 'order_status' || reason === 'return' || reason === 'payment') lines.push('Sipariş no: ')
    if (reason === 'bulk') lines.push('Adet: ')
    return lines.join('\n').slice(0, LIMITS.waMessageMaxChars)
}

/** wa.me link for a card: base from the server (number never shown as text) + the (possibly edited) message. */
export function whatsappLink(waBase: string, message: string): string {
    return `${waBase}?text=${encodeURIComponent(message.slice(0, LIMITS.waMessageMaxChars))}`
}
