/**
 * Server data layer for the storefront (Server Components, route handlers, generateMetadata).
 *
 * - Reads D1 directly through getDB(); never call this from client components.
 * - Every exported getter is wrapped in React `cache()`, so within ONE request the layout, the page and
 *   generateMetadata share a single D1 round trip per data set (no cross-request caching: admin edits
 *   show up on the next request).
 * - The catalogue is ~120 products: active products are loaded once per request and filtered, searched,
 *   sorted and counted in JS. Counts and listings therefore always agree.
 * - Out-of-stock policy (owner decision pending, implemented as "show"): active products with
 *   stock <= 0 ARE listed, after all in-stock products, with `in_stock: false` (cards show "Tükendi" and
 *   cannot add to cart). Category counts include them, so a count always equals what the listing shows.
 *   Exceptions that keep today's behaviour: homepage sections and related products use in-stock only.
 *
 * API reference: docs/FRONTEND.md → "Data layer".
 */
import 'server-only'
import { cache } from 'react'
import { getDB } from '@/lib/db'
import { roundPrice } from '@/lib/roundPrice'
import { discountPercent } from '@/lib/format'
import {
    compareSearchTies,
    FACETS,
    foldTr,
    normalizeText,
    prepareQuery,
    sanitizeFacetKeys,
    scoreSearch,
    type PreparedQuery,
} from '@/lib/search'
import { categoryPath } from '@/lib/seo'
import { orderSectionProducts, rankMostViewed } from '@/lib/analytics'
import { recentProductViews, type D1Lite as AnalyticsDb } from '@/lib/analytics-db'

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

/** A product as listings and cards need it. Field names follow the D1 columns / API rows. */
export interface Product {
    id: number
    name: string
    slug: string
    /** Raw DB price. Pass this to the cart (addItem); show `display_price`. */
    price: number
    /** Raw DB "old" price, may be lower than price or null. */
    original_price: number | null
    /** roundPrice(price): what the customer sees and is charged per unit. */
    display_price: number
    /** roundPrice(original_price) when it is a real higher price, else null (no strikethrough). */
    display_original_price: number | null
    /** Rounded discount % between the display prices (0 = no discount). */
    discount_percent: number
    stock: number
    in_stock: boolean
    /** Stored image references (e.g. "/api/images/<key>"), parsed from the JSON column once. */
    images: string[]
    /** images[0] or null. */
    image: string | null
    /** Category NAME as stored on the product (products reference categories by name). */
    category: string
    product_code: string | null
    free_shipping: boolean
    created_at: string | null
}

/** Full product row for the product page. */
export interface ProductDetail extends Product {
    description: string
    warranty_info: string | null
    delivery_info: string | null
    installment_info: string | null
    whatsapp_order_enabled: boolean
    whatsapp_number: string | null
    is_active: boolean
    updated_at: string | null
}

export interface HeaderLink {
    label: string
    href: string
}

/**
 * Site settings that are safe for every visitor. Built from an ALLOWLIST: secret or admin-only keys
 * (admin_email, anything not listed below) never leave the server.
 */
export interface PublicSiteSettings {
    site_name: string
    site_description: string
    site_url: string
    logo_url: string | null
    favicon_url: string | null
    footer_text: string
    footer_email: string
    footer_phone: string
    footer_address: string
    /** Category names the admin picked for the footer ([] = automatic). */
    footer_categories: string[]
    footer_social_visible: boolean
    facebook_url: string
    instagram_url: string
    twitter_url: string
    youtube_url: string
    linkedin_url: string
    tiktok_url: string
    whatsapp_number: string
    /** Admin › Header links in admin order ('#categories' = categories menu trigger). */
    header_links: HeaderLink[]
    maintenance_mode: boolean
    products_per_page: number
    /** Optional override for the announcement bar (site_settings.topbar_messages JSON array). */
    topbar_messages: string[] | null
    /** Kill switch of the Onopo Asistan chat (Admin › AI Asistan). Off: no launcher, the API answers 503. */
    ai_assistant_enabled: boolean
    /**
     * The assistant's WhatsApp number (Admin › AI Asistan; '' = not set). Public so the chat UI picks the same
     * number as the server (ai_whatsapp_number → whatsapp_number → footer_phone) before its first reply and on
     * error rows that never get a `meta` event. Every wa.me link the chat shows contains it anyway.
     */
    ai_whatsapp_number: string
    /**
     * The assistant's popular-question chips (site_settings.ai_popular_questions, a JSON string array of at most
     * 3, written by the weekly analysis or Admin › AI Asistan); [] = none. The empty chat shows them after the
     * fixed "Kargo bedava için ne eklesem?"; the chat UI (components/assistant/starters.ts) checks each one again.
     */
    ai_popular_questions: string[]
}

export interface ShippingSettings {
    freeShippingThreshold: number
    shippingCost: number
}

export interface Category {
    id: number
    name: string
    slug: string
    icon: string
    /** Active products in this category (in stock + sold out) = what its listing shows. */
    product_count: number
    /** Of which in stock. */
    in_stock_count: number
    /** Listing URL for this category (single place to change when /kategori/<slug>/ ships). */
    href: string
}

export interface MenuItem {
    id: number
    title: string
    url: string
    parent_id: number | null
    sort_order: number
    children: MenuItem[]
}

export interface HeroSlide {
    id: number
    title: string
    subtitle: string
    button_text: string
    button_link: string
    image_url: string
    display_order: number
}

export interface HomeSection {
    id: number
    type: string
    title: string
    display_order: number
    /** Parsed JSON config exactly as the admin saved it. */
    config: Record<string, any>
    /** 'products' / 'new_products': resolved products (in stock, at most config.limit || 8). */
    products?: Product[]
    /** 'products' / 'new_products': "Tümünü gör" target. */
    viewAllHref?: string
    /** 'hero': active slides. */
    slides?: HeroSlide[]
    /** 'categories': categories with products. */
    categories?: Category[]
}

export type ProductSort = 'recommended' | 'newest' | 'price_asc' | 'price_desc' | 'discount'
export const PRODUCT_SORTS: ProductSort[] = ['recommended', 'newest', 'price_asc', 'price_desc', 'discount']

export interface ListProductsParams {
    /** Free-text search (lib/search). A query with no usable token returns 0 items, never everything. */
    q?: string | null
    /** Category by slug (e.g. "cep-telefonu-aksesuarlari"). */
    categorySlug?: string | null
    /** Category by name ("Cep Telefonu Aksesuarları"); a slug passed here is resolved too. */
    categoryName?: string | null
    /** Facet keys from lib/search FACETS (?f=), ANDed. Unknown keys are ignored. */
    facets?: string[] | null
    /** Bounds on the DISPLAY price (TL), inclusive. */
    minPrice?: number | null
    maxPrice?: number | null
    onlyDiscounted?: boolean
    inStockOnly?: boolean
    sort?: ProductSort | string | null
    page?: number | null
    /** Default: site_settings.products_per_page (20). Clamped to 1..200. */
    pageSize?: number | null
}

export interface FacetCount {
    key: string
    label: string
    /** Results you would get with this facet added to the current filters. */
    count: number
    selected: boolean
}

export interface ListProductsResult {
    items: Product[]
    /** Matching products over the full set (in stock + sold out unless inStockOnly). */
    total: number
    inStockTotal: number
    page: number
    pageSize: number
    totalPages: number
    sort: ProductSort
    /** Resolved category, or null. */
    category: Category | null
    /** A category was requested but matches no category row and no product. */
    categoryNotFound: boolean
    /** Trimmed search query ('' when none). */
    query: string
    /** True when a query was given but has no usable token (result is empty on purpose). */
    queryHasNoTokens: boolean
    facets: FacetCount[]
    /** Min/max display price before the price filter (for filter UI), null when no items. */
    priceRange: { min: number; max: number } | null
}

// ---------------------------------------------------------------------------------------------
// D1 access helpers
// ---------------------------------------------------------------------------------------------

interface D1Stmt {
    bind(...values: unknown[]): D1Stmt
    all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>
    first<T = Record<string, unknown>>(): Promise<T | null>
}
interface D1Like {
    prepare(sql: string): D1Stmt
    batch<T = Record<string, unknown>>(statements: D1Stmt[]): Promise<{ results?: T[] }[]>
}

async function db(): Promise<D1Like> {
    return (await getDB()) as unknown as D1Like
}

/** Run several SELECTs in one round trip; if the batch fails, run them one by one (each may fail alone). */
async function selectMany(sqls: string[]): Promise<(Record<string, any>[] | null)[]> {
    const d = await db()
    try {
        const res = await d.batch(sqls.map(s => d.prepare(s)))
        return res.map(r => (r.results ?? []) as Record<string, any>[])
    } catch {
        return Promise.all(
            sqls.map(async s => {
                try {
                    const r = await d.prepare(s).all()
                    return (r.results ?? []) as Record<string, any>[]
                } catch (err) {
                    console.error('[catalog] query failed:', s.slice(0, 60), err)
                    return null
                }
            }),
        )
    }
}

const str = (v: unknown): string => (v == null ? '' : String(v))
const num = (v: unknown, fallback = 0): number => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
    return Number.isFinite(n) ? n : fallback
}
const bool = (v: unknown): boolean => v === true || v === 1 || v === '1' || v === 'true'

function parseJson<T>(value: unknown, fallback: T): T {
    if (value == null || value === '') return fallback
    if (typeof value !== 'string') return value as T
    try {
        return JSON.parse(value) as T
    } catch {
        return fallback
    }
}

function parseImages(value: unknown): string[] {
    const parsed = parseJson<unknown>(value, [])
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string' && x.length > 0) : []
}

// ---------------------------------------------------------------------------------------------
// Base data: settings, shipping, categories, menus, payment flags (one D1 batch per request)
// ---------------------------------------------------------------------------------------------

const DEFAULT_SETTINGS: PublicSiteSettings = {
    site_name: 'Onopo',
    site_description: '',
    site_url: 'https://onopostore.com',
    logo_url: null,
    favicon_url: null,
    footer_text: '',
    footer_email: '',
    footer_phone: '',
    footer_address: '',
    footer_categories: [],
    footer_social_visible: false,
    facebook_url: '',
    instagram_url: '',
    twitter_url: '',
    youtube_url: '',
    linkedin_url: '',
    tiktok_url: '',
    whatsapp_number: '',
    header_links: [],
    maintenance_mode: false,
    products_per_page: 20,
    topbar_messages: null,
    ai_assistant_enabled: false,
    ai_whatsapp_number: '',
    ai_popular_questions: [],
}

const DEFAULT_SHIPPING: ShippingSettings = { freeShippingThreshold: 500, shippingCost: 100 }

interface BaseData {
    settings: PublicSiteSettings
    settingsLoaded: boolean
    shipping: ShippingSettings
    categoryRows: { id: number; name: string; slug: string; icon: string }[]
    menus: MenuItem[]
    paytrActive: boolean
    /** site_settings.max_installments (not public; only used by getMaxInstallments). */
    maxInstallmentsOverride: number | null
}

function toPublicSettings(rows: Record<string, any>[]): PublicSiteSettings {
    const kv: Record<string, string> = {}
    for (const r of rows) kv[str(r.key)] = str(r.value)
    const s: PublicSiteSettings = { ...DEFAULT_SETTINGS }
    const text = (k: keyof PublicSiteSettings & string) => {
        if (kv[k] != null) (s as any)[k] = kv[k]
    }
    ;(['site_name', 'site_description', 'site_url', 'footer_text', 'footer_email', 'footer_phone', 'footer_address',
        'facebook_url', 'instagram_url', 'twitter_url', 'youtube_url', 'linkedin_url', 'tiktok_url', 'whatsapp_number', 'ai_whatsapp_number'] as const).forEach(text)
    // The store has no separate WhatsApp setting today: fall back to the assistant's number, then to the
    // footer phone when it is a mobile (05…) number, so the menu, footer and help pages show WhatsApp too
    if (!s.whatsapp_number.trim()) {
        const mobile = (v: string) => /^(?:90)?0?5\d{9}$/.test(v.replace(/\D/g, ''))
        s.whatsapp_number = [s.ai_whatsapp_number, s.footer_phone].find(v => v.trim() && mobile(v))?.trim() ?? ''
    }
    if (!s.site_name.trim()) s.site_name = DEFAULT_SETTINGS.site_name
    s.logo_url = kv.logo_url?.trim() || null
    s.favicon_url = kv.favicon_url?.trim() || null
    s.footer_social_visible = bool(kv.footer_social_visible)
    s.maintenance_mode = bool(kv.maintenance_mode)
    s.ai_assistant_enabled = bool(kv.ai_assistant_enabled)
    const perPage = parseInt(kv.products_per_page || '', 10)
    s.products_per_page = Number.isFinite(perPage) && perPage > 0 && perPage <= 200 ? perPage : DEFAULT_SETTINGS.products_per_page
    const footerCats = parseJson<unknown>(kv.footer_categories, [])
    s.footer_categories = Array.isArray(footerCats) ? footerCats.map(str).filter(Boolean) : []
    const links = parseJson<unknown>(kv.header_links, [])
    s.header_links = Array.isArray(links)
        ? links
            .map((l: any) => ({ label: str(l?.label).trim(), href: str(l?.href).trim() }))
            .filter(l => l.label && l.href)
        : []
    const popular = parseJson<unknown>(kv.ai_popular_questions, [])
    s.ai_popular_questions = Array.isArray(popular)
        ? popular.filter((q): q is string => typeof q === 'string').map(q => q.replace(/\s+/g, ' ').trim()).filter(q => q.length > 0 && q.length <= 32).slice(0, 3)
        : []
    const top = parseJson<unknown>(kv.topbar_messages, null)
    s.topbar_messages = Array.isArray(top) ? top.map(str).map(t => t.trim()).filter(Boolean) : null
    return s
}

const loadBaseData = cache(async (): Promise<BaseData> => {
    try {
        const [settingsRows, shippingRows, categoryRows, menuRows, paymentRows] = await selectMany([
            'SELECT key, value FROM site_settings',
            'SELECT free_shipping_threshold, shipping_cost FROM shipping_settings LIMIT 1',
            'SELECT id, name, slug, icon FROM categories',
            'SELECT id, title, url, parent_id, sort_order FROM menus WHERE is_active = 1 ORDER BY sort_order ASC, id ASC',
            // Only flags: never select PayTR keys here
            "SELECT provider, is_active, CASE WHEN merchant_id IS NOT NULL AND merchant_id <> '' THEN 1 ELSE 0 END AS configured FROM payment_settings",
        ])

        const shippingRow = shippingRows?.[0]
        const shipping: ShippingSettings = shippingRow
            ? {
                freeShippingThreshold: num(shippingRow.free_shipping_threshold, DEFAULT_SHIPPING.freeShippingThreshold),
                shippingCost: num(shippingRow.shipping_cost, DEFAULT_SHIPPING.shippingCost),
            }
            : DEFAULT_SHIPPING

        const flat: MenuItem[] = (menuRows ?? []).map(r => ({
            id: num(r.id),
            title: str(r.title),
            url: str(r.url) || '#',
            parent_id: r.parent_id == null || r.parent_id === '' ? null : num(r.parent_id),
            sort_order: num(r.sort_order),
            children: [],
        }))

        const overrideRow = (settingsRows ?? []).find(r => str(r.key) === 'max_installments')
        const override = parseInt(str(overrideRow?.value), 10)

        return {
            settings: settingsRows ? toPublicSettings(settingsRows) : DEFAULT_SETTINGS,
            settingsLoaded: settingsRows != null,
            shipping,
            categoryRows: (categoryRows ?? []).map(r => ({
                id: num(r.id),
                name: str(r.name),
                slug: str(r.slug),
                icon: str(r.icon) || 'package',
            })),
            menus: flat,
            paytrActive: (paymentRows ?? []).some(r => str(r.provider || 'paytr').toLowerCase() === 'paytr' && bool(r.is_active) && bool(r.configured)),
            maxInstallmentsOverride: Number.isFinite(override) && override >= 2 && override <= 18 ? override : null,
        }
    } catch (err) {
        console.error('[catalog] base data unavailable, using defaults:', err)
        return { settings: DEFAULT_SETTINGS, settingsLoaded: false, shipping: DEFAULT_SHIPPING, categoryRows: [], menus: [], paytrActive: false, maxInstallmentsOverride: null }
    }
})

/** Public site settings (allowlisted keys only). Never throws: falls back to defaults. */
export const getSiteSettings = cache(async (): Promise<PublicSiteSettings> => (await loadBaseData()).settings)

/** Shipping rule used by the cart, cards and PDP: free from `freeShippingThreshold`, else `shippingCost`. */
export const getShippingSettings = cache(async (): Promise<ShippingSettings> => (await loadBaseData()).shipping)

/**
 * Maximum credit-card installment count to advertise, or null when unknown.
 * Source: optional site_settings.max_installments override; otherwise 12 when PayTR is the active,
 * configured provider (lib/payment/paytr.ts sends no_installment=0, max_installment=0 = PayTR's
 * maximum of 12, which is also what /api/installment-rates lists). Rates carry commission, so never
 * advertise "vade farksız".
 */
export const getMaxInstallments = cache(async (): Promise<number | null> => {
    const base = await loadBaseData()
    if (base.maxInstallmentsOverride != null) return base.maxInstallmentsOverride
    return base.paytrActive ? 12 : null
})

/** Flat list of active admin menu items (Admin › Menüler) in sort order (`children` left empty). */
export const getMenus = cache(async (): Promise<MenuItem[]> => (await loadBaseData()).menus)

/** Top-level menu items, each with its `children` (one level, as the admin supports). */
export async function getMenuTree(): Promise<MenuItem[]> {
    const flat = (await getMenus()).map(m => ({ ...m, children: [] as MenuItem[] }))
    const byId = new Map(flat.map(m => [m.id, m]))
    for (const m of flat) if (m.parent_id != null) byId.get(m.parent_id)?.children.push(m)
    // Children of a hidden (inactive) parent stay hidden instead of becoming top-level items
    return flat.filter(m => m.parent_id == null)
}

// ---------------------------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------------------------

const LIST_COLUMNS = 'id, name, slug, price, original_price, stock, images, category, product_code, free_shipping, created_at'

function toProduct(r: Record<string, any>): Product {
    const price = num(r.price)
    const original = r.original_price == null || r.original_price === '' ? null : num(r.original_price)
    const display = roundPrice(price)
    const displayOriginalRaw = original && original > 0 ? roundPrice(original) : null
    const displayOriginal = displayOriginalRaw != null && displayOriginalRaw > display ? displayOriginalRaw : null
    const images = parseImages(r.images)
    const stock = Math.trunc(num(r.stock))
    return {
        id: num(r.id),
        name: str(r.name),
        slug: str(r.slug),
        price,
        original_price: original,
        display_price: display,
        display_original_price: displayOriginal,
        discount_percent: discountPercent(display, displayOriginal),
        stock,
        in_stock: stock > 0,
        images,
        image: images[0] ?? null,
        category: str(r.category),
        product_code: str(r.product_code).trim() || null,
        free_shipping: bool(r.free_shipping),
        created_at: r.created_at ? str(r.created_at) : null,
    }
}

function toProductDetail(r: Record<string, any>): ProductDetail {
    return {
        ...toProduct(r),
        description: str(r.description),
        warranty_info: str(r.warranty_info).trim() || null,
        delivery_info: str(r.delivery_info).trim() || null,
        installment_info: str(r.installment_info).trim() || null,
        whatsapp_order_enabled: bool(r.whatsapp_order_enabled),
        whatsapp_number: str(r.whatsapp_number).trim() || null,
        is_active: bool(r.is_active),
        updated_at: r.updated_at ? str(r.updated_at) : null,
    }
}

/**
 * All ACTIVE products (in stock and sold out), newest first (id DESC). One query per request.
 * Throws when D1 is unavailable (pages should show their error state, not an empty catalogue).
 */
export const getActiveProducts = cache(async (): Promise<Product[]> => {
    const d = await db()
    const { results } = await d.prepare(`SELECT ${LIST_COLUMNS} FROM products WHERE is_active = 1 ORDER BY id DESC`).all()
    return (results ?? []).map(toProduct)
})

/** In-stock active products, newest first. */
export async function getInStockProducts(): Promise<Product[]> {
    return (await getActiveProducts()).filter(p => p.in_stock)
}

/** Newest active products (in stock only unless `includeSoldOut`). */
export async function getNewestProducts(limit = 8, opts: { includeSoldOut?: boolean } = {}): Promise<Product[]> {
    const all = await getActiveProducts()
    return (opts.includeSoldOut ? all : all.filter(p => p.in_stock)).slice(0, limit)
}

const productBySlugCached = cache(async (slug: string, includeInactive: boolean): Promise<ProductDetail | null> => {
    let clean = slug || ''
    try { clean = decodeURIComponent(clean) } catch { /* keep raw */ }
    clean = clean.replace(/^\/+|\/+$/g, '')
    if (!clean) return null
    const d = await db()
    const row = await d
        .prepare(`SELECT * FROM products WHERE slug = ?${includeInactive ? '' : ' AND is_active = 1'} LIMIT 1`)
        .bind(clean)
        .first()
    return row ? toProductDetail(row) : null
})

/** Full product by slug. Active products only unless `includeInactive` (e.g. admin preview). */
export function getProductBySlug(slug: string, opts: { includeInactive?: boolean } = {}): Promise<ProductDetail | null> {
    return productBySlugCached(slug, !!opts.includeInactive)
}

const productByIdCached = cache(async (id: number, includeInactive: boolean): Promise<ProductDetail | null> => {
    if (!Number.isFinite(id) || id <= 0) return null
    const d = await db()
    const row = await d
        .prepare(`SELECT * FROM products WHERE id = ?${includeInactive ? '' : ' AND is_active = 1'} LIMIT 1`)
        .bind(id)
        .first()
    return row ? toProductDetail(row) : null
})

/** Full product by id. Active products only unless `includeInactive`. */
export function getProductById(id: number | string, opts: { includeInactive?: boolean } = {}): Promise<ProductDetail | null> {
    const n = typeof id === 'number' ? id : parseInt(String(id), 10)
    return productByIdCached(n, !!opts.includeInactive)
}

/**
 * "Benzer ürünler": in-stock products of the same category, most similar first (shared facets such
 * as connector / wattage / product type, then shared name words), padded with newest in-stock
 * products from other categories when the category is small. Never includes the product itself.
 */
export async function getRelatedProducts(product: Pick<Product, 'id' | 'name' | 'category'>, opts: { limit?: number } = {}): Promise<Product[]> {
    const limit = opts.limit ?? 8
    const all = await getInStockProducts()
    const cat = foldTr(product.category)
    const facetsOf = (name: string) => {
        const n = normalizeText(name)
        return new Set(FACETS.filter(f => f.test(n)).map(f => f.key))
    }
    const wordsOf = (name: string) => new Set(normalizeText(name).split(' ').filter(w => w.length >= 3 && w !== 'onopo'))
    const myFacets = facetsOf(product.name)
    const myWords = wordsOf(product.name)
    const scored = all
        .filter(p => p.id !== product.id)
        .map(p => {
            let score = foldTr(p.category) === cat ? 100 : 0
            for (const f of facetsOf(p.name)) if (myFacets.has(f)) score += 10
            for (const w of wordsOf(p.name)) if (myWords.has(w)) score += 1
            return { p, score }
        })
    scored.sort((a, b) => b.score - a.score || b.p.id - a.p.id)
    return scored.slice(0, limit).map(s => s.p)
}

// ---------------------------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------------------------

/** Listing URL for a category: its /kategori/<slug>/ page (legacy ?category=<name> links redirect there). */
export function categoryHref(category: { name: string; slug?: string }): string {
    return category.slug ? categoryPath(category.slug) : `/products/?category=${encodeURIComponent(category.name)}`
}

/** Same matching rule as the legacy /api/categories count: product.category equals the name OR the slug. */
function inCategory(p: Product, c: { name: string; slug: string }): boolean {
    const pc = foldTr(p.category).trim()
    return pc !== '' && (pc === foldTr(c.name).trim() || pc === foldTr(c.slug).trim())
}

const categoriesCached = cache(async (withCounts: boolean, hideEmpty: boolean): Promise<Category[]> => {
    const rows = (await loadBaseData()).categoryRows
    let products: Product[] = []
    if (withCounts) {
        try {
            products = await getActiveProducts()
        } catch (err) {
            console.error('[catalog] products unavailable for category counts:', err)
        }
    }
    const list: Category[] = rows.map(c => {
        const inCat = withCounts ? products.filter(p => inCategory(p, c)) : []
        return {
            ...c,
            product_count: inCat.length,
            in_stock_count: inCat.filter(p => p.in_stock).length,
            href: categoryHref(c),
        }
    })
    list.sort((a, b) => (foldTr(a.name) < foldTr(b.name) ? -1 : foldTr(a.name) > foldTr(b.name) ? 1 : 0))
    return hideEmpty ? list.filter(c => c.product_count > 0) : list
})

/**
 * Categories (Admin › Kategoriler), sorted by Turkish-folded name.
 * withCounts (default true): fill product_count / in_stock_count from the active products, using the
 *   same rule as listings (product.category equals the category name or slug, Turkish case-folded).
 * hideEmpty: drop categories whose listing would be empty (product_count === 0). Implies counts.
 */
export function getCategories(opts: { withCounts?: boolean; hideEmpty?: boolean } = {}): Promise<Category[]> {
    const hideEmpty = opts.hideEmpty === true
    return categoriesCached(opts.withCounts !== false || hideEmpty, hideEmpty)
}

/** Find a category by slug or by name (Turkish-folded, case-insensitive). */
export async function findCategory(slugOrName: string): Promise<Category | null> {
    const key = foldTr(slugOrName).trim()
    if (!key) return null
    const cats = await getCategories({ withCounts: true })
    return cats.find(c => foldTr(c.slug) === key) ?? cats.find(c => foldTr(c.name).trim() === key) ?? null
}

// ---------------------------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------------------------

function normalizeSort(sort: unknown): ProductSort {
    return PRODUCT_SORTS.includes(sort as ProductSort) ? (sort as ProductSort) : 'recommended'
}

/**
 * Filter, search, sort, count and paginate over the FULL active catalogue (never just one page).
 * Ordering: in-stock products always come before sold-out ones; inside each group the chosen sort
 * applies ('recommended' = search relevance when q is given, otherwise newest).
 */
export async function listProducts(params: ListProductsParams = {}): Promise<ListProductsResult> {
    const settings = await getSiteSettings()
    const all = await getActiveProducts()
    const sort = normalizeSort(params.sort)
    const pageSize = Math.min(200, Math.max(1, Math.trunc(num(params.pageSize, settings.products_per_page)) || settings.products_per_page))
    const requestedPage = Math.max(1, Math.trunc(num(params.page, 1)) || 1)
    const query = (params.q ?? '').toString().trim()
    const prepared: PreparedQuery | null = query ? prepareQuery(query) : null
    const facetKeys = sanitizeFacetKeys(params.facets ?? [])

    // Category
    let category: Category | null = null
    let categoryFilter: { name: string; slug: string } | null = null
    const catInput = (params.categorySlug ?? params.categoryName ?? '').toString().trim()
    if (catInput) {
        category = await findCategory(catInput)
        categoryFilter = category ?? { name: catInput, slug: catInput }
    }

    // Base filters (everything except facets and price)
    const scores = new Map<number, number>()
    let base = all
    if (categoryFilter) base = base.filter(p => inCategory(p, categoryFilter!))
    if (params.inStockOnly) base = base.filter(p => p.in_stock)
    if (params.onlyDiscounted) base = base.filter(p => p.discount_percent > 0)
    if (prepared) {
        if (prepared.tokens.length === 0) base = []
        else {
            base = base.filter(p => {
                const s = scoreSearch(p, prepared)
                if (s > 0) scores.set(p.id, s)
                return s > 0
            })
        }
    }

    // Price filter (display price)
    const priceRange = base.length
        ? base.reduce((r, p) => ({ min: Math.min(r.min, p.display_price), max: Math.max(r.max, p.display_price) }), { min: Infinity, max: 0 })
        : null
    const minPrice = params.minPrice != null && Number.isFinite(Number(params.minPrice)) ? Number(params.minPrice) : null
    const maxPrice = params.maxPrice != null && Number.isFinite(Number(params.maxPrice)) ? Number(params.maxPrice) : null
    const priced = base.filter(p => (minPrice == null || p.display_price >= minPrice) && (maxPrice == null || p.display_price <= maxPrice))

    // Facets (counts = results if that facet were added)
    const facetMatch = new Map<string, Set<number>>()
    for (const f of FACETS) {
        facetMatch.set(f.key, new Set(priced.filter(p => f.test(normalizeText(p.name))).map(p => p.id)))
    }
    const matchesSelected = (p: Product) => facetKeys.every(k => facetMatch.get(k)!.has(p.id))
    const filtered = priced.filter(matchesSelected)
    const facets: FacetCount[] = FACETS.map(f => ({
        key: f.key,
        label: f.label,
        count: filtered.filter(p => facetMatch.get(f.key)!.has(p.id)).length,
        selected: facetKeys.includes(f.key),
    }))

    // Sort (stable; base order is id DESC)
    const sorted = [...filtered]
    const bySort: Record<ProductSort, (a: Product, b: Product) => number> = {
        // With a query: relevance, then the same tie rule as the instant-search dropdown
        recommended: prepared && prepared.tokens.length
            ? (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || compareSearchTies(a, b)
            : (a, b) => b.id - a.id,
        newest: (a, b) => b.id - a.id,
        price_asc: (a, b) => a.display_price - b.display_price || b.id - a.id,
        price_desc: (a, b) => b.display_price - a.display_price || b.id - a.id,
        discount: (a, b) => b.discount_percent - a.discount_percent || b.id - a.id,
    }
    sorted.sort((a, b) => Number(b.in_stock) - Number(a.in_stock) || bySort[sort](a, b))

    const total = sorted.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const page = requestedPage
    const start = (page - 1) * pageSize

    return {
        items: sorted.slice(start, start + pageSize),
        total,
        inStockTotal: sorted.filter(p => p.in_stock).length,
        page,
        pageSize,
        totalPages,
        sort,
        category,
        categoryNotFound: !!catInput && !category && base.length === 0 && !prepared,
        query,
        queryHasNoTokens: !!prepared && prepared.tokens.length === 0,
        facets,
        priceRange: priceRange && Number.isFinite(priceRange.min) ? priceRange : null,
    }
}

// ---------------------------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------------------------

/** Active hero slides (Admin › Ana Sayfa › Hero), display order, max 5 (same as /api/hero). */
export const getHeroSlides = cache(async (): Promise<HeroSlide[]> => {
    try {
        const d = await db()
        const { results } = await d.prepare('SELECT * FROM hero_slides WHERE is_active = 1 ORDER BY display_order ASC LIMIT 5').all()
        return (results ?? []).map((r: Record<string, any>) => ({
            id: num(r.id),
            title: str(r.title),
            subtitle: str(r.subtitle),
            button_text: str(r.button_text),
            button_link: str(r.button_link),
            image_url: str(r.image_url),
            display_order: num(r.display_order),
        }))
    } catch (err) {
        console.error('[catalog] hero slides unavailable:', err)
        return []
    }
})

/**
 * Active homepage sections (Admin › Ana Sayfa) in display order, with their data resolved on the
 * server. Products come from one pool (in-stock active products, newest first, max 200):
 *   selection_type 'category' + category → products whose category equals it (case-insensitive), pool order
 *   selection_type 'manual' + product_ids → those products in the admin's order
 *   selection_type 'most_viewed'          → most product-page views of the last 30 days (lib/analytics),
 *                                           filled up with the newest products when there is too little data
 *   'newest' / 'all' / anything else     → the whole pool (newest first)
 * then config.limit || 8. The order is stable: "products" sections used to be shuffled on every render,
 * which made "Öne Çıkan Ürünler" look different on each visit; now only an explicit config.order 'random'
 * (Admin › Ana Sayfa: "Sırayı her ziyarette karıştır") shuffles.
 */
export const getHomepageSections = cache(async (): Promise<HomeSection[]> => {
    const d = await db()
    const { results } = await d.prepare('SELECT * FROM homepage_sections WHERE is_active = 1 ORDER BY display_order ASC').all()
    const rows = (results ?? []) as Record<string, any>[]
    const sections: HomeSection[] = rows.map(r => {
        const cfg = parseJson<unknown>(r.config, {})
        return {
            id: num(r.id),
            type: str(r.type),
            title: str(r.title),
            display_order: num(r.display_order),
            config: cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? (cfg as Record<string, any>) : {},
        }
    })

    const needsProducts = sections.some(s => s.type === 'products' || s.type === 'new_products')
    const pool = needsProducts ? (await getInStockProducts()).slice(0, 200) : []

    // Product views of the last 30 days, read once and only when a section asks for them
    let views: Promise<Map<number, number>> | null = null
    const recentViews = () => (views ??= recentProductViews(d as unknown as AnalyticsDb, 30))

    for (const s of sections) {
        const cfg = s.config
        if (s.type === 'products' || s.type === 'new_products') {
            const limit = num(cfg.limit) || 8
            const manual = cfg.selection_type === 'manual' && Array.isArray(cfg.product_ids) && cfg.product_ids.length > 0
            let list = pool
            if (cfg.selection_type === 'category' && cfg.category) {
                const want = String(cfg.category).toLowerCase()
                list = list.filter(p => p.category && p.category.toLowerCase() === want)
            } else if (cfg.selection_type === 'most_viewed') {
                list = rankMostViewed(pool, await recentViews(), limit)
            }
            // 'most_viewed' is a ranking: a leftover "karıştır" choice from another selection never shuffles it
            list = orderSectionProducts(list, manual ? cfg.product_ids : undefined, cfg.order === 'random' && cfg.selection_type !== 'most_viewed')
            s.products = list.slice(0, limit)
            const viewAllCategory = cfg.selection_type === 'category' && cfg.category ? await findCategory(String(cfg.category)) : null
            s.viewAllHref = viewAllCategory
                ? categoryHref(viewAllCategory)
                : cfg.selection_type === 'category' && cfg.category ? categoryHref({ name: String(cfg.category) }) : '/products/'
        } else if (s.type === 'hero') {
            s.slides = await getHeroSlides()
        } else if (s.type === 'categories') {
            s.categories = await getCategories({ withCounts: true, hideEmpty: true })
        }
    }
    return sections
})

// ---------------------------------------------------------------------------------------------
// Layout bundle
// ---------------------------------------------------------------------------------------------

/** Everything the store chrome (header, footer, nav, cart) needs; serialisable for client props. */
export interface StorefrontData {
    settings: PublicSiteSettings
    shipping: ShippingSettings
    maxInstallments: number | null
    categories: Category[]
    menus: MenuItem[]
}

/** Data for the root layout. Never throws (falls back to defaults so the shell always renders). */
export const getStorefrontData = cache(async (): Promise<StorefrontData> => {
    const [settings, shipping, maxInstallments, categories, menus] = await Promise.all([
        getSiteSettings(),
        getShippingSettings(),
        getMaxInstallments().catch(() => null),
        getCategories({ withCounts: true, hideEmpty: true }).catch(() => [] as Category[]),
        getMenus().catch(() => [] as MenuItem[]),
    ])
    return { settings, shipping, maxInstallments, categories, menus }
})
