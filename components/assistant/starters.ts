/**
 * Onopo Asistan: starter chips of the empty chat (SPEC §10.5). Pure, so node --test can check them.
 *
 * Why they depend on the page, the cart and the clock: a visitor on a product page asks about that product,
 * one with a cart just under the free-shipping threshold is one product away from free shipping, and "Bugün
 * kargoda olur mu?" is only an honest question before the same-day cut-off. The cut-off chip carries
 * `chip: 'faq_cutoff'`, so the server answers it from the store facts without a model call.
 *
 * Order (owner, w8): the fixed "Kargo bedava için ne eklesem?", then up to 3 questions visitors asked most last
 * week (public setting ai_popular_questions, written by the weekly analysis), then the page chips; 4 at most.
 *
 * The shipping days and the cut-off are admin-only settings (ai_ship_days, ai_ship_cutoff) that the browser
 * does not receive; the chip label uses the same defaults as the server (weekdays, 18:00). The server's answer
 * always uses the real values, so at worst the label is a question whose answer is "no".
 */
import { maskPII, type PageContext, type Suggestion } from '@/lib/assistant/contract'

export type ShipDays = 'hafta-ici' | 'hafta-ici-cumartesi'

export interface StarterInput {
    page: PageContext
    /** Items total of the cart at display prices (lib/pricing itemsTotal); 0 for an empty cart. */
    cartTotal: number
    /** A cart line has free shipping: the whole order ships free (lib/pricing shippingCost). */
    cartHasFreeShipping: boolean
    freeThreshold: number
    now: Date
    shipDays?: ShipDays
    /** 'HH:MM' Istanbul time */
    cutoff?: string
    /** Public setting ai_popular_questions (JSON string array, or the parsed array); anything else is ignored. */
    popular?: unknown
}

/** Turkey has used UTC+3 all year since 2016 (no DST). */
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000

/** Day of week (0 = Sunday) and minutes since midnight in Istanbul. */
export function istanbulClock(now: Date): { day: number; minutes: number } {
    const t = new Date(now.getTime() + ISTANBUL_OFFSET_MS)
    return { day: t.getUTCDay(), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() }
}

function cutoffMinutes(cutoff: string): number {
    const m = /^(\d{1,2})[:.](\d{2})$/.exec(cutoff.trim())
    if (!m) return 18 * 60
    return Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2]))
}

/** Today is a shipping day and the clock is before the cut-off (Istanbul time). */
export function beforeCutoff(now: Date, shipDays: ShipDays = 'hafta-ici', cutoff = '18:00'): boolean {
    const { day, minutes } = istanbulClock(now)
    const shippingDay = day >= 1 && (day <= 5 || (day === 6 && shipDays === 'hafta-ici-cumartesi'))
    return shippingDay && minutes < cutoffMinutes(cutoff)
}

export const FREE_SHIPPING_CHIP = 'Kargo bedava için ne eklesem?'
export const MAX_STARTERS = 4
export const MAX_POPULAR = 3

/**
 * The questions of ai_popular_questions that may become chips: strings of 3–80 characters, no links, no
 * markup, nothing the PII mask would change; at most 3, without repeats. Bad JSON or a non-array gives none.
 */
export function popularQuestions(value: unknown): string[] {
    let list: unknown = value
    if (typeof value === 'string') {
        try {
            list = JSON.parse(value)
        } catch {
            return []
        }
    }
    if (!Array.isArray(list)) return []
    const out: string[] = []
    const seen = new Set<string>()
    for (const q of list) {
        if (typeof q !== 'string') continue
        const text = q.replace(/\s+/g, ' ').trim()
        if (text.length < 3 || text.length > 80) continue
        if (/https?:|www\.|[<>{}]/i.test(text) || maskPII(text) !== text) continue
        const key = text.toLocaleLowerCase('tr')
        if (seen.has(key)) continue
        seen.add(key)
        out.push(text)
        if (out.length >= MAX_POPULAR) break
    }
    return out
}

/**
 * Empty-chat chips: first the fixed "Kargo bedava için ne eklesem?" (left out only when the cart already ships
 * free), then up to 3 of the week's popular questions, then the page chips; at most 4, no label twice.
 */
export function starters(input: StarterInput): Suggestion[] {
    const cutoffChip: Suggestion = beforeCutoff(input.now, input.shipDays, input.cutoff)
        ? { label: 'Bugün kargoda olur mu?', chip: 'faq_cutoff' }
        : { label: 'Ne zaman kargoya verilir?', chip: 'faq_cutoff' }

    let pageChips: Suggestion[]
    switch (input.page.type) {
        case 'product':
            pageChips = [
                { label: 'Telefonuma uyar mı?' },
                { label: 'Kutuda neler var?' },
                { label: 'Benzerleriyle karşılaştır' },
                { label: 'Yanına ne alınır?' },
            ]
            break
        case 'category':
        case 'listing':
            pageChips = [
                { label: 'Bu kategoride en çok satan' },
                { label: 'Fiyat/performans önerisi' },
                { label: '500 TL altı öneri' },
                cutoffChip,
            ]
            break
        default:
            // "Kargo ne zaman gelir?" (faq_cutoff), worded for the time of day
            pageChips = [
                { label: 'iPhone 15 için şarj aleti' },
                { label: 'Ekran koruyucu öner' },
                cutoffChip,
                { label: 'Samsung için hızlı şarj' },
            ]
    }

    const shipsFree = input.cartHasFreeShipping || (input.freeThreshold > 0 && input.cartTotal >= input.freeThreshold)
    const fixed: Suggestion[] = shipsFree || input.freeThreshold <= 0 ? [] : [{ label: FREE_SHIPPING_CHIP }]
    const popular: Suggestion[] = popularQuestions(input.popular).map(label => ({ label }))

    const out: Suggestion[] = []
    const seen = new Set<string>()
    for (const c of [...fixed, ...popular, ...pageChips]) {
        const key = c.label.toLocaleLowerCase('tr')
        if (seen.has(key)) continue
        seen.add(key)
        out.push(c)
        if (out.length >= MAX_STARTERS) break
    }
    return out
}
