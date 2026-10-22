/**
 * Onopo Asistan: starter chips of the empty chat (SPEC §10.5). Pure, so node --test can check them.
 *
 * Why they depend on the page, the cart and the clock: a visitor on a product page asks about that product,
 * one with a cart just under the free-shipping threshold is one product away from free shipping, and "Bugün
 * kargoda olur mu?" is only an honest question before the same-day cut-off. The cut-off chip carries
 * `chip: 'faq_cutoff'`, so the server answers it from the store facts without a model call.
 *
 * The shipping days and the cut-off are admin-only settings (ai_ship_days, ai_ship_cutoff) that the browser
 * does not receive; the chip label uses the same defaults as the server (weekdays, 18:00). The server's answer
 * always uses the real values, so at worst the label is a question whose answer is "no".
 */
import type { PageContext, Suggestion } from '@/lib/assistant/contract'

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

export function starters(input: StarterInput): Suggestion[] {
    const cutoffChip: Suggestion = beforeCutoff(input.now, input.shipDays, input.cutoff)
        ? { label: 'Bugün kargoda olur mu?', chip: 'faq_cutoff' }
        : { label: 'Ne zaman kargoya verilir?', chip: 'faq_cutoff' }

    let chips: Suggestion[]
    switch (input.page.type) {
        case 'product':
            chips = [
                { label: 'Telefonuma uyar mı?' },
                { label: 'Kutuda neler var?' },
                { label: 'Benzerleriyle karşılaştır' },
                { label: 'Yanına ne alınır?' },
            ]
            break
        case 'category':
        case 'listing':
            chips = [
                { label: 'Bu kategoride en çok satan' },
                { label: 'Fiyat/performans önerisi' },
                { label: '500 TL altı öneri' },
                cutoffChip,
            ]
            break
        default:
            // "Kargo ne zaman gelir?" (faq_cutoff), worded for the time of day
            chips = [
                { label: 'iPhone 15 için şarj aleti' },
                { label: 'Ekran koruyucu öner' },
                cutoffChip,
                { label: 'Samsung için hızlı şarj' },
            ]
    }

    const underThreshold = input.cartTotal > 0 && !input.cartHasFreeShipping && input.freeThreshold > 0 && input.cartTotal < input.freeThreshold
    if (underThreshold) chips = [{ label: FREE_SHIPPING_CHIP }, ...chips]
    return chips.slice(0, 4)
}
