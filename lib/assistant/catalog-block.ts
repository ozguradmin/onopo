/**
 * Onopo Asistan: the live catalogue as the model and the cards see it (pure, isomorphic).
 *
 * Why this module exists: the model gets the WHOLE active catalogue (about 120 products) in its system
 * message, so it can answer most turns without a search round trip. That block must be compact (the
 * shared prompt prefix is cached and billed per token) and byte-stable (same rows → same bytes, or the
 * prefix cache misses). Cards, prices and links never come from the model: the server builds them from
 * these rows, which were read from D1 for this knowledge version.
 *
 * Price rule: the model only ever sees `displayPrice` (roundPrice, what the customer pays). The raw price
 * goes to the cart and <Price> (both expect raw), and the old price goes to cards only, never to the model.
 */
import type { CardProduct, GroupKey } from './contract'
import { displayName, matchesFacet, normalizeText, scoreSearch, prepareQuery, searchItems, splitDisplayName } from '../search'
import { formatNumberTR } from '../format'
import { detectDevice } from './device'
import { roundPrice } from '../roundPrice'
import { productModelTokens, productPath } from '../seo'

export interface CatalogRow {
    id: number
    name: string
    displayName: string
    slug: string
    /** productPath(slug) */
    href: string
    /** RAW D1 price (cart + <Price> expect raw) */
    price: number
    /** roundPrice(price): what the customer pays; the ONLY price the model sees */
    displayPrice: number
    /** raw, only when > price; cards only, never the model */
    originalPrice: number | null
    category: string | null
    group: GroupKey
    /** category === 'Çok Satanlar' */
    isBestSeller: boolean
    /** stock > 0 (stock counts are never shown or sent to the model) */
    inStock: boolean
    /** first stored ref from the images JSON */
    image: string | null
    code: string | null
    freeShipping: boolean
    hasVariations: boolean
    whatsappOrder: boolean
    whatsappNumber: string | null
}

/** The category the shop uses for its best sellers (products reference categories by NAME). */
export const BEST_SELLER_CATEGORY = 'Çok Satanlar'
const GAMING_CATEGORY = 'Oyun ve Oyuncu Aksesuarları'

/** Display order of the groups (the same order as the tool enum and the Turkish titles). */
export const GROUP_ORDER: readonly GroupKey[] = [
    'sarj-aleti', 'arac-sarj', 'kablo', 'ekran-koruyucu-seramik', 'ekran-koruyucu-9d', 'ekran-koruyucu',
    'kulaklik', 'powerbank', 'supurge', 'yazici', 'oyun', 'diger',
]

export const GROUP_TITLES: Record<GroupKey, string> = {
    'sarj-aleti': 'Şarj aletleri',
    'arac-sarj': 'Araç şarj cihazları',
    kablo: 'Kablolar',
    'ekran-koruyucu-seramik': 'Seramik ekran koruyucular',
    'ekran-koruyucu-9d': '9D anti-statik cam ekran koruyucular',
    'ekran-koruyucu': 'Diğer ekran koruyucular',
    kulaklik: 'Kulaklıklar',
    powerbank: 'Powerbankler',
    supurge: 'El süpürgeleri ve parçaları',
    yazici: 'Termal yazıcılar',
    oyun: 'Oyun aksesuarları',
    diger: 'Diğer ürünler',
}

/**
 * Listing link per group. `oyun` links to its category page when that category exists (the caller passes
 * its href to groupHref); this table holds the fallback.
 */
export const LINK_GROUP_HREF: Record<GroupKey, string> = {
    'ekran-koruyucu-seramik': '/products/?q=seramik',
    'ekran-koruyucu-9d': '/products/?q=9d',
    'ekran-koruyucu': '/products/?f=ekran-koruyucu',
    'arac-sarj': '/products/?f=arac',
    'sarj-aleti': '/products/?f=sarj-aleti',
    powerbank: '/products/?f=powerbank',
    kulaklik: '/products/?f=kulaklik',
    kablo: '/products/?f=kablo',
    supurge: '/products/?q=s%C3%BCp%C3%BCrge',
    yazici: '/products/?q=yaz%C4%B1c%C4%B1',
    oyun: '/products/?q=oyun',
    diger: '/products/',
}

export const SCREEN_PROTECTOR_GROUPS: ReadonlySet<GroupKey> = new Set(['ekran-koruyucu-seramik', 'ekran-koruyucu-9d', 'ekran-koruyucu'])

export function isGroupKey(v: unknown): v is GroupKey {
    return typeof v === 'string' && (GROUP_ORDER as readonly string[]).includes(v)
}

/** Listing href of a group; `oyun` prefers the gaming category page. */
export function groupHref(group: GroupKey, gamingCategoryHref?: string | null): string {
    if (group === 'oyun' && gamingCategoryHref) return gamingCategoryHref
    return LINK_GROUP_HREF[group]
}

/** Product group from the name (first matching rule wins; the order matters: "araç şarj aleti" is arac-sarj). */
export function groupOf(name: string, category: string | null | undefined): GroupKey {
    const n = normalizeText(name)
    const has = (word: string) => new RegExp(`(^|\\s)${word}`).test(n)
    if (n.includes('seramik')) return 'ekran-koruyucu-seramik'
    if (/(^|\s)9d(\s|$)/.test(n)) return 'ekran-koruyucu-9d'
    if (matchesFacet(name, 'ekran-koruyucu')) return 'ekran-koruyucu'
    if (matchesFacet(name, 'arac')) return 'arac-sarj'
    if (matchesFacet(name, 'sarj-aleti')) return 'sarj-aleti'
    if (matchesFacet(name, 'powerbank')) return 'powerbank'
    if (matchesFacet(name, 'kulaklik')) return 'kulaklik'
    // The site facet also matches 'kablosuz' (wireless): a cordless vacuum is not a cable
    if (matchesFacet(name.replace(/kablosuz/gi, ' '), 'kablo')) return 'kablo'
    if (n.includes('supurge')) return 'supurge'
    if (n.includes('yazici')) return 'yazici'
    if ((category ?? '').trim() === GAMING_CATEGORY || has('gamepad') || has('oyun')) return 'oyun'
    return 'diger'
}

const str = (v: unknown): string => (v == null ? '' : String(v))
const num = (v: unknown): number => {
    const n = typeof v === 'number' ? v : parseFloat(str(v))
    return Number.isFinite(n) ? n : 0
}
const bool = (v: unknown): boolean => v === true || v === 1 || v === '1' || v === 'true'

function firstImage(value: unknown): string | null {
    let list: unknown = value
    if (typeof value === 'string') {
        try { list = JSON.parse(value) } catch { return value.trim().startsWith('/') || value.startsWith('http') ? value.trim() : null }
    }
    if (!Array.isArray(list)) return null
    const first = list.find(x => typeof x === 'string' && x.length > 0)
    return typeof first === 'string' ? first : null
}

/** Model-facing name: displayName() with spaces collapsed, at most 90 characters. */
export function modelName(name: string): string {
    return displayName(name).replace(/\s+/g, ' ').trim().slice(0, 90).trim()
}

/** A D1 row of the knowledge query (section 3.1) → CatalogRow. */
export function toCatalogRow(r: Record<string, unknown>): CatalogRow {
    const name = str(r.name)
    const price = num(r.price)
    const original = r.original_price == null || r.original_price === '' ? null : num(r.original_price)
    const category = str(r.category).trim() || null
    const slug = str(r.slug)
    return {
        id: Math.trunc(num(r.id)),
        name,
        displayName: modelName(name),
        slug,
        href: productPath(slug),
        price,
        displayPrice: roundPrice(price),
        originalPrice: original != null && original > price ? original : null,
        category,
        group: groupOf(name, category),
        isBestSeller: category === BEST_SELLER_CATEGORY,
        inStock: Math.trunc(num(r.stock)) > 0,
        image: firstImage(r.images),
        code: str(r.product_code).trim() || null,
        freeShipping: bool(r.free_shipping),
        hasVariations: bool(r.has_variations),
        whatsappOrder: bool(r.whatsapp_order_enabled),
        whatsappNumber: str(r.whatsapp_number).trim() || null,
    }
}

/** "1.499,99" */
export function priceText(n: number): string {
    return formatNumberTR(n, 2)
}

/** Tags the model may use (never a stock count, never an old price). */
export function rowTags(row: CatalogRow): string[] {
    const tags: string[] = []
    if (row.freeShipping) tags.push('ücretsiz kargo')
    if (row.isBestSeller) tags.push('çok satan')
    if (!row.inStock) tags.push('tükendi')
    if (row.hasVariations) tags.push('seçenekli')
    return tags
}

/**
 * Model label inside a screen-protector price line ("iPhone 16 Pro Max"). SPEC 3.4 says
 * `splitDisplayName(name).compat ?? displayName`, but compat is only set for generic phrases without a
 * number, so names like "iPhone 16 Pro Max Anti Static 9D Cam" would repeat in full. The device
 * (detectDevice, then productModelTokens, the parser the SEO texts use) is tried first; renderCatalog falls back to the
 * full display name when two entries of one group would get the same label.
 */
function protectorModel(row: CatalogRow): string {
    return (detectDevice(row.name) ?? productModelTokens(row.name).device ?? splitDisplayName(row.name).compat ?? row.displayName).replace(/\s+/g, ' ').trim()
}

const byPriceThenId = (a: CatalogRow, b: CatalogRow) => a.displayPrice - b.displayPrice || a.id - b.id

/** Rows bucketed per group (each bucket sorted by displayPrice then id). */
export function groupRows(rows: readonly CatalogRow[]): Map<GroupKey, CatalogRow[]> {
    const map = new Map<GroupKey, CatalogRow[]>()
    for (const g of GROUP_ORDER) map.set(g, [])
    for (const r of rows) map.get(r.group)?.push(r)
    for (const list of map.values()) list.sort(byPriceThenId)
    return map
}

/** Max characters of the <katalog> block (about 4–5K tokens). */
export const CATALOG_MAX_CHARS = 18_000
/** Rows (or screen-protector entries) kept per group when the block is still too long without tags. */
export const CATALOG_ROWS_PER_GROUP_WHEN_CUT = 40
export const CATALOG_CUT_NOTE = '# liste kısaltıldı: diğer ürünler için search_products kullan'

function renderCatalog(rows: readonly CatalogRow[], version: string, opts: { tags: boolean; perGroup: number | null }): string {
    const lines: string[] = [`<katalog surum="${version}">`, '# satır: id | ad | fiyat TL | etiketler']
    let cut = false
    for (const [group, list] of groupRows(rows)) {
        if (list.length === 0) continue
        const title = `${GROUP_TITLES[group]} (${group})`
        if (SCREEN_PROTECTOR_GROUPS.has(group)) {
            lines.push(`## ${title}: "id model" listesi, fiyat başına`)
            const kept = opts.perGroup != null && list.length > opts.perGroup ? list.slice(0, opts.perGroup) : list
            if (kept.length < list.length) cut = true
            const labelCount = new Map<string, number>()
            for (const r of kept) labelCount.set(protectorModel(r), (labelCount.get(protectorModel(r)) ?? 0) + 1)
            const label = (r: CatalogRow) => ((labelCount.get(protectorModel(r)) ?? 0) > 1 ? r.displayName : protectorModel(r))
            const byPrice = new Map<number, CatalogRow[]>()
            for (const r of kept) {
                const k = Math.round(r.displayPrice * 100)
                const bucket = byPrice.get(k)
                if (bucket) bucket.push(r)
                else byPrice.set(k, [r])
            }
            for (const [cents, entries] of [...byPrice.entries()].sort((a, b) => a[0] - b[0])) {
                const items = entries
                    .sort((a, b) => a.id - b.id)
                    .map(r => {
                        const tags = opts.tags ? rowTags(r) : []
                        return `${r.id} ${label(r)}${tags.length ? ` [${tags.join(', ')}]` : ''}`
                    })
                lines.push(`fiyat ${priceText(cents / 100)}: ${items.join(' · ')}`)
            }
            continue
        }
        lines.push(`## ${title}`)
        const kept = opts.perGroup != null && list.length > opts.perGroup ? list.slice(0, opts.perGroup) : list
        if (kept.length < list.length) cut = true
        for (const r of kept) {
            const tags = opts.tags ? rowTags(r) : []
            lines.push(`${r.id} | ${r.displayName} | ${priceText(r.displayPrice)}${tags.length ? ` | ${tags.join(', ')}` : ''}`)
        }
    }
    if (cut) lines.push(CATALOG_CUT_NOTE)
    lines.push('</katalog>')
    return lines.join('\n')
}

/**
 * The <katalog> block (section 3.4). Deterministic: same rows and version → same bytes.
 * Over CATALOG_MAX_CHARS: first the tags go, then each group keeps its first 40 rows with a note.
 */
export function buildCatalogBlock(rows: readonly CatalogRow[], version: string, maxChars = CATALOG_MAX_CHARS): string {
    let out = renderCatalog(rows, version, { tags: true, perGroup: null })
    if (out.length <= maxChars) return out
    out = renderCatalog(rows, version, { tags: false, perGroup: null })
    if (out.length <= maxChars) return out
    return renderCatalog(rows, version, { tags: false, perGroup: CATALOG_ROWS_PER_GROUP_WHEN_CUT })
}

// ---------------------------------------------------------------------------------------------
// Search (the site search rules from lib/search, plus a relaxed pass for chat sentences)
// ---------------------------------------------------------------------------------------------

interface SearchDocItem {
    id: number
    name: string
    slug: string
    category: string | null
    product_code: string | null
    stock: number
    row: CatalogRow
}

const docs = new WeakMap<CatalogRow, SearchDocItem>()
function docOf(row: CatalogRow): SearchDocItem {
    let d = docs.get(row)
    if (!d) {
        d = { id: row.id, name: row.name, slug: row.slug, category: row.category, product_code: row.code, stock: row.inStock ? 1 : 0, row }
        docs.set(row, d)
    }
    return d
}

export type CatalogSort = 'relevance' | 'price_asc' | 'price_desc'

export interface CatalogSearchOptions {
    group?: GroupKey | null
    /** Bounds on displayPrice, inclusive. */
    minPrice?: number | null
    maxPrice?: number | null
    sort?: CatalogSort | null
    /** Default 6. */
    limit?: number | null
}

export interface CatalogSearchResult {
    rows: CatalogRow[]
    /** Matches before the limit. */
    total: number
}

const soldOutLast = (a: CatalogRow, b: CatalogRow) => (a.inStock === b.inStock ? 0 : a.inStock ? -1 : 1)

/**
 * Ranked matches for a free-text query. Chat messages are sentences ("iPhone 15 için hızlı şarj aleti var
 * mı?"), and the site search ANDs every token, so this first drops tokens no product knows ("var", "mı"),
 * ANDs the rest like the site search, and, when that finds nothing, ranks by how many tokens a product
 * matches. A query without any known token returns the group (when one is given) or nothing.
 * Sold-out products always come last.
 */
export function searchCatalog(rows: readonly CatalogRow[], query: string, opts: CatalogSearchOptions = {}): CatalogSearchResult {
    const limit = Math.max(1, Math.min(50, Math.trunc(opts.limit ?? 6)))
    let pool = rows.filter(r =>
        (!opts.group || r.group === opts.group)
        && (opts.minPrice == null || r.displayPrice >= opts.minPrice - 0.001)
        && (opts.maxPrice == null || r.displayPrice <= opts.maxPrice + 0.001),
    )
    const prepared = prepareQuery(query)
    const known = prepared.tokens.filter(t => rows.some(r => scoreSearch(docOf(r), prepareQuery(t)) > 0))
    let ranked: CatalogRow[]
    if (known.length === 0) {
        // No usable word: a group (or price) filter alone still lists that group, cheapest first
        ranked = opts.group || opts.minPrice != null || opts.maxPrice != null
            ? [...pool].sort((a, b) => soldOutLast(a, b) || Number(b.isBestSeller) - Number(a.isBestSeller) || byPriceThenId(a, b))
            : []
    } else {
        const strict = prepareQuery(known.join(' '))
        ranked = searchItems(pool.map(docOf), strict, { soldOutLast: true }).map(d => d.row)
        if (ranked.length === 0) {
            const singles = known.map(t => prepareQuery(t))
            const scored = pool
                .map(r => {
                    let hits = 0
                    let score = 0
                    for (const q of singles) {
                        const s = scoreSearch(docOf(r), q)
                        if (s > 0) { hits++; score += s }
                    }
                    return { r, hits, score }
                })
                .filter(x => x.hits > 0)
            scored.sort((a, b) => soldOutLast(a.r, b.r) || b.hits - a.hits || b.score - a.score || a.r.name.length - b.r.name.length || b.r.id - a.r.id)
            ranked = scored.map(x => x.r)
        }
    }
    if (opts.sort === 'price_asc' || opts.sort === 'price_desc') {
        const dir = opts.sort === 'price_asc' ? 1 : -1
        ranked = [...ranked].sort((a, b) => soldOutLast(a, b) || dir * (a.displayPrice - b.displayPrice) || a.id - b.id)
    }
    pool = ranked
    return { rows: pool.slice(0, limit), total: pool.length }
}

// ---------------------------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------------------------

export type RatingMap = ReadonlyMap<number, { average: number; count: number }> | null | undefined

/** Card data for the UI: always from the D1 row, never from model arguments. */
export function toCardProduct(row: CatalogRow, ratings?: RatingMap): CardProduct {
    const r = ratings?.get(row.id)
    return {
        id: row.id,
        slug: row.slug,
        href: row.href,
        name: displayName(row.name),
        code: row.code,
        price: row.price,
        displayPrice: row.displayPrice,
        originalPrice: row.originalPrice,
        image: row.image,
        rating: r && r.count > 0 ? { average: r.average, count: r.count } : null,
        freeShipping: row.freeShipping,
        inStock: row.inStock,
        hasVariations: row.hasVariations,
        isBestSeller: row.isBestSeller,
        whatsappOrder: row.whatsappOrder,
        category: row.category,
    }
}

/** "#412 67W GaN Hızlı Şarj Seti Type-C 549,99 TL" (turn context candidate line). */
export function candidateText(row: CatalogRow): string {
    return `#${row.id} ${row.displayName} ${priceText(row.displayPrice)} TL${row.inStock ? '' : ' (tükendi)'}`
}

/** The catalogue line of a row, as in the <katalog> block (used for the validator's tool text). */
export function catalogLine(row: CatalogRow): string {
    const tags = rowTags(row)
    return `${row.id} | ${row.displayName} | ${priceText(row.displayPrice)}${tags.length ? ` | ${tags.join(', ')}` : ''}`
}
