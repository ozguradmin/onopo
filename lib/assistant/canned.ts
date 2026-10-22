/**
 * Onopo Asistan: fixed Turkish answers that need no model call (pure, isomorphic). Texts from SPEC 9.6.
 *
 * Why: greetings, refusals, the busy fallback and the FAQ chips are the same every time, so they cost
 * nothing, cannot hallucinate and answer instantly. The FAQ texts are filled from the same StoreFacts
 * the model sees, so the canned answer and a model answer can never disagree. Store questions the owner
 * cannot answer for sure (weekend shipping, delivery days, returns, other payment methods, invoices,
 * warranty claims, stock) get a short text and a full WhatsApp card instead (policyTopic, policyText).
 */
import type { AssistantEvent, ChipAction, HandoffReason } from './contract'
import type { StoreFacts } from './facts'
import { amountText, sameDayInfo } from './facts'

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

/**
 * Same-day line. The owner does not know whether the store ships on Saturdays, so only the cut-off is
 * stated; anything after it ("when then?") goes to WhatsApp instead of naming a next shipping day.
 */
function cutoffText(f: StoreFacts, now: Date): string {
    if (sameDayInfo(now, f).sameDay) {
        return `Şimdi sipariş verirsen bugün kargoya verilir; saat ${f.cutoff}'e kadar verilen siparişler aynı gün kargoda.`
    }
    return `Saat ${f.cutoff}'e kadar verilen siparişler aynı gün kargoya verilir. Bu saatten sonra ya da hafta sonu verilen siparişlerin ne zaman yola çıkacağını ekibimiz WhatsApp'tan netleştirir.`
}

export interface FaqAnswer {
    text: string
    /** Extra card events (none today; kept so a chip can add a card without touching the turn code). */
    events: AssistantEvent[]
    /** The WhatsApp card the turn adds under the answer (every answer gets at least the compact row). */
    handoff: { reason: HandoffReason; variant: 'full' | 'compact' }
}

/** Canned answer for a FAQ chip (section 9.6, w7 revision: only what the store knows, WhatsApp for the rest). */
export function faqAnswer(chip: ChipAction, f: StoreFacts, now: Date): FaqAnswer {
    switch (chip) {
        case 'faq_shipping':
            return {
                text: `${amountText(f.freeThreshold)} TL ve üzeri siparişlerde kargo ücretsiz; altında kargo ücreti ${amountText(f.shippingCost)} TL. Saat ${f.cutoff}'e kadar verilen siparişler aynı gün kargoya verilir. Kargoyla ilgili başka bir sorun varsa ekibimize WhatsApp'tan sorabilirsin.`,
                events: [],
                handoff: { reason: 'other', variant: 'compact' },
            }
        case 'faq_cutoff':
            return { text: cutoffText(f, now), events: [], handoff: { reason: 'other', variant: 'compact' } }
        case 'faq_returns':
            return {
                text: `Teslimden itibaren ${f.returnDays} gün içinde cayma hakkın var. İade ve değişim işlemlerini ekibimiz WhatsApp'tan yürütüyor; mesajın hazır, karttaki düğmeye basman yeterli.`,
                events: [],
                handoff: { reason: 'return', variant: 'full' },
            }
        case 'faq_installments':
            return {
                text: f.maxInstallments
                    ? `Kredi kartına ${f.maxInstallments} aya varan taksit seçeneği var. Taksit seçenekleri ve tutarları ödeme adımında kartının bankasına göre gösterilir.`
                    : 'Taksit seçenekleri ödeme adımında kartına göre gösterilir.',
                events: [],
                handoff: { reason: 'payment', variant: 'compact' },
            }
        case 'faq_payment':
            return {
                text: "Ödemeyi kredi kartı ya da banka kartıyla, PayTR güvenli ödeme altyapısıyla yapabilirsin. Kart bilgilerin bizde saklanmaz. Başka bir ödeme yöntemi soracaksan ekibimize WhatsApp'tan yazabilirsin.",
                events: [],
                handoff: { reason: 'payment', variant: 'compact' },
            }
    }
}

// ---------------------------------------------------------------------------------------------
// Store questions the assistant must not answer (owner decision, w7): a full WhatsApp card instead
// ---------------------------------------------------------------------------------------------

export type PolicyTopic = 'order' | 'warranty_claim' | 'returns' | 'stock' | 'weekend' | 'delivery' | 'payment_other' | 'invoice'

/** Handoff reason of each topic (existing HandoffReason values; the contract stays as it is). */
export const POLICY_REASON: Record<PolicyTopic, HandoffReason> = {
    order: 'order_status',
    warranty_claim: 'return',
    returns: 'return',
    stock: 'product_request',
    weekend: 'other',
    delivery: 'other',
    payment_other: 'payment',
    invoice: 'payment',
}

/** The short text above the full WhatsApp card. No promise, no day, no fee: the team answers. */
export function policyText(topic: PolicyTopic, f: StoreFacts): string {
    const ready = "Mesajın hazır, karttaki düğmeye basman yeterli."
    switch (topic) {
        case 'order':
            return `Siparişinin durumuna ekibimiz WhatsApp'tan hemen bakar; sipariş numaranı orada paylaşabilirsin. ${ready}`
        case 'warranty_claim':
            return `Arıza ve garanti başvurularıyla ekibimiz ilgileniyor; ürünü ve sorunu WhatsApp'tan yazman yeterli. ${ready}`
        case 'returns':
            return `Teslimden itibaren ${f.returnDays} gün içinde cayma hakkın var. İade ve değişim işlemlerini ekibimiz WhatsApp'tan yürütüyor. ${ready}`
        case 'stock':
            return `Stok ve yeniden gelecek ürünler için en güncel bilgiyi ekibimiz verir. ${ready}`
        case 'weekend':
            return `Hafta sonu kargo konusunda en doğru bilgiyi ekibimiz verir. Saat ${f.cutoff}'e kadar verilen siparişler aynı gün kargoya verilir. ${ready}`
        case 'delivery':
            return `Teslim süresi adrese ve kargo firmasına göre değişiyor; kesin günü ekibimiz söyleyebilir. Saat ${f.cutoff}'e kadar verilen siparişler aynı gün kargoya verilir. ${ready}`
        case 'payment_other':
            return `Sitede kredi kartı ya da banka kartıyla PayTR güvenli ödeme yapabilirsin. Başka ödeme seçenekleri için ekibimize sorman en doğrusu. ${ready}`
        case 'invoice':
            return `Fatura konusunda ekibimiz yardımcı olur. ${ready}`
    }
}

/**
 * Policy topic of a (masked) customer message, or null. Deterministic and checked before any model call,
 * so these answers can never be invented. Order matters: a broken item is a warranty claim, not a stock
 * question; "ne zaman gelir" about a sold-out item is stock, otherwise delivery. Product questions
 * ("garantisi var mı?", "kutusunda ne var?") do not match: the facts answer those.
 */
export function policyTopic(text: string, fold: (s: string) => string): PolicyTopic | null {
    const f = ` ${fold(text).replace(/[^a-z0-9]+/g, ' ')} `
    const has = (re: RegExp) => re.test(f)
    if (has(/ (siparisim|siparisimi|siparisime|kargom|kargomu|kargo takip|takip no|takip numara|siparis (durum|nerede|ne zaman))/)) return 'order'
    // "Eski kablom çalışmıyor, yeni kablo öner" is a shopper, not a warranty claim: product-seeking
    // words keep these topics with the model (which still shows the WhatsApp row under its answer)
    const shopping = has(/ (oner\w*|tavsiye\w*|lazim|ariyorum|almak|alayim|alacagim|istiyorum|hangisi|yeni (bir )?(kablo|sarj|adaptor|baslik|cam|koruyucu|kulaklik))/)
    if (!shopping && has(/ (bozuldu|bozuk geldi|arizali|ariza|calismiyor|calismadi|kirik geldi|hasarli|garanti (basvuru|kapsam)|garantiye|garantiden)/)) return 'warranty_claim'
    if (has(/ (iade|degisim|degisimi|cayma|geri gonder)/)) return 'returns'
    if (!shopping && has(/ (stok|stoga|stokta|stoklar|tukendi|tukenmis|tekrar gel|yeniden gel|ne zaman gelecek)/)) return 'stock'
    if (!shopping && has(/ (cumartesi\w*|pazar(a|i|in)?|hafta ?sonu\w*) /)) return 'weekend'
    if (has(/ (kac gun(de)? (icinde )?(gelir|ulas|teslim|elime|kargo)|kargo(m|su|lar)? kac gun|ne zaman gelir|ne zaman elime|ne zaman ulas|teslim(at)? (suresi|tarihi|zamani|ne zaman)|kargo suresi|hangi kargo|kargo firma|yarin (gelir|elimde)|yarina gelir|bugun gelir mi|elime ne zaman)/)) return 'delivery'
    if (has(/ (kapida|havale|eft|nakit|kripto|paypal|papara|senetle|cek ile|odeme yontem|odeme secenek|baska (bir )?odeme)/)) return 'payment_other'
    if (has(/ (fatura|e fatura|efatura)/)) return 'invoice'
    return null
}
