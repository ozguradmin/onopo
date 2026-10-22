/**
 * Shopping guides ("Rehber", /rehber/ and /rehber/<slug>/): the texts live in code (lib/guides/content/*), the
 * related products come live from D1 (lib/guides/server.ts). Isomorphic and pure, so scripts/guides.test.mjs
 * can check the data and the product rules against the real catalogue names.
 */
import { matchesFacet, matchesSearch, normalizeText } from '../search'
import { aracSarjGuide } from './content/arac-sarj'
import { ekranKoruyucuGuide } from './content/ekran-koruyucu'
import { hizliSarjGuide } from './content/hizli-sarj'
import { iphoneSarjGuide } from './content/iphone-sarj'
import { powerbankGuide } from './content/powerbank'
import { tabletEkranKoruyucuGuide } from './content/tablet-ekran-koruyucu'
import { GUIDE_SLUGS, GUIDES_PATH, guidePath, type GuideSlug } from './slugs'
import type { Guide, GuideBlock, GuideClause, GuideProductRule } from './types'

export { GUIDE_SLUGS, GUIDES_PATH, guidePath, isGuideSlug } from './slugs'
export type { GuideSlug } from './slugs'
export type * from './types'

const BY_SLUG: Readonly<Record<GuideSlug, Guide>> = {
    'iphone-sarj-aleti-ve-kablo-secimi': iphoneSarjGuide,
    'hizli-sarj-nedir-pd-watt-amper': hizliSarjGuide,
    'ekran-koruyucu-secimi-9d-12d-seramik': ekranKoruyucuGuide,
    'tablet-ekran-koruyucu-model-kodu-bulma': tabletEkranKoruyucuGuide,
    'arac-sarj-cihazi-nasil-secilir': aracSarjGuide,
    'powerbank-secimi-mah-ve-cikis-gucu': powerbankGuide,
}

/** All guides in hub order. */
export const GUIDES: readonly Guide[] = GUIDE_SLUGS.map(slug => BY_SLUG[slug])

/** Hub title and meta description (also used by the sitemap and the /kategoriler/ block). */
export const GUIDES_HUB = {
    title: 'Alışveriş rehberleri',
    description: 'Şarj aleti, kablo, ekran koruyucu, araç şarjı ve powerbank seçerken bilmeniz gerekenler: Onopo Store\'un sade ve pratik alışveriş rehberleri.',
} as const

/** The guide with this slug (exact, lower-case), or null. */
export function getGuide(slug: string): Guide | null {
    return Object.prototype.hasOwnProperty.call(BY_SLUG, slug) ? BY_SLUG[slug as GuideSlug] : null
}

/**
 * Product pages try the guides in this order and link the first that matches (most specific first: a tablet
 * protector is also a screen protector, an iPhone cable is also a fast-charging cable).
 */
export const PRODUCT_GUIDE_ORDER: readonly GuideSlug[] = [
    'tablet-ekran-koruyucu-model-kodu-bulma',
    'ekran-koruyucu-secimi-9d-12d-seramik',
    'arac-sarj-cihazi-nasil-secilir',
    'powerbank-secimi-mah-ve-cikis-gucu',
    'iphone-sarj-aleti-ve-kablo-secimi',
    'hizli-sarj-nedir-pd-watt-amper',
]

// ---- related products ----------------------------------------------------------------------------------

/** What the rules look at: catalogue products, API rows and the test fixture all fit. */
export interface GuideProductLike {
    id: number
    name: string
    in_stock?: boolean
    stock?: number | null
}

/** Excluded words match at the start of a word of the folded name ('ekran' rules out "Ekran Koruyucu"). */
function hasExcludedWord(name: string, words: readonly string[] | undefined): boolean {
    if (!words?.length) return false
    const padded = ` ${normalizeText(name)}`
    return words.some(w => {
        const word = normalizeText(w)
        return !!word && padded.includes(` ${word}`)
    })
}

/** Whether a product (by name) matches one clause. A clause without facets and query matches nothing. */
export function matchesGuideClause(product: { name: string }, clause: GuideClause): boolean {
    if (!clause.facets?.length && !clause.q?.trim()) return false
    if (hasExcludedWord(product.name, clause.exclude)) return false
    if (clause.facets?.some(key => !matchesFacet(product.name, key))) return false
    // Name only: the category ("Cep Telefonu Aksesuarları") and slug would make broad queries match everything
    if (clause.q?.trim() && !matchesSearch({ name: product.name }, clause.q)) return false
    return true
}

function isInStock(p: GuideProductLike): boolean {
    if (typeof p.in_stock === 'boolean') return p.in_stock
    return (p.stock ?? 0) > 0
}

/**
 * The related products of a guide, at most `limit`: the explicit ids first, then the clauses in turns (the first
 * match of each clause, then the second …, in the input order: getActiveProducts() is newest first), then
 * in-stock products before sold-out ones. Each product once.
 */
export function selectGuideProducts<T extends GuideProductLike>(products: readonly T[], rule: GuideProductRule, limit = 8): T[] {
    const ordered: T[] = []
    const seen = new Set<number>()
    const push = (p: T | undefined) => {
        if (p && !seen.has(p.id)) {
            seen.add(p.id)
            ordered.push(p)
        }
    }
    const byId = new Map(products.map(p => [p.id, p]))
    for (const id of rule.ids ?? []) push(byId.get(id))
    const lists = rule.clauses.map(clause => products.filter(p => matchesGuideClause(p, clause)))
    const longest = Math.max(0, ...lists.map(l => l.length))
    for (let i = 0; i < longest; i++) for (const list of lists) push(list[i])
    return [...ordered.filter(isInStock), ...ordered.filter(p => !isInStock(p))].slice(0, limit)
}

/** The one guide a product page links to ("İlgili rehber"), or null. */
export function guideForProduct(product: { name: string }): Guide | null {
    for (const slug of PRODUCT_GUIDE_ORDER) {
        const guide = BY_SLUG[slug]
        const clauses = guide.productMatch ?? guide.products.clauses
        if (clauses.some(clause => matchesGuideClause(product, clause))) return guide
    }
    return null
}

// ---- text helpers --------------------------------------------------------------------------------------

export type InlinePart = string | { label: string; href: string }

const INLINE_LINK = /\[([^\]]+)\]\((\/[^)\s]*)\)/g

/** Splits paragraph text into plain strings and internal links written as [label](/path/). */
export function parseInlineLinks(text: string): InlinePart[] {
    const parts: InlinePart[] = []
    let last = 0
    for (const m of text.matchAll(INLINE_LINK)) {
        if (m.index > last) parts.push(text.slice(last, m.index))
        parts.push({ label: m[1], href: m[2] })
        last = m.index + m[0].length
    }
    if (last < text.length) parts.push(text.slice(last))
    return parts
}

function blockTexts(block: GuideBlock): string[] {
    return 'items' in block ? block.items : [block.text]
}

/** Every piece of visible text of a guide (intro, headings, blocks, FAQ), links reduced to their labels. */
export function guideTexts(guide: Guide): string[] {
    const texts = [guide.intro]
    for (const s of guide.sections) texts.push(s.heading, ...s.blocks.flatMap(blockTexts))
    for (const f of guide.faq) texts.push(f.q, f.a)
    return texts.map(t => parseInlineLinks(t).map(p => (typeof p === 'string' ? p : p.label)).join(''))
}

/** Words of the visible text (reading time, length checks). */
export function guideWordCount(guide: Guide): number {
    return guideTexts(guide).join(' ').split(/\s+/).filter(Boolean).length
}

/** "5 dk okuma" at ~180 words a minute (Turkish words are long). */
export function guideReadingMinutes(guide: Guide): number {
    return Math.max(1, Math.round(guideWordCount(guide) / 180))
}

/** Internal paths linked from a guide's text. */
export function guideLinks(guide: Guide): string[] {
    return [guide.intro, ...guide.sections.flatMap(s => s.blocks.flatMap(blockTexts)), ...guide.faq.map(f => f.a)]
        .flatMap(t => parseInlineLinks(t))
        .flatMap(p => (typeof p === 'string' ? [] : [p.href]))
}

/** "2026-10-22" → "22 Ekim 2026" (deterministic, no ICU). */
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
export function formatGuideDate(ymd: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
    if (!m) return ymd
    return `${Number(m[3])} ${MONTHS_TR[Number(m[2]) - 1]} ${m[1]}`
}

// ---- sitemap ---------------------------------------------------------------------------------------------

/** Sitemap rows: the hub (lastmod = newest guide change) and every guide (lastmod = dateModified). */
export function guideSitemapEntries(): Array<{ path: string; lastModified: string }> {
    const newest = GUIDES.reduce((max, g) => (g.dateModified > max ? g.dateModified : max), '')
    return [
        { path: GUIDES_PATH, lastModified: newest },
        ...GUIDES.map(g => ({ path: guidePath(g.slug), lastModified: g.dateModified })),
    ]
}
