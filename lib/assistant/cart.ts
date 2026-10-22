/**
 * Onopo Asistan: the visitor's cart as the assistant sees and changes it (pure, isomorphic).
 *
 * Why: the request carries only ids and quantities (context.cart). Every price, count and total the
 * assistant says or shows comes from the knowledge rows (read from D1) with the checkout arithmetic of
 * lib/pricing.ts (unit price = roundPrice(price), line = unit × qty, never re-rounded), so "Sepetinde 3
 * ürün var (4 adet) … toplam 449,97 TL" matches the cart drawer and what PayTR charges. Changes the visitor
 * asks for ("toz haznesini sil", "bundan 2 tane olsun") are validated here and sent to the UI as CartOps;
 * the UI applies them to its local cart and offers "Geri al".
 */
import type { AssistantEvent, CartOp } from './contract'
import type { CatalogRow, RatingMap } from './catalog-block'
import { priceText, toCardProduct } from './catalog-block'
import { foldTr } from '../search'
import { lineTotal } from '../pricing'

/** Assistant-made quantities stay small: more than this is a bulk order (WhatsApp). */
export const CART_OP_MAX_QTY = 10
export const CART_OPS_MAX = 10

export interface CartItem { id: number; qty: number }

export interface PricedLine { row: CatalogRow; qty: number; lineTotal: number }

export interface PricedCart {
    /** Known (active) products, duplicates merged, in cart order. */
    lines: PricedLine[]
    /** Pieces: Σ qty. */
    count: number
    /** Σ line totals (rounded to kuruş for display). */
    total: number
    threshold: number
    /** max(0, threshold − total); 0 when any line has free shipping. */
    remaining: number
    /** Ids the visitor's cart had that are no longer active products. */
    unknown: number[]
}

const cents = (n: number) => Math.round(n * 100) / 100

/** Same id twice (two variants of one product) becomes one line; quantities 1..99. Unknown ids are kept out. */
export function normalizeCart(items: readonly CartItem[]): CartItem[] {
    const out: CartItem[] = []
    for (const it of items.slice(0, 30)) {
        if (!Number.isInteger(it.id) || it.id <= 0) continue
        const qty = Math.max(1, Math.min(99, Math.trunc(it.qty)))
        const prev = out.find(x => x.id === it.id)
        if (prev) prev.qty = Math.min(99, prev.qty + qty)
        else out.push({ id: it.id, qty })
    }
    return out
}

/** Prices the cart from the rows with the checkout arithmetic. */
export function priceCart(items: readonly CartItem[], byId: ReadonlyMap<number, CatalogRow>, freeThreshold: number): PricedCart {
    const lines: PricedLine[] = []
    const unknown: number[] = []
    let total = 0
    let anyFree = false
    for (const it of normalizeCart(items)) {
        const row = byId.get(it.id)
        if (!row) {
            unknown.push(it.id)
            continue
        }
        const lt = lineTotal(row.price, it.qty)
        total += lt
        if (row.freeShipping) anyFree = true
        lines.push({ row, qty: it.qty, lineTotal: cents(lt) })
    }
    total = cents(total)
    const remaining = anyFree || lines.length === 0 ? 0 : Math.max(0, cents(freeThreshold - total))
    return { lines, count: lines.reduce((n, l) => n + l.qty, 0), total, threshold: freeThreshold, remaining, unknown }
}

/** The cart card for the UI (contract v2). */
export function cartEvent(p: PricedCart, ratings?: RatingMap): Extract<AssistantEvent, { t: 'cart' }> {
    return {
        t: 'cart',
        lines: p.lines.map(l => ({ product: toCardProduct(l.row, ratings), qty: l.qty, lineTotal: l.lineTotal })),
        count: p.count,
        total: p.total,
        threshold: p.threshold,
        freeShippingRemaining: p.remaining,
    }
}

/** A short product name for sentences: the display name up to ~42 characters, cut at a word. */
export function shortName(row: Pick<CatalogRow, 'displayName'>, max = 42): string {
    const n = row.displayName.replace(/\s+-\s+[A-Z0-9]{1,6}$/i, '').trim()
    if (n.length <= max) return n
    const cut = n.slice(0, max)
    const sp = cut.lastIndexOf(' ')
    return (sp > 20 ? cut.slice(0, sp) : cut).replace(/[\s,;:–-]+$/, '')
}

function joinTr(parts: string[]): string {
    if (parts.length <= 1) return parts.join('')
    return `${parts.slice(0, -1).join(', ')} ve ${parts.at(-1)}`
}

/**
 * The ready-made Turkish answer to "sepetimde neler var?": count, pieces, the list, total and what is left
 * to free shipping. Every number in it is in the turn context, so the validator lets it through.
 */
export function cartSummaryText(p: PricedCart): string {
    if (p.lines.length === 0) return 'Sepetin şu an boş.'
    const names = p.lines.map(l => (l.qty > 1 ? `${shortName(l.row)} (${l.qty} adet)` : shortName(l.row)))
    const head = p.lines.length === p.count || p.lines.length === 1
        ? `Sepetinde ${p.lines.length} ürün var: ${joinTr(names)}.`
        : `Sepetinde ${p.lines.length} ürün var (${p.count} adet): ${joinTr(names)}.`
    const tail = p.remaining > 0
        ? `Toplam ${priceText(p.total)} TL; ücretsiz kargoya ${priceText(p.remaining)} TL kaldı.`
        : `Toplam ${priceText(p.total)} TL; kargo ücretsiz.`
    return `${head} ${tail}`
}

/** Turn-context lines for the cart (ids for the tools, names for the answer, the ready summary). */
export function cartContextLines(p: PricedCart): string[] {
    if (p.lines.length === 0) return ['sepet: boş']
    const rest = p.remaining > 0 ? `${priceText(p.remaining)} TL` : '0 (kargo bedava)'
    const items = p.lines
        .map(l => `#${l.row.id} "${shortName(l.row, 60)}" x${l.qty} = ${priceText(l.lineTotal)} TL${l.row.inStock ? '' : ' (tükendi)'}`)
        .join('; ')
    return [
        `sepet: ${p.lines.length} ürün, ${p.count} adet · sunucu_sepet_toplami: ${priceText(p.total)} TL · ucretsiz_kargoya_kalan: ${rest}`,
        `sepet_urunleri: ${items}`,
        `sepet_ozeti: "${cartSummaryText(p)}"`,
    ]
}

// ---------------------------------------------------------------------------------------------
// What the visitor wants with the cart (deterministic; the router only helps)
// ---------------------------------------------------------------------------------------------

export type CartIntent = 'view' | 'edit' | null

/**
 * 'view': "sepetimde neler var", "sepetimi göster", "sepet toplamı ne"; 'edit': "sepetimdeki X'i sil",
 * "sepetten çıkar", "adedini 2 yap". "Sepete nasıl eklerim?" and "sepete ekledim" are neither.
 */
export function cartIntent(text: string): CartIntent {
    const f = ` ${foldTr(text).replace(/[^a-z0-9]+/g, ' ')} `
    // "bunu sil" without the word sepet is ambiguous: the model decides (it has the cart lines)
    if (!/ sepet/.test(f)) return null
    if (/ (sil|siler|silin|silinsin|silebilir\w*|silsene|cikar|cikart|cikarir|cikarin|cikarabilir\w*|cikartabilir\w*|cikarsana|kaldir|kaldirir|kaldirin|kaldirabilir\w*|bosalt\w*|azalt\w*|artir\w*|arttir\w*|eksilt\w*) /.test(f)) return 'edit'
    if (/ (adedi\w*|adet(ini|i)?|tane) (\d+|bir|iki|uc|dort|bes) (yap|olsun|olarak)/.test(f) || / (\d+|iki|uc|dort|bes) (adet|tane) (yap|olsun)/.test(f)) return 'edit'
    if (/ sepet\w* (ekle|ekler|ekleyebilir\w*|ekleyin|eklesene|ekleyiver\w*) /.test(f) && !/ nasil /.test(f)) return 'edit'
    if (/ sepet\w* (ne|neler|kac|toplam\w*|tutar\w*|ozet\w*|goster\w*|listele\w*|icinde\w*|bak|kontrol\w*) /.test(f)) return 'view'
    if (/ (ne|neler|kac urun|kac tane) (var )?(sepet)/.test(f)) return 'view'
    if (/ sepet(im|imi|imde|imdeki|imdekiler|teki|tekiler|tekileri)? (var|nedir|ne kadar)/.test(f)) return 'view'
    return null
}

/** "Ödemeye geç" (the chip after a cart answer), "siparişi tamamla": a short request for the checkout. */
export function isCheckoutRequest(text: string): boolean {
    const f = foldTr(text).replace(/[^a-z0-9]+/g, ' ').trim()
    if (!f || f.split(' ').length > 6) return false
    return /^(odemeye gec\w*|odeme adimina gec\w*|odemeye gitmek istiyorum|siparisi tamamla\w*|alisverisi tamamla\w*|sepeti onayla\w*)( lutfen)?$/.test(f)
}

// ---------------------------------------------------------------------------------------------
// Applying the visitor's changes (update_cart)
// ---------------------------------------------------------------------------------------------

export type OpRejection = 'gecersiz_urun' | 'izin_yok' | 'tukendi' | 'secenek_gerekli' | 'adet_siniri' | 'degisiklik_yok'

export interface OpsResult {
    applied: CartOp[]
    rejected: { id: number; neden: OpRejection }[]
    /** The cart after the applied ops. */
    cart: CartItem[]
    /** One receipt line for the UI ("Toz haznesi aparatı sepetten çıkarıldı"). */
    note: string
    /** For the model: what changed, name, before, after. */
    changes: { id: number; ad: string; once: number; simdi: number }[]
}

/**
 * Validates and applies ops. Allowed products: those already in the cart, or `shown` ones (cards of this
 * conversation, the page product). Adding needs an in-stock product without options (the option is picked
 * on the product page); a sold-out line can be lowered or removed, never raised. qty 0 removes.
 */
export function applyCartOps(
    cart: readonly CartItem[],
    rawOps: readonly { id: number; qty: number }[],
    byId: ReadonlyMap<number, CatalogRow>,
    shown: ReadonlySet<number>,
): OpsResult {
    const next = normalizeCart(cart).map(x => ({ ...x }))
    const applied: CartOp[] = []
    const rejected: OpsResult['rejected'] = []
    const changes: OpsResult['changes'] = []
    const notes: string[] = []
    for (const op of rawOps.slice(0, CART_OPS_MAX)) {
        const row = byId.get(op.id)
        const line = next.find(x => x.id === op.id)
        const before = line?.qty ?? 0
        if (!row) {
            rejected.push({ id: op.id, neden: 'gecersiz_urun' })
            continue
        }
        if (!line && !shown.has(op.id)) {
            rejected.push({ id: op.id, neden: 'izin_yok' })
            continue
        }
        const qty = Math.max(0, Math.trunc(op.qty))
        if (qty > CART_OP_MAX_QTY) {
            rejected.push({ id: op.id, neden: 'adet_siniri' })
            continue
        }
        if (qty === before) {
            rejected.push({ id: op.id, neden: 'degisiklik_yok' })
            continue
        }
        if (qty > before && !row.inStock) {
            rejected.push({ id: op.id, neden: 'tukendi' })
            continue
        }
        if (!line && row.hasVariations) {
            rejected.push({ id: op.id, neden: 'secenek_gerekli' })
            continue
        }
        const name = shortName(row)
        if (qty === 0) {
            next.splice(next.indexOf(line!), 1)
            notes.push(`${name} sepetten çıkarıldı`)
        } else if (!line) {
            next.push({ id: op.id, qty })
            notes.push(qty > 1 ? `${name} sepete eklendi (${qty} adet)` : `${name} sepete eklendi`)
        } else {
            line.qty = qty
            notes.push(`${name}: ${qty} adet`)
        }
        applied.push({ id: op.id, qty })
        changes.push({ id: op.id, ad: name, once: before, simdi: qty })
    }
    return { applied, rejected, cart: next, note: notes.join('; ').slice(0, 200), changes }
}
