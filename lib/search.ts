/**
 * Catalogue search: Turkish folding, tokenising, matching and ranking.
 *
 * This module is ISOMORPHIC: it has no server imports, so it can run in a Server Component,
 * a route handler (app/api/products) and in the browser (instant-search dropdown).
 * The catalogue is ~120 products, so everything is plain in-memory JS.
 *
 * Rules (see docs/FRONTEND.md → "Search"):
 * - Folding: Turkish-aware lowercase, then ı→i, ş→s, ğ→g, ç→c, ö→o, ü→u (and â/î/û), accents stripped,
 *   punctuation → space. "Şarj", "ŞARJ", "sarj" all become "sarj"; "Type-C" becomes "type c".
 * - Tokens are ANDed: every token must match name, slug, category or product_code.
 * - 1–2 character tokens only match at the START of a word (never as a substring), so "ka" finds
 *   "kablo"/"kafa" but never "returns everything". A query that is a single character matches only
 *   the start of the name (without the "onopo" brand word) or the product code.
 *   Digits respect number boundaries: "15" matches "15", "15w", "iphone 15" but not "150".
 * - Ranking: exact name > exact phrase > name prefix > word-start > substring; product_code hits are boosted.
 * - A query with no usable token (empty, only punctuation, only stop words) matches NOTHING.
 */

// ---------------------------------------------------------------------------------------------
// Folding and tokenising
// ---------------------------------------------------------------------------------------------

/** Turkish-aware fold: lowercase + strip Turkish diacritics. Deterministic on server and client. */
export function foldTr(input: string | null | undefined): string {
    if (!input) return ''
    return String(input)
        // Do the Turkish-specific uppercase letters by hand so the result never depends on ICU data
        .replace(/İ/g, 'i')
        .replace(/I/g, 'ı')
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ş/g, 's')
        .replace(/ğ/g, 'g')
        .replace(/ç/g, 'c')
        .replace(/ö/g, 'o')
        .replace(/ü/g, 'u')
        .replace(/[âàáä]/g, 'a')
        .replace(/[îìíï]/g, 'i')
        .replace(/[ûùúü]/g, 'u')
        .replace(/[êèéë]/g, 'e')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
}

/** Fold and turn every non-alphanumeric run into a single space. */
export function normalizeText(input: string | null | undefined): string {
    return foldTr(input).replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Words that carry no meaning on their own; dropped from multi-word queries. */
const STOP_WORDS = new Set(['ve', 'ile', 'icin', 'de', 'da', 'ya', 'veya', 'bir', 'the', 'and', 'for', 'with'])

export interface PreparedQuery {
    /** The original query string (trimmed). */
    raw: string
    /** Folded, punctuation-free query ("type c 20w"). */
    norm: string
    /** Tokens that must all match. Empty means "no usable query" → no results. */
    tokens: string[]
}

/** Prepare a query once and reuse it for every product. */
export function prepareQuery(q: string | null | undefined): PreparedQuery {
    const raw = (q ?? '').toString().trim().slice(0, 120)
    const norm = normalizeText(raw)
    let tokens = Array.from(new Set(norm.split(' ').filter(Boolean)))
    if (tokens.length > 1) {
        const meaningful = tokens.filter(t => !STOP_WORDS.has(t))
        if (meaningful.length > 0) tokens = meaningful
    } else if (tokens.length === 1 && STOP_WORDS.has(tokens[0]) && tokens[0].length < 3) {
        tokens = []
    }
    return { raw, norm, tokens: tokens.slice(0, 8) }
}

/** True when the query has at least one token that can match something. */
export function hasUsableQuery(q: string | null | undefined): boolean {
    return prepareQuery(q).tokens.length > 0
}

// ---------------------------------------------------------------------------------------------
// Searchable documents
// ---------------------------------------------------------------------------------------------

/** The minimum a record needs to be searchable. Catalogue products and raw API rows both fit. */
export interface SearchableFields {
    name: string
    slug?: string | null
    category?: string | null
    product_code?: string | null
}

interface FieldIndex {
    weight: number
    norm: string
    words: string[]
}

interface SearchDoc {
    /** Folded name with a leading "onopo" brand word removed. */
    displayNorm: string
    nameNorm: string
    code: string
    fields: FieldIndex[]
    /** All words glued together, for "typec" / "usbc" style queries. */
    compact: string
}

/** Split "20w" → ["20w","20","w"], "e1190" → ["e1190","e","1190"] so number/unit tokens line up. */
function expandWords(norm: string): string[] {
    const out: string[] = []
    for (const w of norm.split(' ')) {
        if (!w) continue
        out.push(w)
        const parts = w.match(/[a-z]+|[0-9]+/g)
        if (parts && parts.length > 1) out.push(...parts)
    }
    return out
}

const docCache = new WeakMap<object, SearchDoc>()

function buildDoc(item: SearchableFields): SearchDoc {
    const cached = docCache.get(item)
    if (cached) return cached
    const nameNorm = normalizeText(item.name)
    const displayNorm = nameNorm.replace(/^onopo\s+/, '')
    const slugNorm = normalizeText(item.slug)
    const catNorm = normalizeText(item.category)
    const code = normalizeText(item.product_code)
    const fields: FieldIndex[] = [
        { weight: 1, norm: nameNorm, words: expandWords(nameNorm) },
        { weight: 1, norm: code, words: expandWords(code) },
        { weight: 0.5, norm: catNorm, words: expandWords(catNorm) },
        { weight: 0.4, norm: slugNorm, words: expandWords(slugNorm) },
    ].filter(f => f.norm.length > 0)
    const doc: SearchDoc = {
        displayNorm,
        nameNorm,
        code,
        fields,
        compact: (nameNorm + ' ' + slugNorm).replace(/ /g, ''),
    }
    docCache.set(item, doc)
    return doc
}

const isDigits = (s: string) => /^[0-9]+$/.test(s)

/** For numeric tokens, the character after the match must not be a digit ("15" ≠ "150"). */
function boundaryOk(word: string, at: number, token: string): boolean {
    if (!isDigits(token)) return true
    const before = at > 0 ? word[at - 1] : ''
    const after = word[at + token.length] || ''
    return !/[0-9]/.test(before) && !/[0-9]/.test(after)
}

/** Folded words that name the same thing in product titles (charger = aleti / cihazı / adaptörü / başlığı). */
const SYNONYM_GROUPS: string[][] = [
    ['aleti', 'alet', 'cihazi', 'cihaz', 'adaptoru', 'adaptor', 'basligi', 'baslik'],
]

/** The other words of the token's synonym group (empty when it has none). */
function synonymsOf(token: string): string[] {
    const group = SYNONYM_GROUPS.find(g => g.includes(token))
    return group ? group.filter(w => w !== token) : []
}

/** 3 = whole word, 2 = word starts with token, 1 = substring (tokens ≥ 3 chars only), 0 = no match. */
function matchWords(words: string[], token: string): number {
    // Inside a multi-word query a single character must be a whole word: "usb c" / "type c".
    if (token.length === 1) return words.includes(token) ? 3 : 0
    let best = 0
    for (const w of words) {
        if (w === token) return 3
        if (w.startsWith(token) && boundaryOk(w, 0, token)) {
            best = Math.max(best, 2)
            continue
        }
        if (token.length >= 3 && best < 1) {
            const at = w.indexOf(token)
            if (at > 0 && boundaryOk(w, at, token)) best = 1
        }
    }
    return best
}

/**
 * Score one record against a prepared query. Returns 0 when it does not match (AND over tokens).
 * Higher is better; the absolute number only matters for ordering.
 */
export function scoreSearch(item: SearchableFields, query: PreparedQuery): number {
    if (query.tokens.length === 0) return 0
    const doc = buildDoc(item)
    // A lone single character only matches the start of the (brand-less) name or the product code:
    // "s" → "S2 12W Şarj Adaptörü", not every product that has some word starting with "s".
    if (query.tokens.length === 1 && query.tokens[0].length === 1) {
        const t = query.tokens[0]
        const starts = (s: string) => s.startsWith(t) && boundaryOk(s, 0, t)
        if (starts(doc.displayNorm)) return 300
        if (doc.code && starts(doc.code)) return 200
        return 0
    }
    let total = 0
    for (const token of query.tokens) {
        let best = 0
        for (const f of doc.fields) {
            const m = matchWords(f.words, token)
            if (m > 0) best = Math.max(best, m * 10 * f.weight)
        }
        if (best === 0 && token.length >= 3 && !isDigits(token) && doc.compact.includes(token)) best = 8
        if (best === 0) {
            // "şarj aleti" should also find "Şarj Cihazı / Adaptörü / Başlığı": same product, other words
            for (const syn of synonymsOf(token)) {
                for (const f of doc.fields) {
                    const m = matchWords(f.words, syn)
                    if (m > 0) best = Math.max(best, m * 8 * f.weight)
                }
            }
        }
        if (best === 0) return 0
        total += best
    }
    const q = query.norm
    if (q) {
        if (doc.displayNorm === q || doc.nameNorm === q) total += 1000
        if ((' ' + doc.nameNorm + ' ').includes(' ' + q + ' ')) total += 400
        if (doc.displayNorm.startsWith(q) || doc.nameNorm.startsWith(q)) total += 250
        if (doc.code && (doc.code === q || query.tokens.includes(doc.code))) total += 500
    }
    return total
}

/** True when the record matches every token of the query. */
export function matchesSearch(item: SearchableFields, query: PreparedQuery | string): boolean {
    const prepared = typeof query === 'string' ? prepareQuery(query) : query
    return scoreSearch(item, prepared) > 0
}

export interface SearchOptions<T> {
    /** Max results to return (default: all). */
    limit?: number
    /** Put sold-out items after in-stock ones (default true when items have a numeric `stock`). */
    soldOutLast?: boolean
    /** Custom tie-breaker after score (default: compareSearchTies). */
    tieBreak?: (a: T, b: T) => number
}

/**
 * Order of results with the same score: shorter name first (the query is a larger part of the title,
 * so "iphone 15" lists "iPhone 15" before "iPhone 15 Pro Max"), then the newer product (higher id).
 * The one rule for every search surface: the instant-search dropdown, /api/products?q= and the
 * "Önerilen" order of the /products/?q= listing (lib/catalog listProducts) all use it, so pressing
 * Enter shows the dropdown's products in the same order.
 */
export function compareSearchTies(a: { name?: string | null; id?: number | string | null }, b: { name?: string | null; id?: number | string | null }): number {
    const la = a.name?.length ?? 0
    const lb = b.name?.length ?? 0
    if (la !== lb) return la - lb
    return Number(b.id ?? 0) - Number(a.id ?? 0)
}

/**
 * Filter + rank a list. Returns [] when the query has no usable token (never "everything").
 * Works for catalogue `Product`s, `/api/products` rows and the `/api/products?index=1` payload.
 */
export function searchItems<T extends SearchableFields & { id?: number | string; stock?: number | null }>(
    items: readonly T[],
    q: string | PreparedQuery | null | undefined,
    options: SearchOptions<T> = {},
): T[] {
    const query = typeof q === 'object' && q !== null ? q : prepareQuery(q)
    if (query.tokens.length === 0) return []
    const soldOutLast = options.soldOutLast !== false
    const scored: { item: T; score: number }[] = []
    for (const item of items) {
        const score = scoreSearch(item, query)
        if (score > 0) scored.push({ item, score })
    }
    scored.sort((a, b) => {
        if (soldOutLast) {
            const sa = a.item.stock != null && a.item.stock <= 0 ? 1 : 0
            const sb = b.item.stock != null && b.item.stock <= 0 ? 1 : 0
            if (sa !== sb) return sa - sb
        }
        if (b.score !== a.score) return b.score - a.score
        return (options.tieBreak ?? compareSearchTies)(a.item, b.item)
    })
    const out = scored.map(s => s.item)
    return options.limit != null ? out.slice(0, options.limit) : out
}

// ---------------------------------------------------------------------------------------------
// Facets (listing quick-filter chips, spec §10) and spec chips on product cards (spec §9)
// ---------------------------------------------------------------------------------------------

export interface FacetDefinition {
    /** URL value used in `?f=` (multi-select, ANDed). */
    key: string
    label: string
    /** Runs on the folded, punctuation-free product name. */
    test: (normName: string) => boolean
}

/** Highest "NNw" wattage in a folded, punctuation-free name (0 when none). */
export const wattOf = (norm: string): number => {
    let max = 0
    for (const m of norm.matchAll(/(?:^|\s)(\d{2,3})\s?w(?=\s|$)/g)) max = Math.max(max, parseInt(m[1], 10))
    return max
}

/** Derived from product names; display-only grouping, no DB column involved. */
export const FACETS: FacetDefinition[] = [
    { key: 'iphone', label: 'iPhone / Lightning', test: n => /\b(iphone|lightning)\b/.test(n) },
    { key: 'type-c', label: 'Android / Type-C', test: n => /\b(type ?c|usb c|typec|android)\b/.test(n) },
    { key: 'micro-usb', label: 'Micro USB', test: n => /\bmicro ?usb\b/.test(n) },
    { key: 'arac', label: 'Araç', test: n => /\barac/.test(n) },
    { key: 'powerbank', label: 'Powerbank', test: n => /\bpower ?bank\b|\btasinabilir sarj\b/.test(n) },
    { key: 'kulaklik', label: 'Kulaklık', test: n => /\bkulaklik/.test(n) },
    { key: 'ekran-koruyucu', label: 'Ekran koruyucu', test: n => /\bekran koruyucu|\b(temperli|kirilmaz|nano) cam\b/.test(n) },
    { key: 'kablo', label: 'Kablo', test: n => /\bkablo/.test(n) },
    // "baslik" and its possessive "basligi" ("Şarj Başlığı - M3" was the one charger left out)
    { key: 'sarj-aleti', label: 'Şarj aleti', test: n => /\bsarj (aleti|cihazi|adaptoru)|\badaptor|\bbasli(k|gi)\b/.test(n) },
    { key: '20w', label: '20W ve üzeri', test: n => wattOf(n) >= 20 },
    { key: 'orgulu', label: 'Örgülü', test: n => /\borgulu\b/.test(n) },
]

const FACET_BY_KEY = new Map(FACETS.map(f => [f.key, f]))

export function getFacet(key: string): FacetDefinition | undefined {
    return FACET_BY_KEY.get(key)
}

/** True when the product name matches the facet. Unknown keys never match. */
export function matchesFacet(name: string, key: string): boolean {
    const facet = FACET_BY_KEY.get(key)
    return facet ? facet.test(normalizeText(name)) : false
}

/** Keep only known facet keys, de-duplicated, in registry order. */
export function sanitizeFacetKeys(keys: readonly (string | null | undefined)[] | null | undefined): string[] {
    if (!keys) return []
    const wanted = new Set(keys.flatMap(k => (k ?? '').split(',')).map(k => k.trim()).filter(Boolean))
    return FACETS.filter(f => wanted.has(f.key)).map(f => f.key)
}

/**
 * Up to `max` short spec chips parsed from a product name, for cards: wattage, connector,
 * capacity, length. Display only. ("30W Type-C Hızlı Şarj 1 Metre" → ["30W", "Type-C"]).
 */
export function specChips(name: string, max = 2): string[] {
    const chips: string[] = []
    const folded = foldTr(name)
    const watt = folded.match(/(?:^|[^0-9])(\d{2,3})\s?w(?![a-z])/)
    if (watt) chips.push(`${watt[1]}W`)
    if (/type[\s-]?c\b|usb[\s-]?c\b/.test(folded)) chips.push('Type-C')
    else if (/\blightning\b/.test(folded)) chips.push('Lightning')
    else if (/micro[\s-]?usb/.test(folded)) chips.push('Micro USB')
    else if (/usb[\s-]?a\b/.test(folded)) chips.push('USB-A')
    const mah = folded.match(/(\d{4,5})\s?mah\b/)
    if (mah) chips.push(`${mah[1]} mAh`)
    const len = folded.match(/(?:^|[^0-9.,])(\d+(?:[.,]\d+)?)\s?(cm|mt|metre|m)\b/)
    if (len) chips.push(len[2] === 'cm' ? `${len[1]} cm` : `${len[1].replace('.', ',')} m`)
    return chips.slice(0, max)
}

/**
 * Casing fixes for product names on screen: the rules lib/seo.ts productTitle applies to <title> (its
 * TITLE_CASE_FIXES, not exported; keep the two lists in step), plus lowercase "iphone"/"ipad", "USB-C" and
 * "Onopo" inside a name. Only whole words, units right after a number and known misspellings change;
 * model codes ("D6", "T120", "trml1") and every other word keep their case.
 */
const NAME_CASE_FIXES: Array<[RegExp, string]> = [
    [/(^|\s)[İIi][Pp]hone(?=\s|$|[,.;:)/'’])/g, '$1iPhone'],
    [/(^|\s)[İIi][Pp]ad(?=\s|$|[,.;:)/'’])/g, '$1iPad'],
    [/(^|\s)[İI]nfinix(?=\s|$|[,.;:)/'’])/g, '$1Infinix'],
    [/(^|\s)onopo(?=\s|$|[,.;:)/'’])/gi, '$1Onopo'],
    [/\bUsb\b/g, 'USB'],
    [/\bUSB-c\b/g, 'USB-C'],
    [/\bType-c\b/gi, 'Type-C'],
    [/\bPd\b/g, 'PD'],
    [/\bGan\b/g, 'GaN'],
    [/\bAux\b/g, 'AUX'],
    [/\bTo\b/g, 'to'],
    [/\bVe\b/g, 've'],
    [/(\d)\s?mah\b/gi, '$1 mAh'],
    [/(\d(?:[.,]\d+)?)w\b/g, '$1W'],
    [/(\d(?:[.,]\d+)?)a\b/g, '$1A'],
    [/(\d)\s?mt\b/gi, '$1 m'],
    [/(\d)\s?MM\b/g, '$1 mm'],
    [/(\d)\s?CM\b/g, '$1 cm'],
    [/\bTurbu\b/g, 'Turbo'],
    [/\bPubg\b/g, 'PUBG'],
    [/(\d\s)In(?=\s+\d)/g, '$1in'], // "5 In 1" -> "5 in 1"
    [/(^|\s)İn[cç](?=\s|$)/g, '$1inç'], // "9.6 İnc" -> "9.6 inç"
]

/** The casing fixes above, on any product name (display only). */
export function fixNameCase(name: string): string {
    let out = name
    for (const [re, rep] of NAME_CASE_FIXES) out = out.replace(re, rep)
    return out
}

/**
 * Product name for display (cards, search, cart, the product page H1): drops a leading "onopo" brand word
 * and fixes the casing (fixNameCase). The raw name stays in alt/title/aria-label, SEO, JSON-LD and feeds.
 */
export function displayName(name: string): string {
    const trimmed = (name || '').trim()
    const stripped = trimmed.replace(/^onopo(?:\s*[-|:·]\s*|\s+)/i, '')
    return fixNameCase(stripped.length > 0 ? stripped : trimmed)
}

/** Folded last words of a leading compatibility phrase ("… Uyumlu", "… İçin") and its joiner words. */
const COMPAT_END = new Set(['uyumlu', 'icin'])
const COMPAT_LOWER = new Set(['ve', 'ile', 'uyumlu', 'icin'])
/** At most this many words before "Uyumlu"/"İçin" ("Android Xiaomi Ve Samsung Uyumlu" has 4). */
const MAX_COMPAT_WORDS = 6

/**
 * Card title split (display only; the full name stays in alt/title/aria-label, SEO and feeds).
 * Many names start with the same compatibility phrase ("Android Xiaomi Ve Samsung Uyumlu …",
 * "İphone Apple Uyumlu …"), so in a 2-line clamp neighbouring cards look identical and the product
 * type is cut off. A short, generic leading phrase that ends in "Uyumlu"/"İçin" moves to its own line:
 *   "onopo Android Xiaomi Ve Samsung Uyumlu Micro Usb Hızlı Şarj ve Data Kablosu 3.0A / 1MT - D6"
 *   → title "Micro Usb Hızlı Şarj ve Data Kablosu 3.0A / 1MT - D6", compat "Android Xiaomi ve Samsung uyumlu"
 * A phrase that names a model ("Iphone 15 Pro Uyumlu …", it has a number) is what tells the variants
 * apart, so it stays at the start of the title. Names without such a phrase (or where "Uyumlu" comes
 * late, after model lists) keep displayName().
 */
export function splitDisplayName(name: string): { title: string; compat: string | null } {
    const title = displayName(name)
    const words = title.split(/\s+/).filter(Boolean)
    // Keep at least two words after the phrase
    const last = Math.min(MAX_COMPAT_WORDS, words.length - 3)
    for (let i = 1; i <= last; i++) {
        const before = words[i - 1]
        // A separator or a clause end before the keyword: this is not a leading phrase
        if (/^[-–|·:]$/.test(before) || /[,;:|]$/.test(before)) break
        if (!COMPAT_END.has(foldTr(words[i]))) continue
        if (words.slice(0, i).some(w => /\d/.test(w))) break
        const rest = words.slice(i + 1).join(' ').replace(/^[-–|·:,\s]+/, '')
        if (rest.split(' ').length < 2) break
        const compat = words
            .slice(0, i + 1)
            .map((w, k) => (k > 0 && COMPAT_LOWER.has(foldTr(w)) ? w.toLocaleLowerCase('tr-TR') : w))
            .join(' ')
        const first = rest.charAt(0)
        const head = /\p{Ll}/u.test(first) && /\p{Ll}/u.test(rest.charAt(1)) ? first.toLocaleUpperCase('tr-TR') : first
        return { title: head + rest.slice(1), compat }
    }
    return { title, compat: null }
}

/** "ONOPO" when the product is our own brand (name starts with onopo), else null. */
export function brandOf(name: string): string | null {
    return /^onopo\b/i.test((name || '').trim()) ? 'ONOPO' : null
}
