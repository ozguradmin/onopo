/**
 * Onopo Asistan: sentence-level output validator (pure, isomorphic). Rules from SPEC section 6.
 *
 * Why: the system prompt asks the model not to invent prices, discounts, coupons, urgency, brand claims or
 * promises, but a prompt is not a guarantee. Every sentence the model writes passes through this guard
 * BEFORE it reaches the browser: a price that is not a real price of this turn is replaced, everything else
 * that breaks a rule is dropped. Text is released one sentence at a time, so the visitor still sees a stream.
 * It never inspects the visitor's own text, only the model's.
 */
import { maskPII } from './contract'
import { foldTr } from '../search'
import { normalizeCutoff } from './facts'

export interface AllowedFacts {
    /** Real prices of this turn (display prices, shipping threshold/cost, cart total, remaining). */
    prices: number[]
    /** Canonical numbers ("14", "1499.99") and clocks ("clock:18:00") seen in facts, turn context, tool results, user texts. */
    numbers: Set<string>
    /** Concatenated tool results of this turn plus the catalogue lines of the products named in them. */
    toolText: string
    /** The store's same-day cut-off ("18:00"). */
    cutoff: string
    /** site_settings.ai_campaigns ("Yok" when none). */
    campaigns: string
}

export const PRICE_REPLACEMENT = 'Güncel fiyatı karttan görebilirsin.'
export const MAX_VISIBLE_CHARS = 1200
const MAX_SENTENCE = 220

/** "1.499,99" → 1499.99, "549,99" → 549.99, "129.99" → 129.99, "14" → 14; NaN when not a number. */
export function parseTrNumber(s: string): number {
    const t = s.trim()
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'))
    if (/^\d+,\d+$/.test(t)) return Number(t.replace(',', '.'))
    if (/^\d+(\.\d+)?$/.test(t)) return Number(t)
    return NaN
}

const canon = (n: number) => String(Math.round(n * 100) / 100)
const clockKey = (h: string | number, m: string) => `clock:${Number(h)}:${m}`

/** Adds every number and clock in `text` to the set. */
export function addNumbers(set: Set<string>, text: string): void {
    for (const m of text.matchAll(/\d+(?:[.,]\d+)*/g)) {
        const n = parseTrNumber(m[0])
        if (Number.isFinite(n)) set.add(canon(n))
        // "1.499" can be both a thousand-separated number and a decimal: keep the plain integer parts too
        for (const part of m[0].split(/[.,]/)) if (part) set.add(canon(Number(part)))
    }
    for (const m of text.matchAll(/(\d{1,2})[:.](\d{2})(?!\d)/g)) set.add(clockKey(m[1], m[2]))
}

export function collectAllowed(src: { prices: number[]; texts: string[]; toolText?: string; cutoff: string; campaigns: string }): AllowedFacts {
    const numbers = new Set<string>()
    for (const t of src.texts) addNumbers(numbers, t)
    return {
        prices: src.prices.filter(Number.isFinite),
        numbers,
        toolText: src.toolText ?? '',
        cutoff: normalizeCutoff(src.cutoff),
        campaigns: src.campaigns || 'Yok',
    }
}

/** A tool result of this turn: its text and numbers become allowed. */
export function addToolText(allowed: AllowedFacts, text: string): void {
    allowed.toolText += `\n${text}`
    addNumbers(allowed.numbers, text)
}

// ---------------------------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------------------------

const RE_PRICE = /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:TL|₺|lira)/gi
const RE_PERCENT = /%\s?(\d+)|(\d+)\s?%/g
const RE_DISCOUNT_WORD = /indirim|eski fiyat|tasarruf|yerine/g
const RE_COUPON_WORD = /\b(kupon|kod|promosyon)/
const RE_CODE_TOKEN = /\b(?=[A-Z0-9]*[A-Z])[A-Z0-9]{4,}\b/g
const RE_LINK = /https?:\/\/|www\.|wa\.me|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/iu
const RE_URGENCY = /son \d+|tukenmek uzere|stokta sadece|kacirma|sadece bugun|fiyat artacak|acele et|son firsat/
const RE_BRAND = /\borijinal|\blisansli|apple onayli|\bmfi\b|resmi urun/g
const RE_COMMIT = /(\d+(?:[.,]\d+)?)\s*(gun|saat|dakika|aylik|ayda|aya|ay(?![a-z])|yil|adet|hafta)/g
const RE_CLOCK = /(^|[^\d.,])(\d{1,2})[:.](\d{2})(?![\d,])(?!\s*(?:tl|₺|lira|m\b|mt|metre|cm|mm|a\b|w\b|v\b|mah))/g

type Verdict = { ok: true } | { ok: false; flag: string; price?: true }

function compact(s: string): string {
    return s.replace(/\s+/g, '')
}

function checkSentence(sentence: string, a: AllowedFacts): Verdict {
    const s = sentence
    const f = foldTr(s)
    const tool = foldTr(a.toolText)
    const campaigns = a.campaigns.trim() === 'Yok' ? '' : a.campaigns

    // Contact and links: phone numbers, e-mails, IBAN/ID/card numbers (maskPII), URLs, wa.me
    if (RE_LINK.test(s) || maskPII(s) !== s) return { ok: false, flag: 'contact' }

    // Coupon codes (a code the tool data or the owner's campaigns contain is a product code / real campaign)
    if (RE_COUPON_WORD.test(f)) {
        for (const m of s.matchAll(RE_CODE_TOKEN)) {
            if (!a.toolText.includes(m[0]) && !campaigns.includes(m[0])) return { ok: false, flag: 'coupon' }
        }
    }

    if (RE_URGENCY.test(f)) return { ok: false, flag: 'urgency' }

    // Percentages and discount talk
    for (const m of s.matchAll(RE_PERCENT)) {
        const pct = `%${m[1] ?? m[2]}`
        if (!compact(a.toolText).includes(pct) && !compact(campaigns).includes(pct)) return { ok: false, flag: 'discount' }
    }
    for (const m of f.matchAll(RE_DISCOUNT_WORD)) {
        const at = m.index ?? 0
        const around = f.slice(Math.max(0, at - 12), at + m[0].length + 12)
        const nums = around.match(/\d+(?:[.,]\d+)*/g)
        if (nums && nums.some(n => !campaigns.includes(n))) return { ok: false, flag: 'discount' }
    }

    for (const m of f.matchAll(RE_BRAND)) {
        if (!tool.includes(m[0].replace(/^\W+/, ''))) return { ok: false, flag: 'brand_claim' }
    }

    for (const m of f.matchAll(RE_COMMIT)) {
        const n = parseTrNumber(m[1])
        if (!Number.isFinite(n) || !a.numbers.has(canon(n))) return { ok: false, flag: 'commitment' }
    }

    for (const m of f.matchAll(RE_CLOCK)) {
        const key = clockKey(m[2], m[3])
        const cut = normalizeCutoff(a.cutoff).split(':')
        if (key !== clockKey(cut[0], cut[1]) && !a.numbers.has(key)) return { ok: false, flag: 'clock' }
    }

    for (const m of s.matchAll(RE_PRICE)) {
        const n = parseTrNumber(m[1])
        if (!Number.isFinite(n) || !a.prices.some(p => Math.abs(p - n) <= 0.01)) return { ok: false, flag: 'price_mismatch', price: true }
    }
    return { ok: true }
}

// ---------------------------------------------------------------------------------------------
// Streaming guard
// ---------------------------------------------------------------------------------------------

export interface GuardStats {
    dropped: number
    replaced: number
    flags: string[]
    emittedChars: number
}

export interface TextGuard {
    /** Feed a model text delta; returns the validated text pieces ready to emit (often none). */
    push(delta: string): string[]
    /** End of one model call: validate what is left. */
    flush(): string[]
    /** A model call failed: forget its unvalidated text (what was already emitted stays). */
    discard(): void
    stats: GuardStats
}

/** Index just after the first sentence boundary (with its trailing whitespace), or -1. */
function boundary(buf: string, final: boolean): number {
    for (let i = 0; i < buf.length; i++) {
        const c = buf[i]
        if (c === '\n') {
            let j = i + 1
            while (j < buf.length && /\s/.test(buf[j])) j++
            return j
        }
        if (c === '.' || c === '!' || c === '?' || c === '…') {
            let j = i + 1
            while (j < buf.length && /[.!?…"'”’)]/.test(buf[j])) j++
            if (j >= buf.length) return final ? j : -1
            if (/\s/.test(buf[j])) {
                while (j < buf.length && /\s/.test(buf[j])) j++
                return j
            }
        }
    }
    return -1
}

export function createTextGuard(allowed: AllowedFacts): TextGuard {
    let buf = ''
    let priceReplaced = false
    let stopped = false
    let pendingSep = false
    let lastEmitted = ''
    const flags = new Set<string>()
    const stats: GuardStats = { dropped: 0, replaced: 0, flags: [], emittedChars: 0 }
    const flag = (f: string) => {
        if (!flags.has(f)) {
            flags.add(f)
            stats.flags.push(f)
        }
    }

    const emitPiece = (piece: string, out: string[]) => {
        if (stopped || !piece) return
        if (stats.emittedChars + piece.trimEnd().length > MAX_VISIBLE_CHARS) {
            stopped = true
            flag('length_cap')
            out.push('…')
            stats.emittedChars += 1
            return
        }
        if (pendingSep && !/^\s/.test(piece)) piece = ' ' + piece
        pendingSep = false
        out.push(piece)
        stats.emittedChars += piece.length
        lastEmitted = piece
    }

    const handle = (sentence: string, out: string[]) => {
        const body = sentence.trimEnd()
        const tail = sentence.slice(body.length)
        if (!body.trim()) {
            if (stats.emittedChars > 0) emitPiece(sentence, out)
            return
        }
        const v = checkSentence(body, allowed)
        if (v.ok) return emitPiece(sentence, out)
        flag(v.flag)
        if (v.price && !priceReplaced) {
            priceReplaced = true
            stats.replaced++
            return emitPiece(PRICE_REPLACEMENT + (tail || ' '), out)
        }
        stats.dropped++
        flag('validator_drop')
    }

    const drain = (final: boolean): string[] => {
        const out: string[] = []
        for (;;) {
            let idx = boundary(buf, final)
            if (idx < 0 && buf.length > MAX_SENTENCE) {
                const space = buf.lastIndexOf(' ', MAX_SENTENCE)
                idx = space > 0 ? space + 1 : MAX_SENTENCE
            }
            if (idx < 0) break
            const sentence = buf.slice(0, idx)
            buf = buf.slice(idx)
            handle(sentence, out)
        }
        if (final && buf) {
            const rest = buf
            buf = ''
            handle(rest, out)
        }
        return out
    }

    return {
        push(delta: string) {
            if (!delta) return []
            buf += delta
            return drain(false)
        },
        flush() {
            const out = drain(true)
            // The next model call's text starts a new sentence: keep a space between them
            if (lastEmitted && !/\s$/.test(lastEmitted)) pendingSep = true
            return out
        },
        discard() {
            buf = ''
        },
        stats,
    }
}
