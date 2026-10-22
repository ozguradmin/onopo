/**
 * Onopo Asistan: follow-up memory for short answers (pure, isomorphic).
 *
 * Why: in a live transcript the assistant offered "Kategorilere göz atmak istersen gösterebilirim.", the
 * visitor said "olur", and the model recommended a screen protector. A one-word reply only makes sense
 * against the previous offer, and the model weighs the newest user message far more than the history. So
 * the server finds the offer in the last assistant message (son_teklif), classifies what it offered, and
 * when the reply is a short yes ("olur", "evet", "tamam", "göster", "olsun", "isterim") tells the model in
 * the turn notes to do exactly that; for a category offer the server also shows the links if the model
 * does not. A short no ("yok", "istemiyorum") gets a note not to insist.
 */
import type { HistoryMessage } from './contract'
import { foldTr } from '../search'

export type OfferKind = 'categories' | 'products' | 'compare' | 'whatsapp' | 'cart' | 'info' | 'other'

export interface Offer {
    /** The offering sentence as the assistant wrote it (validated text; ≤ 200 characters). */
    sentence: string
    kind: OfferKind
}

/** Turkish label of a kind for the turn context. */
export const OFFER_LABEL: Record<OfferKind, string> = {
    categories: 'kategoriler',
    products: 'ürünler',
    compare: 'karşılaştırma',
    whatsapp: 'WhatsApp',
    cart: 'sepet',
    info: 'bilgi kartı',
    other: 'diğer',
}

const OFFER_RE = /(gosterebilirim|gostereyim|gosterelim|gostermemi|onerebilirim|onereyim|onermemi|bakabilirim|bakayim|bakalim mi|ister misin|ister misiniz|istersen|isterseniz|karsilastirabilirim|karsilastirayim|ekleyebilirim|ekleyeyim|cikarabilirim|cikarayim|hazirlayabilirim|hazirlayayim|yonlendirebilirim|yonlendireyim|listeleyebilirim|listeleyeyim|anlatabilirim|anlatayim|paylasabilirim)/

function sentences(text: string): string[] {
    return text
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?…])\s+/)
        .map(s => s.trim())
        .filter(Boolean)
}

export function offerKind(sentence: string): OfferKind {
    const f = foldTr(sentence)
    if (/kategori|reyon|bolum/.test(f)) return 'categories'
    if (/karsilastir|farkini|farklarini/.test(f)) return 'compare'
    if (/whatsapp|ekibim|ekibe|mesaj/.test(f)) return 'whatsapp'
    if (/sepet/.test(f)) return 'cart'
    if (/kargo|taksit|odeme|iade|teslim/.test(f) && !/urun|secenek|kablo|adaptor|sarj|koruyucu|kulaklik/.test(f)) return 'info'
    if (/urun|secenek|model|kablo|adaptor|baslik|sarj|kulaklik|koruyucu|cam|powerbank|alternatif|benzer|uygun|fiyatli|daha|tutucu|supurge|yazici/.test(f)) return 'products'
    return 'other'
}

/**
 * The offer in the LAST assistant message, when that message is the newest one before this turn
 * (history ends with it). The last offering sentence wins.
 */
export function lastOffer(history: readonly HistoryMessage[]): Offer | null {
    const last = history.at(-1)
    if (!last || last.role !== 'assistant') return null
    const list = sentences(last.text)
    for (let i = list.length - 1; i >= 0; i--) {
        const s = list[i]
        if (OFFER_RE.test(foldTr(s))) return { sentence: s.slice(0, 200), kind: offerKind(s) }
    }
    return null
}

const YES_HEAD = /^(evet|olur|olurr+|tamam|tamamdir|tmm|tm|ok|okey|okay|peki|tabi|tabii|tabiki|tabi ki|tabii ki|elbette|kesinlikle|aynen|olsun|isterim|istiyorum|goster|gosterir misin|gosterebilir misin|goster bakalim|gosterin|bakalim|bakayim|hadi|hadi bakalim|lutfen|evet lutfen|olur lutfen|super|harika|guzel|iyi olur|cok iyi olur|neden olmasin|yap|yapalim|ekle|ekleyelim|devam|devam et|karsilastir|ilgilenirim|merak ettim|e tabi|evt)\b/
const NO_HEAD = /^(hayir|yok|yoo|istemiyorum|istemem|gerek yok|sart degil|kalsin|simdilik yok|simdilik kalsin|yok sag ol|yok tesekkurler|hayir tesekkurler|olmaz|lazim degil)\b/

function foldShort(text: string): string {
    return foldTr(text).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** "olur", "evet göster", "tamam olsun", "isterim lütfen": a short yes (at most 5 words, no question of its own). */
export function isAffirmation(text: string): boolean {
    const f = foldShort(text)
    if (!f || f.length > 40 || f.split(' ').length > 5) return false
    if (NO_HEAD.test(f)) return false
    // "tamam teşekkürler" closes the topic; it does not accept the offer
    if (/tesekkur|sagol|eyvallah|mersi/.test(f) && !/^(evet|olur|isterim|goster)/.test(f)) return false
    return YES_HEAD.test(f)
}

/** "yok", "istemiyorum", "gerek yok": a short no. */
export function isDecline(text: string): boolean {
    const f = foldShort(text)
    if (!f || f.length > 40 || f.split(' ').length > 5) return false
    return NO_HEAD.test(f)
}

export type FollowUp = { offer: Offer; reply: 'yes' | 'no' | null }

export function followUpOf(history: readonly HistoryMessage[], text: string): FollowUp | null {
    const offer = lastOffer(history)
    if (!offer) return null
    return { offer, reply: isAffirmation(text) ? 'yes' : isDecline(text) ? 'no' : null }
}

const DO_WHAT: Record<OfferKind, string> = {
    categories: "show_category ile ana kategorileri göster (<baglantilar> içinden en çok 6 anahtar, örn. grup:sarj-aleti, grup:kablo). Ürün önerme",
    products: 'teklif ettiğin ürünleri show_products ile göster',
    compare: 'show_comparison ile önceki kartlardaki ürünleri karşılaştır',
    whatsapp: 'whatsapp_handoff ile WhatsApp kartını göster',
    cart: 'sepet işlemini update_cart ya da show_cart ile yap',
    info: 'store_info ile bilgi kartını göster',
    other: 'teklif ettiğin şeyi yap',
}

/** The turn note for a short yes / no to the previous offer (null when the reply is neither). */
export function followUpNote(f: FollowUp, said: string): string | null {
    const quoted = said.replace(/"/g, '').slice(0, 40)
    if (f.reply === 'yes') {
        return `Müşteri "${quoted}" diyerek son teklifini kabul etti. Şimdi tam olarak onu yap: ${DO_WHAT[f.offer.kind]}. Başka konuya geçme, yeni soru sorma; 1 kısa cümle yaz.`
    }
    if (f.reply === 'no') {
        return `Müşteri "${quoted}" diyerek son teklifini istemedi: ısrar etme, kısa bir cümleyle başka neye bakmak istediğini sor.`
    }
    return null
}
