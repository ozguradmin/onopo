/**
 * Onopo Asistan: fixed Turkish answers that need no model call (pure, isomorphic). Texts from SPEC 9.6.
 *
 * Why: greetings, refusals, the busy fallback and the FAQ chips are the same every time, so they cost
 * nothing, cannot hallucinate and answer instantly. The FAQ texts are filled from the same StoreFacts
 * the model sees, so the canned answer and a model answer can never disagree.
 */
import type { AssistantEvent, ChipAction, HandoffReason } from './contract'
import type { StoreFacts } from './facts'
import { amountText, sameDayInfo, shipDaysText } from './facts'

export const CANNED = {
    greeting: 'Merhaba! Ben Onopo Asistan, yapay zekâ destekli alışveriş asistanıyım. Telefonuna uygun şarj aleti, kablo ya da ekran koruyucu bulmana yardım edebilirim. Ne arıyorsun?',
    off_topic: 'Ben yalnızca Onopo ürünleri ve alışverişinle ilgili yardımcı olabiliyorum. Örneğin telefonuna uygun şarj aletini ya da ekran koruyucuyu bulabilirim.',
    refusal: 'Bunu yapamam ama ürünlerimizle ilgili her soruna yardımcı olabilirim. Ne arıyorsun?',
    busy: "Şu an çok yoğunuz ve yanıt hazırlayamadım. Sorunu WhatsApp'tan ekibimize hemen iletebilirsin; mesajın hazır.",
    /** Not in SPEC 9.6: the model returned nothing usable (every sentence failed the validator). */
    unsure: "Bundan emin değilim. İstersen ekibimize WhatsApp'tan sorabilirsin.",
} as const

export type CannedKey = 'greeting' | 'off_topic' | 'refusal'

/** Text shown when a turn produced cards but no text. */
export const DEFAULT_TEXT: Record<'products' | 'compare' | 'links' | 'store_info' | 'whatsapp', string> = {
    products: 'Sana uygun seçenekler şunlar:',
    compare: 'Karşılaştırma aşağıda:',
    links: 'Şu sayfaya göz atabilirsin:',
    store_info: 'Bilgiler aşağıda:',
    whatsapp: 'Ekibimize buradan hazır mesajla yazabilirsin:',
}

function cutoffText(f: StoreFacts, now: Date): string {
    const sd = sameDayInfo(now, f)
    if (sd.sameDay) {
        const days = shipDaysText(f).toLocaleLowerCase('tr-TR')
        return `Şimdi sipariş verirsen bugün kargoya verilir; ${days} saat ${f.cutoff}'e kadar verilen siparişler aynı gün kargoda.`
    }
    return `Saat ${f.cutoff}'den sonra ya da kargo günü dışında verilen siparişler sonraki kargo gününde (${sd.nextDayName ?? 'Pazartesi'}) kargoya verilir.`
}

export interface FaqAnswer {
    text: string
    /** Extra card events (none today; kept so a chip can add a card without touching the turn code). */
    events: AssistantEvent[]
    /** A WhatsApp card the turn adds (compact), e.g. for returns. */
    handoff: HandoffReason | null
}

/** Canned answer for a FAQ chip (section 9.6). */
export function faqAnswer(chip: ChipAction, f: StoreFacts, now: Date): FaqAnswer {
    switch (chip) {
        case 'faq_shipping':
            return {
                text: `${amountText(f.freeThreshold)} TL ve üzeri siparişlerde kargo ücretsiz; altında kargo ücreti ${amountText(f.shippingCost)} TL. ${cutoffText(f, now)}`,
                events: [],
                handoff: null,
            }
        case 'faq_cutoff':
            return { text: cutoffText(f, now), events: [], handoff: null }
        case 'faq_returns':
            return {
                text: `Teslimden itibaren ${f.returnDays} gün içinde cayma hakkın var. Ambalajı açılmış bazı ürünlerde hijyen nedeniyle istisna olabilir; iade ve değişim için ekibimiz WhatsApp'tan yardımcı olur.`,
                events: [],
                handoff: 'return',
            }
        case 'faq_installments':
            return {
                text: f.maxInstallments
                    ? `Kredi kartına ${f.maxInstallments} aya varan taksit seçeneği var. Taksit seçenekleri ve tutarları ödeme adımında kartının bankasına göre gösterilir.`
                    : 'Taksit seçenekleri ödeme adımında kartına göre gösterilir.',
                events: [],
                handoff: null,
            }
        case 'faq_payment':
            return {
                text: 'Ödemeyi kredi kartı ya da banka kartıyla, PayTR güvenli ödeme altyapısıyla yapabilirsin. Kart bilgilerin bizde saklanmaz.',
                events: [],
                handoff: null,
            }
    }
}
