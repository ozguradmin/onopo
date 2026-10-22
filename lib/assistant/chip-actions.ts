/**
 * Onopo Asistan: the two follow-up chips that only need the catalogue (pure, isomorphic).
 *
 * "Benzerlerini göster" and "Daha uygun fiyatlısı var mı?" (suggestions.ts) come right after a product card,
 * so the answer is fully defined by the products already shown: the same product group, in stock, not shown
 * yet. Answering them without a model call keeps them instant and makes them work while the model is slow
 * (a slow provider once turned "Benzerlerini göster" into "Bundan emin değilim" after 23 s).
 */
import type { CatalogRow } from './catalog-block'
import { foldTr } from '../search'

export type ShownChip = 'similar' | 'cheaper'

const CHIP_TEXT: Record<ShownChip, RegExp> = {
    similar: /^benzerlerini goster[.!]?$/,
    cheaper: /^daha uygun fiyatlisi var mi\??$/,
}

/** Which of the two chips this input is (typed or tapped), or null. */
export function shownChipOf(input: string): ShownChip | null {
    const s = foldTr(input).replace(/\s+/g, ' ').trim()
    for (const kind of Object.keys(CHIP_TEXT) as ShownChip[]) if (CHIP_TEXT[kind].test(s)) return kind
    return null
}

type Connector = 'lightning' | 'usb-c' | 'micro'

/** Phone-side connectors a product name names ("Type-C", "USB-C", "Lightning", "Micro USB"). */
export function connectorsOf(name: string): Set<Connector> {
    const s = foldTr(name)
    const out = new Set<Connector>()
    if (/lightning/.test(s)) out.add('lightning')
    if (/type[\s-]?c|usb[\s-]?c\b/.test(s)) out.add('usb-c')
    if (/\bmicro\b/.test(s)) out.add('micro')
    return out
}

/** Old-phone model codes in a name (D880, GT-E1190, SM-D880, C5510): a charger made for those devices. */
const MODEL_CODE = /\b(?:[a-z]{1,3}-)?[a-z]{1,2}\d{3,4}[a-z]?\b/

/**
 * A candidate fits when it shares a connector with the shown product, or names no connector and no other
 * device model (no Lightning after USB-C, no old feature-phone charger after an iPhone charger).
 */
function sameConnector(anchor: Set<Connector>, name: string): boolean {
    if (!anchor.size) return true
    const c = connectorsOf(name)
    if (c.size) return [...c].some(x => anchor.has(x))
    return !MODEL_CODE.test(foldTr(name))
}

/**
 * Products for the chip: the group of the last product shown, in stock, neither shown before nor excluded
 * (the visitor's cart), and never another phone connector than the shown product names. 'similar' = closest
 * in price to that product; 'cheaper' = below the cheapest shown product of that group, the closest first.
 * At most `limit`.
 */
export function pickForShownChip(
    kind: ShownChip,
    rows: readonly CatalogRow[],
    shownIds: readonly number[],
    exclude: ReadonlySet<number> = new Set(),
    limit = 4,
): { anchor: CatalogRow | null; picked: CatalogRow[] } {
    const byId = new Map(rows.map(r => [r.id, r]))
    const shown = shownIds.map(id => byId.get(id)).filter((r): r is CatalogRow => !!r)
    const anchor = shown[shown.length - 1] ?? null
    if (!anchor) return { anchor: null, picked: [] }
    const shownSet = new Set(shownIds)
    const plugs = connectorsOf(anchor.name)
    const pool = rows.filter(r => r.group === anchor.group && r.inStock && !shownSet.has(r.id) && !exclude.has(r.id) && sameConnector(plugs, r.name))
    if (kind === 'cheaper') {
        const floor = Math.min(...shown.filter(r => r.group === anchor.group).map(r => r.displayPrice))
        return {
            anchor,
            picked: pool.filter(r => r.displayPrice < floor - 0.001).sort((a, b) => b.displayPrice - a.displayPrice || a.id - b.id).slice(0, limit),
        }
    }
    return {
        anchor,
        picked: [...pool].sort((a, b) => Math.abs(a.displayPrice - anchor.displayPrice) - Math.abs(b.displayPrice - anchor.displayPrice) || a.id - b.id).slice(0, limit),
    }
}

/** The answer line above the cards (or alone when nothing qualifies). Never a promise about stock or price. */
export function shownChipText(kind: ShownChip, count: number): string {
    if (kind === 'cheaper') {
        return count > 0
            ? 'Bu türde daha uygun fiyatlı seçenekler şunlar:'
            : 'Gösterdiğim ürün, bu türde stokta olanlar arasında zaten en uygun fiyatlısı.'
    }
    return count > 0 ? 'Benzer ürünler şunlar:' : 'Bu türde stokta başka benzer bir ürün şu an yok.'
}
