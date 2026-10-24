/**
 * SEO helpers for every storefront page: site constants, <head> metadata, titles, meta descriptions
 * and schema.org JSON-LD builders. The rules that pages must follow are in docs/SEO.md.
 *
 * Everything here is pure and safe in client components. getSiteSeo(), which reads D1, is in lib/seo-server.ts.
 * Values that end up in structured data come from real data (site_settings, shipping_settings,
 * the CMS policy pages, products, reviews). Nothing is invented: when a value is unknown it is left out.
 */
import type { Metadata } from 'next'
import { stripHtml } from './stripHtml'
import { roundPrice } from './roundPrice'
import { gtinJsonLdKey, isValidGtin, normalizeGtin } from './gtin'

// ---------------------------------------------------------------------------------------------
// Site constants
// ---------------------------------------------------------------------------------------------

/**
 * Canonical host. Deliberately a constant (not site_settings.site_url or NEXT_PUBLIC_BASE_URL):
 * canonicals, the sitemap and JSON-LD must always point at the apex https host that Akakçe,
 * Google Merchant and the sitemap already use, whichever host (www, workers.dev, localhost) served the page.
 */
export const SITE_URL = 'https://onopostore.com'

export const SITE = {
    name: 'Onopo Store',
    shortName: 'Onopo',
    url: SITE_URL,
    locale: 'tr_TR',
    language: 'tr-TR',
    currency: 'TRY',
    country: 'TR',
    imageHost: 'https://images.onopostore.com',
    /** Title template for the root layout: "<page title> | Onopo". */
    titleTemplate: '%s | Onopo',
    titleSuffix: ' | Onopo',
    defaultTitle: 'Onopo Store | Şarj Aleti, Şarj Kablosu ve Ekran Koruyucu',
    defaultDescription:
        "Onopo Store'da hızlı şarj aletleri, şarj ve data kabloları, ekran koruyucular, araç şarj cihazları ve powerbankler. Güvenli ödeme, hızlı kargo.",
} as const

/**
 * Fallback share image. public/og-image.jpg exists (1024x1024); /og-image.png never existed and must not be used.
 */
export const DEFAULT_OG_IMAGE = {
    url: `${SITE_URL}/og-image.jpg`,
    width: 1024,
    height: 1024,
    alt: 'Onopo Store',
} as const

/** Product titles: the part before " | Onopo" is kept at or under this many characters (whole <title> ≤ 60). */
export const PRODUCT_TITLE_MAX = 60 - SITE.titleSuffix.length

/** Query parameters on listing pages that create filtered/sorted/search variants (noindex,follow). */
export const LISTING_FILTER_PARAMS = ['q', 'search', 'f', 'sort', 'minPrice', 'maxPrice', 'brand', 'discounted', 'inStock'] as const

/** Parameters that make a listing noindex,follow: the filters above plus a ?category= that did not redirect (unknown or empty category). */
export const LISTING_NOINDEX_PARAMS = [...LISTING_FILTER_PARAMS, 'category'] as const

// ---------------------------------------------------------------------------------------------
// Site data from D1 (site_settings, shipping_settings, CMS policy pages)
// ---------------------------------------------------------------------------------------------

export interface ReturnPolicyInfo {
    /** Days the customer has to return the item (e.g. 14). */
    days: number
    /** true when the policy says return shipping is paid by the shop. */
    freeReturn: boolean
}

export interface HandlingTime {
    minDays: number
    maxDays: number
}

export interface SiteSeo {
    name: string
    shortName: string
    url: string
    description: string
    /** Absolute logo URL (site_settings.logo_url), if set. */
    logo?: string
    /** Real social profile URLs of the brand (placeholders and other accounts are dropped). */
    sameAs: string[]
    /** Customer service phone (site_settings.footer_phone), if set. */
    phone?: string
    email?: string
    /** "@handle" for twitter:site, derived from site_settings.twitter_url. */
    twitterHandle?: string
    freeShippingThreshold: number | null
    shippingCost: number | null
    returnPolicy: ReturnPolicyInfo | null
    handlingTime: HandlingTime | null
    /** Transit (carrier) time when the site states one; null uses DEFAULT_TRANSIT_TIME in the JSON-LD. */
    transitTime: HandlingTime | null
}

/**
 * Delivery time in the Product JSON-LD (offers.shippingDetails.deliveryTime; Search Console flags it when missing).
 * Handling: orders until 18:00 ship the same day, later ones the next working day (the CMS shipping page says
 * "0-1 iş günü"; this default is used only when that text cannot be parsed). Transit: the product pages say
 * "ertesi gün teslim edilir" and Merchant Center's shipping policy allows at most 2 transit days (owner, 2026-10).
 */
export const DEFAULT_HANDLING_TIME: HandlingTime = { minDays: 0, maxDays: 1 }
export const DEFAULT_TRANSIT_TIME: HandlingTime = { minDays: 1, maxDays: 2 }

export const DEFAULT_SITE_SEO: SiteSeo = {
    name: SITE.name,
    shortName: SITE.shortName,
    url: SITE_URL,
    description: SITE.defaultDescription,
    sameAs: [],
    freeShippingThreshold: null,
    shippingCost: null,
    returnPolicy: null,
    handlingTime: null,
    transitTime: null,
}

/** The few D1 methods these helpers use (a real D1Database satisfies it; tests pass a fake). */
export interface D1Like {
    prepare(query: string): D1StatementLike
}
export interface D1StatementLike {
    bind(...values: unknown[]): D1StatementLike
    first<T = Record<string, unknown>>(): Promise<T | null>
    all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>
}

const SETTINGS_KEYS = [
    'site_name', 'site_url', 'site_description', 'logo_url',
    'facebook_url', 'instagram_url', 'twitter_url', 'youtube_url', 'linkedin_url',
    'footer_phone', 'footer_email',
] // admin_email is never read here

const SOCIAL_HOSTS = ['facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'youtube.com', 'linkedin.com', 'tiktok.com', 'pinterest.com']

/**
 * Keeps only real brand profiles: an https URL on a known social host whose path names the brand
 * ("onopo"). Drops empty values, bare domains, '#', and profiles of other accounts
 * (site_settings.instagram_url currently points at a different shop's account).
 */
export function brandSocialUrls(urls: Array<string | null | undefined>, brand = 'onopo'): string[] {
    const out: string[] = []
    for (const raw of urls) {
        const value = (raw || '').trim()
        if (!value) continue
        let u: URL
        try { u = new URL(value) } catch { continue }
        if (u.protocol !== 'https:' && u.protocol !== 'http:') continue
        const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
        if (!SOCIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) continue
        if (!u.pathname.toLowerCase().includes(brand)) continue
        const clean = `https://${u.hostname}${u.pathname}`
        if (!out.includes(clean)) out.push(clean)
    }
    return out
}

/** "https://x.com/onopostore" -> "@onopostore" */
export function twitterHandleFromUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined
    try {
        const u = new URL(url)
        const host = u.hostname.replace(/^www\./, '')
        if (host !== 'x.com' && host !== 'twitter.com') return undefined
        const handle = u.pathname.split('/').filter(Boolean)[0]
        return handle && /^[A-Za-z0-9_]{1,15}$/.test(handle) ? `@${handle}` : undefined
    } catch {
        return undefined
    }
}

/**
 * Reads the return window and who pays return shipping from the policy text (CMS "shipping"/"help" pages).
 * Returns null when the text states no return window, so no return policy is claimed in structured data.
 */
export function parseReturnPolicy(text: string | null | undefined): ReturnPolicyInfo | null {
    if (!text) return null
    const plain = foldTr(text)
    // "14 gün içinde ... iade" / "iade ... 14 gün içinde"
    const m = plain.match(/(\d{1,3})\s*gun\s*icinde[^.]{0,120}iade/) || plain.match(/iade[^.]{0,160}?(\d{1,3})\s*gun\s*icinde/)
    if (!m) return null
    const days = parseInt(m[1], 10)
    if (!days || days > 365) return null
    const freeReturn = /iade[^.]{0,200}(kargo|gonderim)\s*ucreti\s*(tarafimizca|firmamizca|magazamizca)\s*karsilan/.test(plain)
        || /ucretsiz\s*iade/.test(plain)
    return { days, freeReturn }
}

/** "1-3 iş günü içerisinde ... kargo" -> { minDays: 1, maxDays: 3 } */
export function parseHandlingTime(text: string | null | undefined): HandlingTime | null {
    if (!text) return null
    const plain = foldTr(text)
    const m = plain.match(/(\d{1,2})\s*-\s*(\d{1,2})\s*is\s*gunu[^.]{0,120}kargo/)
    if (!m) return null
    const minDays = parseInt(m[1], 10)
    const maxDays = parseInt(m[2], 10)
    if (!(maxDays >= minDays) || maxDays > 30) return null
    return { minDays, maxDays }
}

function positiveNumber(v: unknown): number | null {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
    return Number.isFinite(n) && n >= 0 ? n : null
}

/** Loads SEO-relevant site data from D1. Never throws: falls back to DEFAULT_SITE_SEO piece by piece. */
export async function loadSiteSeo(db: D1Like): Promise<SiteSeo> {
    const site: SiteSeo = { ...DEFAULT_SITE_SEO, sameAs: [] }
    const placeholders = SETTINGS_KEYS.map(() => '?').join(',')
    const [settingsRes, shippingRes, pagesRes] = await Promise.allSettled([
        db.prepare(`SELECT key, value FROM site_settings WHERE key IN (${placeholders})`).bind(...SETTINGS_KEYS).all<{ key: string; value: string | null }>(),
        db.prepare('SELECT free_shipping_threshold, shipping_cost FROM shipping_settings LIMIT 1').first<{ free_shipping_threshold: unknown; shipping_cost: unknown }>(),
        db.prepare("SELECT slug, content FROM pages WHERE slug IN ('shipping', 'help', 'iade', 'kargo-ve-iade')").all<{ slug: string; content: string | null }>(),
    ])

    if (settingsRes.status === 'fulfilled') {
        const s: Record<string, string> = {}
        for (const row of settingsRes.value.results || []) s[row.key] = (row.value || '').trim()
        // site_settings.site_name is the short brand ("Onopo"); the store name stays "Onopo Store".
        if (s.site_name) site.shortName = s.site_name
        if (s.site_description) site.description = s.site_description
        if (s.logo_url) site.logo = resolveImageUrl(s.logo_url) || undefined
        site.sameAs = brandSocialUrls([s.facebook_url, s.instagram_url, s.twitter_url, s.youtube_url, s.linkedin_url])
        site.twitterHandle = twitterHandleFromUrl(s.twitter_url)
        if (s.footer_phone && /\d{7,}/.test(s.footer_phone.replace(/\D/g, ''))) site.phone = s.footer_phone
        if (s.footer_email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.footer_email)) site.email = s.footer_email
    }
    if (shippingRes.status === 'fulfilled' && shippingRes.value) {
        site.freeShippingThreshold = positiveNumber(shippingRes.value.free_shipping_threshold)
        site.shippingCost = positiveNumber(shippingRes.value.shipping_cost)
    }
    if (pagesRes.status === 'fulfilled') {
        const pages = pagesRes.value.results || []
        const ordered = ['shipping', 'kargo-ve-iade', 'iade', 'help']
            .map((slug) => pages.find((p) => p.slug === slug)?.content || '')
            .filter(Boolean)
        for (const text of ordered) {
            site.returnPolicy = site.returnPolicy || parseReturnPolicy(text)
            site.handlingTime = site.handlingTime || parseHandlingTime(text)
        }
    }
    return site
}

// ---------------------------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------------------------

/** Canonical product URL path. Product URLs are /<slug>/ (Akakçe, feeds, sitemap): never change this. */
export function productPath(slug: string): string {
    return `/${encodeURIComponent(slug)}/`
}
/** Category listing path: /kategori/<category-slug>/ */
export function categoryPath(slug: string): string {
    return `/kategori/${encodeURIComponent(slug)}/`
}
/** CMS page path: /page/<slug>/ (help, shipping, policy, terms and any page added in Admin › Sayfalar). */
export function cmsPagePath(slug: string): string {
    return `/page/${encodeURIComponent(slug)}/`
}

/**
 * Replacements for the old hard-coded listings /tech/ /beauty/ /gaming/ /new/ (they have 0 products).
 * "Yeni Gelenler" (/new) is the listing sorted newest first. The server redirects (lib/seo-routing.ts) and the
 * menu links (components/layout/nav-data.ts) both read this table. Kept here, not in seo-routing.ts, because the
 * menus are client code and seo-routing.ts imports the D1 layer.
 */
export const LEGACY_CATEGORY_TARGETS: Readonly<Record<string, string>> = {
    tech: '/products/',
    beauty: '/products/',
    new: '/products/?sort=newest',
    gaming: '/kategori/oyun-ve-oyuncu-aksesuarlari/',
}

/**
 * Former category slugs → the slug the category has now. Once no category has the old slug any more, its URLs
 * (/<old>/, /kategori/<old>/, /products/?category=<old>) answer 308 to /kategori/<new>/ (lib/seo-routing.ts
 * categorySlugAlias). While a category still has the old slug nothing changes.
 * 'ok-satanlar' was made by the old slugifier for "Çok Satanlar"; docs/SEO.md §10 renames it before launch.
 */
export const CATEGORY_SLUG_ALIASES: Readonly<Record<string, string>> = {
    'ok-satanlar': 'cok-satanlar',
}

/**
 * Absolute canonical URL: apex https host, path with a trailing slash, and only the query
 * parameters passed explicitly (e.g. { page: 2 }); empty, null, "1"-pages and others are dropped.
 */
export function canonicalUrl(path: string, query?: Record<string, string | number | null | undefined>): string {
    let p = (path || '/').trim()
    if (/^https?:\/\//i.test(p)) {
        try { p = new URL(p).pathname } catch { p = '/' }
    }
    p = p.split('#')[0].split('?')[0]
    if (!p.startsWith('/')) p = `/${p}`
    p = p.replace(/\/{2,}/g, '/')
    if (!p.endsWith('/')) p = `${p}/`
    const params: string[] = []
    if (query) {
        for (const key of Object.keys(query).sort()) {
            const v = query[key]
            if (v === null || v === undefined || v === '') continue
            if (key === 'page' && (Number(v) <= 1 || !Number.isFinite(Number(v)))) continue
            params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`)
        }
    }
    return `${SITE_URL}${reencode(p)}${params.length ? `?${params.join('&')}` : ''}`
}

/**
 * Percent-encodes a path exactly once, segment by segment, whether its segments arrive encoded
 * (productPath() output: "a%26b") or raw ("şarj", "a b"). decodeURI + encodeURI would turn an
 * already-encoded reserved character (%26, %2F, %3F …) into %2526.
 */
function reencode(path: string): string {
    return path
        .split('/')
        .map((seg) => {
            let raw = seg
            try { raw = decodeURIComponent(seg) } catch { /* a literal '%': encode it as is */ }
            return encodeURIComponent(raw)
        })
        .join('/')
}

/**
 * Absolute image URL for SEO output (og:image, JSON-LD, sitemap). Stored product images are
 * '/api/images/<key>'; they are served from the R2 custom domain without touching the Worker.
 */
export function resolveImageUrl(url: string | null | undefined): string | null {
    const u = (url || '').trim()
    if (!u) return null
    if (/^https?:\/\//i.test(u)) {
        const r2 = u.split('.r2.dev/')
        if (r2.length === 2 && r2[1]) return `${SITE.imageHost}/${r2[1]}`
        return u
    }
    if (u.startsWith('/api/images/')) return `${SITE.imageHost}/${u.slice('/api/images/'.length)}`
    if (u.startsWith('//')) return `https:${u}`
    if (u.startsWith('/')) return `${SITE_URL}${u}`
    return `${SITE.imageHost}/${u}`
}

/** products.images is a JSON string (or already an array). */
export function parseImages(images: unknown): string[] {
    if (Array.isArray(images)) return images.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    if (typeof images === 'string' && images.trim()) {
        try {
            const parsed = JSON.parse(images)
            return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []
        } catch {
            return []
        }
    }
    return []
}

/** URL safe to write raw into XML (Next's sitemap writer does not escape). */
export function xmlSafeUrl(url: string): string {
    const m = url.match(/^(https?:\/\/[^/?#]+)([^?#]*)(.*)$/i)
    const safe = m ? `${m[1]}${reencode(m[2])}${m[3]}` : reencode(url)
    return safe.replace(/&/g, '%26').replace(/'/g, '%27')
}

/** D1 "YYYY-MM-DD HH:MM:SS" (UTC) -> ISO 8601, or null. */
export function d1DateToIso(value: string | null | undefined): string | null {
    if (!value) return null
    const s = String(value).trim()
    const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s) ? `${s.replace(' ', 'T')}Z` : s
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// ---------------------------------------------------------------------------------------------
// Text helpers (Turkish)
// ---------------------------------------------------------------------------------------------

const TR_FOLD: Record<string, string> = { 'ı': 'i', 'ş': 's', 'ğ': 'g', 'ü': 'u', 'ö': 'o', 'ç': 'c', 'â': 'a', 'î': 'i', 'û': 'u' }

/** Lower-case ASCII fold with Turkish rules, one output char per input char (indexes stay aligned). */
export function foldTr(s: string): string {
    let out = ''
    for (const ch of s) {
        if (ch === 'İ' || ch === 'I') { out += 'i'; continue }
        const lower = ch.toLowerCase()
        if (lower.length !== ch.length) { out += ch; continue }
        out += TR_FOLD[lower] || lower
    }
    return out
}

/** Turkish-aware slug: "Çok Satanlar" -> "cok-satanlar". */
export function slugifyTr(s: string): string {
    return foldTr(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function collapseWs(s: string): string {
    return s.replace(/\s+/g, ' ').trim()
}

const DANGLING = /(?:\s+(?:ve|ile|veya|to|için|icin|&|\+|-|–|—|\/|,|\||ve\/veya))+$/i

/** Cuts at a word boundary to at most max chars, dropping dangling connectors ("ve", "to", "-", ...). */
export function truncateWords(s: string, max: number, ellipsis = false): string {
    const text = collapseWs(s)
    if (text.length <= max) return text
    const limit = ellipsis ? max - 1 : max
    let cut = text.slice(0, limit + 1)
    const lastSpace = cut.lastIndexOf(' ')
    cut = lastSpace > limit * 0.5 ? cut.slice(0, lastSpace) : text.slice(0, limit)
    cut = cut.replace(DANGLING, '').replace(/[\s,;:(\-–—|/]+$/, '')
    return ellipsis ? `${cut}…` : cut
}

/** Strips HTML, emoji and spec tails from a product description; restores missing spaces after periods. */
export function cleanDescriptionText(html: string | null | undefined): string {
    if (!html) return ''
    const beforeSpecs = html.split(/Teknik Özellikler/i)[0]
    let text = stripHtml(beforeSpecs, 100000)
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
        .replace(/&le;/gi, '≤')
        .replace(/&ge;/gi, '≥')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ' ') // emoji and other astral symbols
        .replace(/[←-⇿⌀-⏿☀-➿⬀-⯿️‍]/g, ' ') // ✅ ➝ ★ etc.
        .replace(/([a-zçğıöşü0-9)%])([.!?])([A-ZÇĞİÖŞÜ])/g, '$1$2 $3')
        // "kablo.30 watt" / "kablo.220 volt": a sentence that starts with a number (not "3.4A", where a digit precedes the dot)
        .replace(/([a-zçğıöşü])\.(\d)/g, '$1. $2')
    text = collapseWs(text)
    return text
}

function splitSentences(text: string): string[] {
    const out: string[] = []
    const re = /[^.!?]+(?:[.!?]+|$)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
        const s = m[0].trim()
        if (s) out.push(s)
    }
    // Re-join pieces split inside numbers like "3.4A" or "2.4 A"
    const merged: string[] = []
    for (const s of out) {
        const prev = merged[merged.length - 1]
        if (prev && /\d\.$/.test(prev) && /^\d/.test(s)) merged[merged.length - 1] = `${prev}${s}`
        else merged.push(s)
    }
    return merged
}

/**
 * Builds a meta description of min..max characters from a lead text and a closing facts sentence.
 * Cuts the lead at a sentence boundary when possible, otherwise at a word boundary with "…".
 */
export function fitDescription(lead: string, tail: string, opts: { min?: number; max?: number; fillers?: string[] } = {}): string {
    const min = opts.min ?? 140
    const max = opts.max ?? 160
    const t = collapseWs(tail)
    let l = collapseWs(lead)
    if (l && !/[.!?…]$/.test(l)) l += '.'
    if (!t) return l.length <= max ? l : truncateWords(l, max, true)
    if (!l) return t.length <= max ? t : truncateWords(t, max, true)
    const room = max - t.length - 1
    let result: string
    if (room < 20) {
        result = truncateWords(`${l} ${t}`, max, true)
    } else if (l.length <= room) {
        result = `${l} ${t}`
    } else {
        const sentences = splitSentences(l)
        let acc = ''
        for (const s of sentences) {
            const next = acc ? `${acc} ${s}` : s
            if (next.length > room) break
            acc = next
        }
        result = acc && acc.length + 1 + t.length >= min ? `${acc} ${t}` : `${truncateWords(l, room, true)} ${t}`
    }
    for (const f of opts.fillers || []) {
        if (result.length >= min) break
        if (result.includes(f)) continue // the lead already says it ("… uygun fiyatla Onopo Store'da.")
        if (result.length + 1 + f.length <= max) result = `${result} ${f}`
    }
    return result
}

function formatTL(n: number): string {
    return n.toLocaleString('tr-TR', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })
}

/** "Kargo bedava" / "500 TL üzeri kargo bedava" / "Kargo 100 TL" from shipping_settings and the product. */
export function shippingFact(site: Pick<SiteSeo, 'freeShippingThreshold' | 'shippingCost'>, price?: number, freeShipping?: boolean): string | null {
    const threshold = site.freeShippingThreshold
    if (freeShipping || (price !== undefined && threshold !== null && price >= threshold && threshold > 0) || site.shippingCost === 0) return 'Kargo bedava'
    if (threshold !== null && threshold > 0) return `${formatTL(threshold)} TL üzeri kargo bedava`
    return null
}

function factsTail(site: SiteSeo, price?: number, freeShipping?: boolean): string {
    const facts = [shippingFact(site, price, freeShipping), site.returnPolicy ? `${site.returnPolicy.days} gün iade` : null, 'güvenli ödeme']
        .filter((x): x is string => Boolean(x))
    const s = facts.join(', ')
    return `${s.charAt(0).toLocaleUpperCase('tr-TR')}${s.slice(1)}.`
}

// ---------------------------------------------------------------------------------------------
// Product titles and descriptions
// ---------------------------------------------------------------------------------------------

/**
 * Whole-word pattern that also works with Turkish letters (JS \b only knows ASCII word characters).
 * Group 1 is the preceding whitespace, so replacing with '$1' removes just the word(s).
 */
function word(words: string, lookahead = ''): RegExp {
    return new RegExp(`(^|\\s)(?:${words})(?=${lookahead || '\\s|$|[,.;:)]'})`, 'gi')
}

type Rewrite = [RegExp, string]

/** Step 1 when a title is too long: marketing words, removed one by one (in this order). */
const TITLE_FILLERS: Rewrite[] = [
    [/(^|\s)\(\s*[^)]{12,}\)/g, '$1'], // long marketing parentheses: "( 5 Yıl Garanti Güvencesiyle )"
    [word('Tam Kaplayan'), '$1'],
    [word('Anti Static'), '$1'],
    [word('Tam Ekran'), '$1'],
    [word('Şeffaf'), '$1'],
    [word('Led Göstergeli'), '$1'],
    [word('Led Işıklı'), '$1'],
    [word('Şarj Adilebilir'), '$1'],
    [word('Taşınabilir'), '$1'],
    [word('Esnek'), '$1'],
    [word('Metal Uçlu'), '$1'],
    [word('Güçlü'), '$1'],
    [word('Turbo'), '$1'],
    [word('Siyah Ekran Çerçeveli'), '$1Siyah Çerçeveli'],
    [/(\d(?:[.,]\d)?A)\s+Uyumlu(?=\s|$)/gi, '$1'], // "3.4A Uyumlu" -> "3.4A"
]
/** Step 2: the long compatibility boilerplate, shortened in stages. */
const TITLE_COMPAT: Rewrite[] = [
    [word('(?:iPhone|Telefon)\\s+ve\\s+(?:Android|Tablet)\\s+Uyumlu'), '$1'],
    [word('Tüm Telefonlar(?:a|la) Uyumlu'), '$1'],
    [word('Android\\s+Xiaomi\\s+ve\\s+Samsung\\s+Uyumlu'), '$1Samsung ve Xiaomi Uyumlu'],
    [word('Samsung ve Xiaomi Uyumlu'), '$1Android Uyumlu'],
    [word('Android Uyumlu'), '$1'],
    [word('Uyumlu'), '$1'],
]

/**
 * Head nouns (product types). The last occurrence of the first matching type is kept whole
 * (shortened only through its listed forms) so a cut never drops what the product is.
 */
const TITLE_TYPES: Array<{ re: RegExp; forms: string[]; cable?: boolean }> = [
    { re: /Hızlı Şarj ve Data Kablosu/g, forms: ['Şarj ve Data Kablosu', 'Şarj Kablosu'], cable: true },
    { re: /Şarj ve Data Kablo(?:su)?/g, forms: ['Şarj Kablosu'], cable: true },
    { re: /Cam Ekran Koruyucu/g, forms: ['Ekran Koruyucu'] },
    { re: /Ekran Koruyucu/g, forms: [] },
    { re: /(?:Turbo\s+)?(?:Hızlı\s+)?Araç Şarjı/g, forms: ['Araç Şarjı'] },
    { re: /(?:Hızlı\s+)?Şarj Cihazı/g, forms: ['Şarj Cihazı'] },
    { re: /(?:Hızlı\s+)?Şarj Aleti Seti/g, forms: ['Şarj Aleti Seti', 'Şarj Aleti'] },
    { re: /Şarj Adaptörü Başlığı/g, forms: ['Şarj Adaptörü'] },
    { re: /(?:Hızlı\s+)?Şarj Adaptörü/g, forms: ['Şarj Adaptörü'] },
    { re: /Şarj Başlığı/g, forms: [] },
    { re: /(?:AUX |Data )?Kablosu(?![a-zçğıöşü])/g, forms: [], cable: true }, // not the "Kablosu" in "Kablosuz"
    { re: /Kablosuz Kulaklık|Kulaklık|Powerbank|El Süpürgesi|Hepa Filtre|Toz Haznesi Aparatı|Oyun Konsolu|Oyun Kumandası|Fiş Yazıcı/g, forms: [] },
]

/** Spec tokens worth keeping after the head noun: 40W, 3.0A, 1 m, 100 cm, 1 Metre, 20000 mAh. */
const SPEC_TOKEN = /\d+(?:[.,]\d+)?\s?(?:W|A|mAh|mm|cm|m|M|Metre|metre)(?=\s|$|[,/)])/g

const TITLE_CASE_FIXES: Rewrite[] = [
    [/(^|\s)[İI]phone(?=\s|$)/g, '$1iPhone'],
    [/(^|\s)[İI]pad(?=\s|$)/g, '$1iPad'],
    [/(^|\s)[İI]nfinix(?=\s|$)/g, '$1Infinix'],
    [/\bUsb\b/g, 'USB'],
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

/** A unit right after a number ("3.5 mm", "1 Metre", "20 W"): the two are never separated by a cut. */
const UNIT_AFTER_NUMBER = /^\s?(?:mAh|mm|cm|m|M|Metre|metre|W|A|V|inç)(?=\s|$|[,/)])/

/** truncateWords for titles that never ends on a number whose unit was cut off ("… 3.5" from "… 3.5 mm"). */
function truncateTitleWords(s: string, max: number): string {
    const full = collapseWs(s)
    let cut = truncateWords(full, max)
    if (/\d$/.test(cut) && full.startsWith(cut) && UNIT_AFTER_NUMBER.test(full.slice(cut.length))) {
        cut = cut.replace(/\s*\S+$/, '').replace(DANGLING, '').replace(/[\s,;:(\-–—|/]+$/, '')
    }
    return cut
}

/** Strips the leading brand ("onopo ", "ONOPO - ") from a product name. */
export function stripBrandPrefix(name: string): string {
    return collapseWs(name).replace(/^onopo\b[\s\-–:|]*/i, '')
}

/** Always-on clean-ups: one "iPhone", no "Apple" next to it, no repeated leading "Hızlı Şarj". */
function dedupeTitle(s: string): string {
    let out = s
    if (/(^|\s)iPhone(?=\s|$)/.test(out)) {
        out = out.replace(word('Apple'), '$1')
        let seen = false
        out = out.replace(/(^|\s)iPhone(?=\s|$)/g, (m: string, sp: string) => {
            if (seen) return sp
            seen = true
            return m
        })
    }
    out = collapseWs(out)
    if (/^Hızlı Şarj\s.+Hızlı Şarj/.test(out)) out = out.replace(/^Hızlı Şarj\s+/, '')
    return out
}

function findTitleType(s: string): { index: number; text: string; forms: string[]; cable: boolean } | null {
    const colon = s.indexOf(': ')
    for (const t of TITLE_TYPES) {
        let last: RegExpExecArray | null = null
        let m: RegExpExecArray | null
        t.re.lastIndex = 0
        while ((m = t.re.exec(s))) last = m
        t.re.lastIndex = 0
        if (last && (colon < 0 || last.index < colon)) return { index: last.index, text: last[0], forms: t.forms, cable: Boolean(t.cable) }
    }
    return null
}

/**
 * Short product title for <title> (without the " | Onopo" suffix), at most PRODUCT_TITLE_MAX chars:
 * leading brand removed, marketing segments and filler words dropped only as far as needed,
 * the product type (head noun), the key specs (model, wattage, connector, length) and the model code kept.
 * Use only for metadata; product.name stays unchanged everywhere else (feeds, invoices, H1).
 */
export function productTitle(name: string, max: number = PRODUCT_TITLE_MAX): string {
    let s = stripBrandPrefix(name)
    for (const [re, rep] of TITLE_CASE_FIXES) s = s.replace(re, rep)
    s = collapseWs(s)

    // Model code at the end: "… - M9", "…)-F8", "…30cm- Q2"
    let code = ''
    const codeMatch = s.match(/\s*[-–]\s*([A-Z]{1,3}\d{1,3}[A-Z]?)\s*$/)
    if (codeMatch) {
        code = codeMatch[1]
        s = s.slice(0, codeMatch.index).trim()
    }

    // Segments separated by " | " or " – " / " - ": keep the first, keep later ones only if they carry a spec (a digit)
    const parts = s.split(/\s+[|–—]\s+|\s+-\s+/).map((x) => x.trim()).filter(Boolean)
    let core = parts[0] || s
    const specs = parts.slice(1).filter((p) => /\d/.test(p))
    if (core.length < 25 && parts.length > 1 && !specs.length) core = `${core} ${parts[1]}`
    s = dedupeTitle(collapseWs([core, ...specs].join(' ').replace(/:\s*$/, '')))

    const suffix = code && !new RegExp(`(^|\\s)${code}(\\s|$)`).test(s) ? ` ${code}` : ''
    const budget = max - suffix.length
    const finish = (t: string) => `${dedupeTitle(t).replace(DANGLING, '').replace(/[\s,;:]+$/, '')}${suffix}`.trim()
    if (s.length <= budget) return finish(s)

    const type = findTitleType(s)
    if (!type) {
        for (const [re, rep] of [...TITLE_FILLERS, ...TITLE_COMPAT]) {
            if (s.length <= budget) break
            s = collapseWs(s.replace(re, rep))
        }
        return finish(s.length > budget ? truncateTitleWords(s, budget) : s)
    }

    let before = s.slice(0, type.index).trim()
    let head = type.text
    let after = s.slice(type.index + type.text.length).trim()
    const total = () => [before, head, after].filter(Boolean).join(' ').length
    const steps: Array<() => void> = [
        ...TITLE_FILLERS.map(([re, rep]) => () => { before = collapseWs(before.replace(re, rep)) }),
        ...(type.cable ? [() => { before = collapseWs(before.replace(word('Kablo'), '$1')) }] : []),
        ...TITLE_COMPAT.map(([re, rep]) => () => {
            before = collapseWs(before.replace(re, rep))
            after = collapseWs(after.replace(re, rep))
        }),
        ...type.forms.map((f) => () => { head = f }),
        () => { after = (after.match(SPEC_TOKEN) || []).slice(0, 2).join(' ') },
    ]
    for (const step of steps) {
        if (total() <= budget) break
        step()
    }
    // "Kablolu Kulaklık … Kulaklık": the head noun already appears earlier, do not repeat it
    if (before.includes(head)) head = ''
    if (total() > budget) {
        const rest = [head, after].filter(Boolean).join(' ')
        const room = budget - (rest ? rest.length + 1 : 0)
        before = room >= 8 ? truncateTitleWords(before, room) : ''
    }
    let result = [before, head, after].filter(Boolean).join(' ')
    if (result.length > budget) result = truncateTitleWords(result, budget)
    return finish(result)
}

export interface ProductSeoInput {
    id: number | string
    name: string
    slug: string
    description?: string | null
    images?: unknown
    price: number | string
    original_price?: number | string | null
    stock?: number | string | null
    product_code?: string | null
    category?: string | null
    free_shipping?: number | boolean | null
    is_active?: number | boolean | null
    /** products.gtin (Admin › Ürünler "Barkod"); null/absent until migrations/2026-10-22-product-gtin.sql has run. */
    gtin?: string | null
}

/** Specs table appended to descriptions ("Teknik Özellikler Marka … Ürün Kodu … Barkod … Desi …"). */
export function parseProductSpecs(description: string | null | undefined): { brand?: string; code?: string; barcode?: string } {
    if (!description) return {}
    const idx = description.search(/Teknik Özellikler/i)
    if (idx < 0) return {}
    const tail = description.slice(idx).replace(/<[^>]*>/g, ' ')
    const grab = (label: string) => {
        const m = tail.match(new RegExp(`${label}\\s*([^<]{1,60}?)\\s*(?=Ürün Kodu|Barkod|Desi|Varyant|Marka|$)`))
        const v = m ? collapseWs(m[1]) : ''
        return v || undefined
    }
    const barcode = (tail.match(/Barkod\s*(\d{8,14})/) || [])[1]
    return { brand: grab('Marka'), code: grab('Ürün Kodu'), barcode }
}

/** GS1 check digit validation for GTIN-8/12/13/14 (lib/gtin.ts; re-exported for existing callers). */
export { isValidGtin }

/** Brand for structured data: Onopo for own products, the spec-table brand for others, else none. */
export function productBrand(p: Pick<ProductSeoInput, 'name' | 'description'>): string | undefined {
    if (/^\s*onopo\b/i.test(p.name)) return 'Onopo'
    const spec = parseProductSpecs(p.description).brand
    if (spec) return /^onopo$/i.test(spec) ? 'Onopo' : spec
    const text = cleanDescriptionText(p.description).slice(0, 80)
    if (/^onopo\b/i.test(text)) return 'Onopo'
    return undefined
}

/** Brand words written with a lowercase first letter: "iPhone …" starts a sentence, it is not a cut mid-sentence. */
const LOWERCASE_BRAND_WORD = 'i(?:Phone|Pad|Pod|OS|Mac|Cloud|Watch)(?![a-zçğıöşü])'
const LOWERCASE_BRAND = new RegExp(`^${LOWERCASE_BRAND_WORD}`)

/** Lead sentence(s) of a product description without the repeated product name / category label. */
export function productDescriptionLead(p: Pick<ProductSeoInput, 'name' | 'description'>): string {
    // Imported descriptions look like "Ürün Açıklaması<title>Detaylı Bilgi<body>Teknik Özellikler<specs>": use the body
    const raw = String(p.description || '')
    const bodyAt = raw.search(/Detaylı Bilgi/i)
    const text = cleanDescriptionText(bodyAt >= 0 ? raw.slice(bodyAt + 'Detaylı Bilgi'.length) : raw)
        .replace(/(^|\s)[İIi][Pp]hone(?=\s|$|[,.'’])/g, '$1iPhone')
        .replace(/(^|\s)[İIi][Pp]ad(?=\s|$|[,.'’])/g, '$1iPad')
        .replace(/(^|\s)İnfinix(?=\s|$|[,.'’])/g, '$1Infinix')
    if (!text) return ''
    const folded = foldTr(text)
    const nameCore = stripBrandPrefix(p.name).split(/\s+[|–—]\s+|\s+-\s+/)[0]
    let start = 0
    for (const candidate of [stripBrandPrefix(p.name), nameCore]) {
        const needle = foldTr(collapseWs(candidate))
        if (needle.length < 8) continue
        const at = folded.indexOf(needle)
        if (at >= 0 && at < 250) { start = at + needle.length; break }
    }
    let rest = text.slice(start).replace(/^[\s,.;:–—-]+/, '')

    // Variant echoes of the title before the real text ("… Kablosu 1 Metre - P7 Android cihazlarınız …"):
    // cut after the model code, or after the product's head noun when it runs straight into the next word.
    const shortName = stripBrandPrefix(p.name)
    const code = (shortName.match(/[-–]\s*([A-Z]{1,3}\d{1,3}[A-Z]?)\s*$/) || [])[1]
    if (code) {
        const m = rest.slice(0, 220).match(new RegExp(`^[^!?]*?[-–]\\s*${code}(?=\\s|$)`))
        if (m && !/[.!?]\s/.test(m[0])) { rest = rest.slice(m[0].length).trim(); start = start || 1 }
    }
    let fixedName = shortName
    for (const [re, rep] of TITLE_CASE_FIXES) fixedName = fixedName.replace(re, rep)
    const head = findTitleType(fixedName)?.text
    for (let i = 0; head && i < 3; i++) {
        const at = foldTr(rest).indexOf(foldTr(head))
        if (at < 0 || at > 150 || /[.!?]\s/.test(rest.slice(0, at))) break
        const next = rest.slice(at + head.length)
        if (!/^\s+[A-ZÇĞİÖŞÜ0-9]/.test(next)) break
        rest = next
            .replace(/^\s*(?:[\d.,]+\s*(?:metre|mt|cm|m)(?=\s|$))?\s*(?:[-–]\s*[A-Z]{1,3}\d{1,3}[A-Z]?(?=\s|$))?/i, '')
            .trim()
        start = start || 1
    }
    // "Model - F1 Yüksek kaliteli …": a spec-table fragment left in front of the text
    const modelLabel = rest.match(/^Model\s*[-–:]\s*[A-Z]{1,3}\d{1,3}[A-Z]?(?=\s|$)\s*/)
    if (modelLabel) { rest = rest.slice(modelLabel[0].length); start = start || 1 }
    // "Adaptör Şarj Kablosu M2 Android ve …": the rest of the echoed title, up to the model code
    if (code && start > 0) {
        const echo = rest.match(new RegExp(`^(?:[A-ZÇĞİÖŞÜ0-9+&/][^\\s.!?]*\\s+){1,8}?${code}\\s+(?=[A-ZÇĞİÖŞÜ]|${LOWERCASE_BRAND_WORD})`))
        if (echo) rest = rest.slice(echo[0].length)
    }

    // A cut in the middle of a sentence: continue from the next sentence ("iPhone …" is a sentence start)
    if (start > 0 && /^[a-zçğıöşü]/.test(rest) && !LOWERCASE_BRAND.test(rest)) {
        const next = rest.search(/[.!?]\s+[A-ZÇĞİÖŞÜ0-9]/)
        rest = next >= 0 ? rest.slice(next + 1).trim() : ''
    }
    return rest
}

const MODEL_BRAND = /^(?:iPhone|iPad|Galaxy|Samsung|Xiaomi|Redmi|Infinix|Huawei|Media|Mediapad|MediaPad|Mate|Matepad|MatePad)$/
const MODEL_WORD = /^(?:Pro|Max|Plus|Ultra|Lite|Mini|Note|Air|FE|Mi|Pad|Tab|TAB|\/|[A-Z]{0,3}\d{1,4}[A-Za-z]{0,2})$/
/** Specs that look like model numbers: "20W", "12D", "100cm" ("10A" stays: Redmi 10A). */
const SPEC_WORD = /^\d+(?:W|w|V|mAh|mm|cm|m|M|D|Hz)$/
/** A screen size ("11 inç", "7''") ends the device model. */
const SCREEN_SIZE_UNIT = /^(?:inç|inc|İnc|İnç|''|")$/i

/**
 * What tells a product apart from its siblings that share the same template text: the device it fits
 * ("iPhone 13 Pro Max", "Redmi Note 12 Pro Plus", "Samsung Galaxy Tab S6 Lite") and its model code
 * ("Q8" from "… - Q8", "BT1" from "BT1 Gürültü Önleyici …").
 */
export function productModelTokens(name: string): { device?: string; code?: string } {
    let s = stripBrandPrefix(name)
    for (const [re, rep] of TITLE_CASE_FIXES) s = s.replace(re, rep)
    s = collapseWs(s)
    const code = (s.match(/[-–]\s*([A-Z]{1,3}\d{1,3}[A-Z]?)\s*$/) || s.match(/^([A-Z]{1,3}\d{1,4}[A-Z]?)(?=\s)/) || [])[1]
    const words = s.split(' ')
    let device: string | undefined
    for (let i = 0; i < words.length && !device; i++) {
        if (!MODEL_BRAND.test(words[i])) continue
        let j = i + 1
        while (
            j < words.length
            && (MODEL_WORD.test(words[j]) || MODEL_BRAND.test(words[j]))
            && !SPEC_WORD.test(words[j])
            && !SCREEN_SIZE_UNIT.test(words[j + 1] || '')
        ) j++
        const phrase = words.slice(i, j)
        while (phrase[phrase.length - 1] === '/') phrase.pop()
        if (phrase.slice(1).some((w) => /\d/.test(w))) device = phrase.join(' ')
    }
    return { ...(device ? { device } : {}), ...(code ? { code } : {}) }
}

/**
 * Whole-word containment, ignoring case and Turkish accents. A longer model does not count:
 * "iPhone 13 Pro" is not mentioned by "iPhone 13 Pro Max modeliyle".
 */
function mentions(text: string, token: string): boolean {
    const norm = (s: string) => foldTr(collapseWs(s)).replace(/\s*\/\s*/g, '/')
    const t = norm(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${t}(?![a-z0-9]|\\s+(?:pro|max|plus|ultra|lite|mini|fe)(?![a-z]))`).test(norm(text))
}

/** "ekran koruyucu", "şarj kablosu", "kablosuz kulaklık": the product type of a name, for running text. */
function productTypeLabel(name: string): string {
    let s = stripBrandPrefix(name)
    for (const [re, rep] of TITLE_CASE_FIXES) s = s.replace(re, rep)
    const t = findTitleType(collapseWs(s))
    if (!t) return ''
    const label = t.forms[t.forms.length - 1] || t.text
    if (label === 'Kablosu') return 'kablo'
    return label.split(' ').map((w) => (/^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+$/.test(w) ? w.toLocaleLowerCase('tr-TR') : w)).join(' ')
}

/**
 * Many descriptions come from one template per product family and never name the model
 * ("Apple marka cihazlarınız için …" on ten iPhone screen protectors). When the text that is shown (`shown`, the
 * fitted description; default the lead) does not mention the device or the model code, the lead gets a short model
 * phrase in front, so every product page has its own description:
 * "iPhone 13 Pro Max ekran koruyucu: Apple marka …", "Onopo Q8 şarj kablosu: Apple cihazlarınız …".
 */
export function withModelPhrase(p: Pick<ProductSeoInput, 'name' | 'description'>, lead: string, shown: string = lead): string {
    const { device, code } = productModelTokens(p.name)
    // The device as descriptions name it: without the maker ("Galaxy Tab S7", "Redmi Note 12") and only the first
    // of a list ("iPhone 13" for "iPhone 13 / 13 Pro").
    const deviceCore = device && device.replace(/^(?:(?:Samsung|Xiaomi|Huawei)\s+)+/, '').split(/\s*\/\s*/)[0]
    const missing: string[] = []
    if (device && deviceCore && !mentions(shown, deviceCore)) missing.push(device)
    if (code && !mentions(shown, code)) missing.push(code)
    if (!missing.length) return lead
    const brand = !missing.includes(device as string) && productBrand(p) === 'Onopo' ? 'Onopo' : ''
    const phrase = [brand, ...missing, productTypeLabel(p.name)].filter(Boolean).join(' ')
    return `${phrase}: ${lead}`
}

/** Meta description for a product page (Turkish, about 140–160 chars, from the real description and shop facts). */
export function productMetaDescription(p: ProductSeoInput, site: SiteSeo = DEFAULT_SITE_SEO): string {
    const price = roundPrice(p.price)
    const stockFact = Number(p.stock) > 0 ? null : 'Şu an stokta yok.'
    const tail = [stockFact, factsTail(site, price, Boolean(Number(p.free_shipping)))].filter(Boolean).join(' ')
    const fit = (lead: string) => fitDescription(lead, tail, { fillers: ["Onopo Store'da."] })
    const own = productDescriptionLead(p)
    if (!own) return fit(`${productTitle(p.name)} uygun fiyatla Onopo Store'da.`)
    const plain = fit(own)
    const lead = withModelPhrase(p, own, plain)
    return lead === own ? plain : fit(lead)
}

// ---------------------------------------------------------------------------------------------
// Category / listing / home / CMS descriptions
// ---------------------------------------------------------------------------------------------

const PRODUCT_TYPES: Array<{ test: RegExp; plural: string; singular: string }> = [
    { test: /ekran koruyucu/, plural: 'ekran koruyucular', singular: 'Ekran Koruyucu' },
    { test: /arac sarj/, plural: 'araç şarj cihazları', singular: 'Araç Şarj Cihazı' },
    { test: /kablo/, plural: 'şarj ve data kabloları', singular: 'Şarj Kablosu' },
    { test: /sarj (aleti|cihazi|adaptoru|basligi)|adaptor/, plural: 'hızlı şarj aletleri', singular: 'Şarj Aleti' },
    { test: /powerbank/, plural: 'powerbankler', singular: 'Powerbank' },
    { test: /kulaklik/, plural: 'kulaklıklar', singular: 'Kulaklık' },
    { test: /supurge|hepa filtre|toz haznesi/, plural: 'el süpürgeleri ve yedek parçaları', singular: 'El Süpürgesi' },
    { test: /oyun|gamepad|pubg/, plural: 'mobil oyun aksesuarları', singular: 'Oyun Aksesuarı' },
    { test: /yazici/, plural: 'taşınabilir yazıcılar', singular: 'Taşınabilir Yazıcı' },
]

/** Product types present in a set of product names, most frequent first (first matching rule per name). */
export function detectProductTypes(names: string[]): Array<{ plural: string; singular: string; count: number }> {
    const counts = new Map<string, { plural: string; singular: string; count: number }>()
    for (const n of names) {
        const f = foldTr(n)
        const t = PRODUCT_TYPES.find((x) => x.test.test(f))
        if (!t) continue
        const cur = counts.get(t.plural) || { plural: t.plural, singular: t.singular, count: 0 }
        cur.count++
        counts.set(t.plural, cur)
    }
    return [...counts.values()].sort((a, b) => b.count - a.count)
}

function joinTr(items: string[]): string {
    if (items.length <= 1) return items[0] || ''
    return `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`
}

function pageSuffix(page?: number): string {
    return page && page > 1 ? ` - Sayfa ${page}` : ''
}

/** Category names that are a selection, not a kind of product ("Çok Satanlar", "Yeni Gelenler", "İndirimli Ürünler"). */
const MERCHANDISING_CATEGORY = /(^|\s)(cok satan|en cok|yeni gelen|yeni urun|indirim|kampanya|firsat|outlet|one cikan|populer|trend)/

/** Whether a category name is a selection ("Çok Satanlar") rather than a kind of product. */
export function isMerchandisingCategory(name: string | null | undefined): boolean {
    return MERCHANDISING_CATEGORY.test(foldTr(name || ''))
}

/** "<Category> Modelleri ve Fiyatları" when it fits, else shorter; a selection like "Çok Satanlar" keeps its plain name. */
export function categoryTitle(name: string, page?: number): string {
    const suffix = pageSuffix(page)
    const max = PRODUCT_TITLE_MAX - suffix.length
    const forms = MERCHANDISING_CATEGORY.test(foldTr(name)) ? [name] : [`${name} Modelleri ve Fiyatları`, `${name} Fiyatları`, name]
    for (const t of forms) {
        if (t.length <= max) return `${t}${suffix}`
    }
    return `${truncateWords(name, max)}${suffix}`
}

export interface ListingFacts {
    /** Number of products listed (active products in the listing). */
    count: number
    /** Lowest displayed (rounded) price, if known. */
    minPrice?: number | null
    /** Product names in the listing, used to name the product types it contains. */
    productNames?: string[]
}

/**
 * Lead of a listing description: "<Name>[ - Sayfa N]: <count> ürün, <min price> TL'den başlayan fiyatlarla. <Types> Onopo'da."
 * The page marker sits in the name, in front, so a cut never drops it and page N never repeats page 1's description.
 */
function listingLead(name: string, facts: ListingFacts, maxTypes: number, page?: number): string {
    const types = detectProductTypes(facts.productNames || []).slice(0, maxTypes).map((t) => t.plural)
    const price = facts.minPrice && facts.minPrice > 0 ? `, ${formatTL(roundPrice(facts.minPrice))} TL'den başlayan fiyatlarla` : ''
    return `${name}${pageSuffix(page)}: ${facts.count} ürün${price}${types.length ? `. ${capitalizeTr(joinTr(types))} Onopo'da` : ''}.`
}

/** Meta description for a category page, from the real product count, price range and product types. */
export function categoryMetaDescription(name: string, facts: ListingFacts, site: SiteSeo = DEFAULT_SITE_SEO, page?: number): string {
    return fitDescription(listingLead(name, facts, 3, page), factsTail(site), { fillers: ["Onopo Store'da."] })
}

/** Meta description for /products/ (all products) or a search result page. */
export function listingMetaDescription(facts: ListingFacts, site: SiteSeo = DEFAULT_SITE_SEO, opts: { query?: string; page?: number } = {}): string {
    if (opts.query) {
        const q = truncateWords(opts.query, 40)
        return fitDescription(`"${q}" araması için ${facts.count} ürün bulundu.`, factsTail(site), { min: 120, fillers: ["Onopo Store'da."] })
    }
    return fitDescription(listingLead('Tüm ürünler', facts, 4, opts.page), factsTail(site), { fillers: ["Onopo Store'da."] })
}

/** Home page <title> (absolute, no template) from the product types actually sold. */
export function homeTitle(productNames: string[]): string {
    const types = detectProductTypes(productNames).slice(0, 3).map((t) => t.singular)
    if (!types.length) return SITE.defaultTitle
    for (let n = types.length; n > 0; n--) {
        const t = `${SITE.name} | ${joinTr(types.slice(0, n))}`
        if (t.length <= 60) return t
    }
    return SITE.defaultTitle
}

/** Home page meta description from the product types actually sold and the shop facts. */
export function homeMetaDescription(productNames: string[], site: SiteSeo = DEFAULT_SITE_SEO): string {
    const types = detectProductTypes(productNames).slice(0, 4).map((t) => t.plural)
    const lead = types.length ? `${SITE.name}'da ${joinTr(types)} uygun fiyatlarla.` : SITE.defaultDescription
    return fitDescription(lead, factsTail(site), { fillers: ['Hızlı kargo.'] })
}

/** Meta description for a CMS page (Admin › Sayfalar) from its markdown-like content. */
export function cmsPageDescription(title: string, content: string | null | undefined): string {
    const text = collapseWs(
        String(content || '')
            .split('\n')
            .filter((line) => !/^\s*#/.test(line))
            .join(' ')
            .replace(/[*_`>]/g, ' '),
    )
    const lead = text || `${title} - ${SITE.name}.`
    return fitDescription(lead, '', { min: 120, max: 160 })
}

function capitalizeTr(s: string): string {
    return s ? `${s.charAt(0).toLocaleUpperCase('tr-TR')}${s.slice(1)}` : s
}

// ---------------------------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------------------------

export type SeoImage = string | { url: string; width?: number; height?: number; alt?: string }

export interface BuildMetadataInput {
    /** Page title without the brand; the root template adds " | Onopo". */
    title?: string
    /** Full title used as-is (home page). */
    absoluteTitle?: string
    description?: string
    /** Pathname of the canonical URL, e.g. "/kategori/cep-telefonu-aksesuarlari/". */
    path: string
    /** Query parameters that belong to the canonical URL (only { page } on listings). */
    query?: Record<string, string | number | null | undefined>
    images?: SeoImage[]
    /** noindex,follow (search results, filtered/sorted listings, utility pages). */
    noindex?: boolean
    /** with noindex: also nofollow (private pages). */
    nofollow?: boolean
    type?: 'website' | 'article'
    site?: Pick<SiteSeo, 'twitterHandle'>
}

/** Removes brand suffixes such as "- ONOPO", "| Onopo Store" that the title template would duplicate. */
export function cleanTitle(title: string): string {
    return collapseWs(title).replace(/(\s*[-|–]\s*(onopo(\s+store)?))+\s*$/i, '').trim()
}

function toOgImages(images: SeoImage[] | undefined, alt: string) {
    const out: Array<{ url: string; width?: number; height?: number; alt?: string }> = []
    for (const img of images || []) {
        const obj = typeof img === 'string' ? { url: img } : img
        const url = resolveImageUrl(obj.url)
        if (!url) continue
        out.push({ ...obj, url, alt: obj.alt || alt })
        if (out.length >= 4) break
    }
    if (!out.length) out.push({ ...DEFAULT_OG_IMAGE })
    return out
}

/**
 * Metadata for a page: self-referencing absolute canonical (trailing slash), Open Graph and Twitter tags,
 * og:image fallback /og-image.jpg, robots noindex when asked. A noindex page gets no canonical
 * (the two would be contradictory signals); its og:url still points at the clean URL.
 */
export function buildMetadata(input: BuildMetadataInput): Metadata {
    const title = input.absoluteTitle ? collapseWs(input.absoluteTitle) : cleanTitle(input.title || SITE.name)
    const fullTitle = input.absoluteTitle ? title : `${title}${SITE.titleSuffix}`
    const description = input.description ? truncateWords(input.description, 160, true) : undefined
    const url = canonicalUrl(input.path, input.query)
    const images = toOgImages(input.images, title)
    const handle = input.site?.twitterHandle

    const metadata: Metadata = {
        title: input.absoluteTitle ? { absolute: title } : title,
        ...(description ? { description } : {}),
        openGraph: {
            type: input.type || 'website',
            url,
            siteName: SITE.name,
            locale: SITE.locale,
            title: fullTitle,
            ...(description ? { description } : {}),
            images,
        },
        twitter: {
            card: 'summary_large_image',
            ...(handle ? { site: handle } : {}),
            title: fullTitle,
            ...(description ? { description } : {}),
            images: images.map((i) => i.url),
        },
    }
    if (input.noindex) {
        const follow = !input.nofollow
        metadata.robots = { index: false, follow, googleBot: { index: false, follow } }
    } else {
        metadata.alternates = { canonical: url }
    }
    return metadata
}

/**
 * Root-layout defaults (app/layout.tsx must use this instead of its own block): metadataBase, title template
 * "%s | Onopo", default description, og/twitter defaults with the existing /og-image.jpg, robots index,follow
 * with large image previews. No canonical here (pages set their own) and no verification placeholder
 * (Search Console is verified by DNS).
 */
export const rootMetadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    applicationName: SITE.name,
    title: { default: SITE.defaultTitle, template: SITE.titleTemplate },
    description: SITE.defaultDescription,
    openGraph: {
        type: 'website',
        locale: SITE.locale,
        // No og:url here: every page that inherits this object would tell Facebook it is the home page
        // (the og:url twin of the old layout canonical). buildMetadata() sets the page's own og:url.
        siteName: SITE.name,
        title: SITE.defaultTitle,
        description: SITE.defaultDescription,
        images: [{ ...DEFAULT_OG_IMAGE }],
    },
    twitter: {
        card: 'summary_large_image',
        site: '@onopostore',
        title: SITE.defaultTitle,
        description: SITE.defaultDescription,
        images: [DEFAULT_OG_IMAGE.url],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
    },
    formatDetection: { telephone: false },
}

/** Metadata for private/utility pages (cart, checkout, profile, orders, login, payment result pages). */
export const privatePageMetadata: Metadata = {
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

// ---------------------------------------------------------------------------------------------
// JSON-LD builders (pure; render with components/seo/JsonLd.tsx)
// ---------------------------------------------------------------------------------------------

export type JsonLdObject = { [key: string]: unknown }

export const ORGANIZATION_ID = `${SITE_URL}/#organization`
export const WEBSITE_ID = `${SITE_URL}/#website`

function returnPolicyJsonLd(policy: ReturnPolicyInfo): JsonLdObject {
    return {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: SITE.country,
        returnPolicyCountry: SITE.country,
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: policy.days,
        returnMethod: 'https://schema.org/ReturnByMail',
        ...(policy.freeReturn ? { returnFees: 'https://schema.org/FreeReturn' } : {}),
    }
}

/** OnlineStore (an Organization subtype). sameAs only real brand profiles; contactPoint only with a real phone. */
export function organizationJsonLd(site: SiteSeo): JsonLdObject {
    return {
        '@context': 'https://schema.org',
        '@type': 'OnlineStore',
        '@id': ORGANIZATION_ID,
        name: site.name,
        alternateName: site.shortName !== site.name ? site.shortName : undefined,
        url: `${SITE_URL}/`,
        ...(site.logo ? { logo: site.logo, image: site.logo } : {}),
        description: site.description,
        ...(site.email ? { email: site.email } : {}),
        ...(site.phone ? { telephone: site.phone } : {}),
        ...(site.sameAs.length ? { sameAs: site.sameAs } : {}),
        ...(site.phone
            ? {
                contactPoint: {
                    '@type': 'ContactPoint',
                    telephone: site.phone,
                    ...(site.email ? { email: site.email } : {}),
                    contactType: 'customer service',
                    areaServed: SITE.country,
                    availableLanguage: 'Turkish',
                },
            }
            : {}),
        ...(site.returnPolicy ? { hasMerchantReturnPolicy: returnPolicyJsonLd(site.returnPolicy) } : {}),
    }
}

/** WebSite with a SearchAction on /products/?q= (the parameter the listing reads). */
export function websiteJsonLd(site: Pick<SiteSeo, 'name'> = DEFAULT_SITE_SEO): JsonLdObject {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: site.name,
        url: `${SITE_URL}/`,
        inLanguage: SITE.language,
        publisher: { '@id': ORGANIZATION_ID },
        potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/products/?q={search_term_string}` },
            'query-input': 'required name=search_term_string',
        },
    }
}

export interface BreadcrumbItem {
    name: string
    /** Path or absolute URL; may be omitted for the last (current) item. */
    path?: string
}

/** BreadcrumbList; the visible breadcrumb on the page must show the same items. */
export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdObject {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: it.name,
            ...(it.path ? { item: canonicalUrl(it.path) } : {}),
        })),
    }
}

/** ItemList for listing pages: the products shown on this page, in order, by canonical URL. */
export function itemListJsonLd(items: Array<{ path: string; name?: string }>, opts: { name?: string; startIndex?: number } = {}): JsonLdObject {
    const start = opts.startIndex ?? 1
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        ...(opts.name ? { name: opts.name } : {}),
        numberOfItems: items.length,
        itemListElement: items.map((it, i) => ({
            '@type': 'ListItem',
            position: start + i,
            url: canonicalUrl(it.path),
            ...(it.name ? { name: it.name } : {}),
        })),
    }
}

export interface ArticleSeoInput {
    headline: string
    description: string
    /** Canonical path, e.g. "/rehber/<slug>/". */
    path: string
    /** YYYY-MM-DD */
    datePublished: string
    dateModified: string
    /** Absolute image URLs (the guide's product photos); the site's og-image when there is none. */
    images?: string[]
}

/**
 * Article for an editorial page (the shopping guides). Author and publisher are the store itself (the root
 * layout's OnlineStore node, same @id); the images are the guide's product photos (originals), or the site's og-image.
 */
export function articleJsonLd(article: ArticleSeoInput, site: Pick<SiteSeo, 'name' | 'logo'> = DEFAULT_SITE_SEO): JsonLdObject {
    const url = canonicalUrl(article.path)
    const organization = {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: site.name,
        url: `${SITE_URL}/`,
        ...(site.logo ? { logo: { '@type': 'ImageObject', url: site.logo } } : {}),
    }
    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.headline,
        description: article.description,
        url,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        inLanguage: SITE.language,
        datePublished: article.datePublished,
        dateModified: article.dateModified,
        image: article.images?.length ? article.images : [DEFAULT_OG_IMAGE.url],
        author: organization,
        publisher: organization,
    }
}

/** FAQPage: only for questions and answers that are visible on the page, as plain text. */
export function faqPageJsonLd(items: Array<{ question: string; answer: string }>): JsonLdObject {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map(it => ({
            '@type': 'Question',
            name: it.question,
            acceptedAnswer: { '@type': 'Answer', text: it.answer },
        })),
    }
}

export interface ReviewStats {
    count: number
    average: number
}

/** One real review for the Product JSON-LD `review` list (lib/product-data.ts ProductReview has these fields). */
export interface ReviewJsonLdInput {
    rating: number
    comment?: string | null
    created_at?: string | null
    /** Display name as the product page shows it ("Ayşe K."). */
    author: string
}

/** At most this many reviews go into the JSON-LD (newest first, as passed). */
export const JSON_LD_REVIEW_LIMIT = 5

/**
 * Product JSON-LD. The first keys and their formats are the ones Akakçe parses today and must stay:
 * name, description (stripHtml 500), image[] (absolute), sku (product_code or ONOPO-<id>), brand, url,
 * offers { url, priceCurrency TRY, price "1499.99" (roundPrice, = checkout price), priceValidUntil, availability, seller },
 * category. Added after them: mpn, gtin, itemCondition, shippingDetails, hasMerchantReturnPolicy, aggregateRating,
 * review (up to JSON_LD_REVIEW_LIMIT real reviews, only together with aggregateRating).
 */
export function productJsonLd(
    p: ProductSeoInput,
    opts: { site?: SiteSeo; reviews?: ReviewStats | null; reviewItems?: ReviewJsonLdInput[] | null; now?: Date } = {},
): JsonLdObject {
    const site = opts.site || DEFAULT_SITE_SEO
    const url = canonicalUrl(productPath(p.slug))
    const images = parseImages(p.images).map((i) => resolveImageUrl(i)).filter((x): x is string => Boolean(x))
    const price = roundPrice(p.price)
    const inStock = Number(p.stock) > 0
    const code = (p.product_code || '').trim()
    const specs = parseProductSpecs(p.description)
    // Akakçe has matched on brand "ONOPO" for every product since launch, so the JSON-LD keeps that exact
    // value (productBrand() gives the real brand where a page needs it). Change it only after checking with Akakçe.
    const brand = 'ONOPO'
    const now = opts.now || new Date()
    const priceValidUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const shippingValue = shippingFact(site, price, Boolean(Number(p.free_shipping))) === 'Kargo bedava' ? 0 : site.shippingCost
    const handling = site.handlingTime ?? DEFAULT_HANDLING_TIME
    const transit = site.transitTime ?? DEFAULT_TRANSIT_TIME
    const shippingDetails = shippingValue === null || shippingValue === undefined
        ? null
        : {
            '@type': 'OfferShippingDetails',
            shippingRate: { '@type': 'MonetaryAmount', value: shippingValue, currency: SITE.currency },
            shippingDestination: { '@type': 'DefinedRegion', addressCountry: SITE.country },
            deliveryTime: {
                '@type': 'ShippingDeliveryTime',
                handlingTime: { '@type': 'QuantitativeValue', minValue: handling.minDays, maxValue: handling.maxDays, unitCode: 'DAY' },
                transitTime: { '@type': 'QuantitativeValue', minValue: transit.minDays, maxValue: transit.maxDays, unitCode: 'DAY' },
            },
        }

    // The admin's barcode field first, else a barcode in the description's spec table; only valid GS1 codes
    const ownGtin = normalizeGtin(p.gtin)
    const gtin = isValidGtin(ownGtin) ? ownGtin : isValidGtin(specs.barcode) ? specs.barcode as string : null
    const gtinKey = gtin ? gtinJsonLdKey(gtin) : null
    const reviews = opts.reviews && opts.reviews.count > 0 && opts.reviews.average > 0 ? opts.reviews : null
    const reviewItems = reviews ? reviewJsonLdItems(opts.reviewItems) : []

    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        description: stripHtml(p.description || '', 500),
        image: images,
        sku: code || `ONOPO-${p.id}`,
        ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
        url,
        offers: {
            '@type': 'Offer',
            url,
            priceCurrency: SITE.currency,
            price: price.toFixed(2),
            priceValidUntil,
            availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            seller: { '@type': 'Organization', name: SITE.name },
            itemCondition: 'https://schema.org/NewCondition',
            ...(shippingDetails ? { shippingDetails } : {}),
            ...(site.returnPolicy ? { hasMerchantReturnPolicy: returnPolicyJsonLd(site.returnPolicy) } : {}),
        },
        ...(p.category ? { category: p.category } : {}),
        ...(code ? { mpn: code } : {}),
        ...(gtin && gtinKey ? { [gtinKey]: gtin } : {}),
        ...(reviews
            ? {
                aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: Math.round(reviews.average * 10) / 10,
                    reviewCount: reviews.count,
                    bestRating: 5,
                    worstRating: 1,
                },
            }
            : {}),
        ...(reviewItems.length ? { review: reviewItems } : {}),
    }
}

/** Real reviews as schema.org Review objects: rating 1–5, the shown name, the date (YYYY-MM-DD), the text if any. */
function reviewJsonLdItems(items: ReviewJsonLdInput[] | null | undefined): JsonLdObject[] {
    const out: JsonLdObject[] = []
    for (const r of items ?? []) {
        const rating = Math.round(Number(r.rating))
        const author = String(r.author ?? '').trim()
        if (!(rating >= 1 && rating <= 5) || !author) continue
        const date = d1DateToIso(r.created_at ?? null)
        const body = collapseWs(String(r.comment ?? ''))
        out.push({
            '@type': 'Review',
            reviewRating: { '@type': 'Rating', ratingValue: rating, bestRating: 5, worstRating: 1 },
            author: { '@type': 'Person', name: author },
            ...(date ? { datePublished: date.slice(0, 10) } : {}),
            ...(body ? { reviewBody: body } : {}),
        })
        if (out.length >= JSON_LD_REVIEW_LIMIT) break
    }
    return out
}

/**
 * The hidden #product-info block that Akakçe's crawler parses (in addition to the Product JSON-LD).
 * Byte-for-byte the markup app/[slug]/page.tsx renders today (see docs/SEO.md, "Akakçe crawl contract"):
 * element ids, tr-TR price format with " ₺", "Stokta"/"Tükendi", image order and the two legacy links.
 * The only addition is loading="lazy" at the end of each <img>, so the hidden images are never downloaded.
 * Render it with components/seo/ProductMachineData.tsx; do not edit the format without checking Akakçe.
 */
export function productInfoHtml(p: ProductSeoInput): string {
    const name = String(p.name || '')
    const images = parseImages(p.images)
    const displayPrice = roundPrice(p.price)
    const displayOriginalPrice = p.original_price ? roundPrice(p.original_price) : null
    const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'
    const sku = String(p.product_code || `ONOPO-${p.id}`)
    return [
        '',
        `  <h1 id="product-name">${name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</h1>`,
        `  <span id="product-price">${fmt(displayPrice)}</span>`,
        ...(displayOriginalPrice && displayOriginalPrice > displayPrice
            ? [`  <span id="product-original-price">${fmt(displayOriginalPrice)}</span>`]
            : []),
        `  <span id="product-sku">${sku.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`,
        `  <span id="product-stock">${Number(p.stock) > 0 ? 'Stokta' : 'Tükendi'}</span>`,
        `  <span id="product-category">${String(p.category || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`,
        ...images.map((img, i) =>
            // loading="lazy" (last attribute, everything before it unchanged): the block is display:none, so browsers
            // never fetch these originals (up to 32 MB per page); Akakçe reads the src attribute from the HTML.
            `  <img id="product-image-${i + 1}" src="${resolveImageUrl(img) || DEFAULT_OG_IMAGE.url}" alt="${name.replace(/"/g, '&quot;')}" loading="lazy" />`,
        ),
        `  <a id="add-to-cart" href="/cart?add=${p.id}">Sepete Ekle</a>`,
        `  <a id="buy-now" href="/checkout?product=${p.id}">Hemen Al</a>`,
        '',
    ].join('\n')
}

/** Serializes JSON-LD for a <script> tag; "<" is escaped so the content cannot close the script element. */
export function serializeJsonLd(data: unknown, pretty = false): string {
    return JSON.stringify(data, null, pretty ? 2 : undefined).replace(/</g, '\\u003c')
}
