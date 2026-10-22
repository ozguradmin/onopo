/**
 * Onopo Asistan: follow-up chips after a turn (pure, isomorphic). The table is SPEC 4.4.
 *
 * Why a fixed table: chips are the cheapest next step (FAQ chips are answered without a model call)
 * and must never promise anything; a table keeps them predictable and testable.
 */
import type { ChipAction, GroupKey, Suggestion } from './contract'

/** Labels of the FAQ chips (sent back as `input` with `chip`). */
export const FAQ_CHIPS: readonly Suggestion[] = [
    { label: 'Ne zaman kargoya verilir?', chip: 'faq_cutoff' },
    { label: 'Kargo ücreti ne kadar?', chip: 'faq_shipping' },
    { label: 'İade nasıl yapılır?', chip: 'faq_returns' },
    { label: 'Taksit var mı?', chip: 'faq_installments' },
    { label: 'Hangi ödeme yöntemleri var?', chip: 'faq_payment' },
]

const FREE_SHIPPING_CHIP: Suggestion = { label: 'Kargo bedava için ne eklesem?' }
const WHATSAPP_CHIP: Suggestion = { label: "WhatsApp'tan sor", chip: 'whatsapp' }
const DEFAULT_CHIPS: Suggestion[] = [{ label: 'Telefonuma uygun şarj aleti' }, { label: 'Ekran koruyucu öner' }]

export type TurnEnd =
    | { kind: 'products'; group: GroupKey | null }
    | { kind: 'compare' }
    | { kind: 'faq'; chip: ChipAction }
    | { kind: 'whatsapp_full' }
    | { kind: 'other' }

export function buildSuggestions(end: TurnEnd, opts: { remaining: number | null; waShown: boolean }): Suggestion[] {
    if (end.kind === 'whatsapp_full') return []
    let chips: Suggestion[]
    switch (end.kind) {
        case 'products':
            if (end.group === 'sarj-aleti' || end.group === 'arac-sarj') {
                chips = [{ label: 'Uygun kabloyu da göster' }, { label: 'Daha uygun fiyatlısı var mı?' }]
            } else if (end.group === 'kablo') {
                chips = [{ label: 'Uygun şarj aletini göster' }, { label: 'Daha uzun olanı var mı?' }]
            } else if (end.group === 'ekran-koruyucu-seramik' || end.group === 'ekran-koruyucu-9d' || end.group === 'ekran-koruyucu') {
                chips = [{ label: 'Seramik ile 9D farkı ne?' }, { label: 'Ne zaman kargoya verilir?', chip: 'faq_cutoff' }]
            } else {
                chips = [{ label: 'Daha uygun fiyatlısı var mı?' }, { label: 'Benzerlerini göster' }]
            }
            break
        case 'compare':
            chips = [{ label: 'Hangisini önerirsin?' }, { label: 'Ne zaman kargoya verilir?', chip: 'faq_cutoff' }]
            break
        case 'faq':
            chips = FAQ_CHIPS.filter(c => c.chip !== end.chip).slice(0, 2)
            break
        default:
            chips = [...DEFAULT_CHIPS]
    }
    if (opts.remaining != null && opts.remaining > 0) chips.push(FREE_SHIPPING_CHIP)
    if (!opts.waShown) chips.push(WHATSAPP_CHIP)
    return chips.slice(0, 3)
}
