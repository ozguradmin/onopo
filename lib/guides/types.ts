import type { GuideSlug } from './slugs'

/**
 * One condition for products related to a guide, matched on the product NAME only (lib/search.ts):
 * every facet key and the query must match, and none of the excluded words may appear.
 */
export interface GuideClause {
    /** FACETS keys of lib/search.ts ('iphone', 'kablo', 'sarj-aleti', '20w' …), all must match. */
    facets?: string[]
    /** A search query (matchesSearch): every word must match the name, e.g. 'type c lightning'. */
    q?: string
    /** Words that rule a product out (Turkish-folded, matched at the start of a word), e.g. 'kulaklik'. */
    exclude?: string[]
}

export interface GuideProductRule {
    /**
     * A product is related when one clause matches. The list on the page takes the clauses in turns (the newest
     * match of each, then the next one …), so a guide shows a mix of product types; in-stock products first.
     */
    clauses: GuideClause[]
    /** Optional explicit picks, shown first while they are active and in stock. Never prices. */
    ids?: number[]
}

/** Paragraph text may contain internal links written as [label](/path/). */
export type GuideBlock =
    | { type: 'p'; text: string }
    | { type: 'ul' | 'ol'; items: string[] }
    /** A short highlighted tip box. */
    | { type: 'tip'; text: string }

export interface GuideSection {
    /** Anchor id of the H2 (table of contents). */
    id: string
    heading: string
    blocks: GuideBlock[]
}

export interface GuideFaq {
    q: string
    a: string
}

export interface Guide {
    slug: GuideSlug
    /** H1, <title> (the template adds " | Onopo") and the Article headline: at most 52 characters. */
    title: string
    /** Meta description (140–160 characters) and the card text on the hub. */
    description: string
    /** Lead paragraph under the H1. */
    intro: string
    /** YYYY-MM-DD; dateModified changes whenever the text is edited. */
    datePublished: string
    dateModified: string
    sections: GuideSection[]
    /** Shown on the page as "Sık sorulan sorular"; the FAQPage JSON-LD carries exactly these. */
    faq: GuideFaq[]
    /** Heading of the related products row. */
    productsTitle: string
    products: GuideProductRule
    /**
     * Which product pages show the "İlgili rehber" link to this guide (default: products.clauses). Product pages
     * try the guides in PRODUCT_GUIDE_ORDER (lib/guides/index.ts), most specific first.
     */
    productMatch?: GuideClause[]
}
