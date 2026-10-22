/**
 * Onopo Asistan: the model's tools and their executors (pure; D1 access is injected).
 *
 * Why: the model never writes a price, a link, a card or a phone number. It only passes product ids,
 * link keys and reasons; the executors build every card from the knowledge rows (read from D1 for this
 * version) and validate every argument themselves. Data tools (search_products, get_product) return
 * text the model reads next; UI tools draw a card and end the turn.
 * TOOLS is part of the cached prompt prefix: keep it byte-identical (SPEC section 4, do not reorder).
 */
import type { AssistantEvent, CardProduct, HandoffReason, LinkItem, StepId } from './contract'
import { buildWhatsappMessage, formatPriceTR, maskPII } from './contract'
import type { CatalogRow } from './catalog-block'
import { catalogLine, isGroupKey, priceText, rowTags, searchCatalog, toCardProduct } from './catalog-block'
import { INFO_TOPICS, infoRows, amountText } from './facts'
import { safeJson } from './sse-parser'
import type { Knowledge } from './turn'
import { specChips } from '../search'
import { cleanDescriptionText } from '../seo'
import { infoText, parseDescription } from '../../components/pdp/description-parser'

function deepFreeze<T>(v: T): T {
    if (v && typeof v === 'object') {
        for (const k of Object.keys(v as object)) deepFreeze((v as Record<string, unknown>)[k])
        Object.freeze(v)
    }
    return v
}

export const TOOLS = deepFreeze([
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": "Satıştaki ürünlerde arama yapar. Katalog ve aday_urunler yetmediğinde ya da fiyat/grup filtresi gerektiğinde kullan. Sonuç: id, ad, fiyat, grup, etiketler.",
            "parameters": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                    "query"
                ],
                "properties": {
                    "query": {
                        "type": "string",
                        "maxLength": 100,
                        "description": "Türkçe arama metni, örn. 'iphone 15 type-c kablo'"
                    },
                    "group": {
                        "type": "string",
                        "enum": [
                            "sarj-aleti",
                            "arac-sarj",
                            "kablo",
                            "ekran-koruyucu-seramik",
                            "ekran-koruyucu-9d",
                            "ekran-koruyucu",
                            "kulaklik",
                            "powerbank",
                            "supurge",
                            "yazici",
                            "oyun",
                            "diger"
                        ]
                    },
                    "min_price": {
                        "type": "number",
                        "minimum": 0
                    },
                    "max_price": {
                        "type": "number",
                        "minimum": 0
                    },
                    "sort": {
                        "type": "string",
                        "enum": [
                            "relevance",
                            "price_asc",
                            "price_desc"
                        ]
                    },
                    "limit": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 8
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_product",
            "description": "Bir ürünün ayrıntıları: açıklama, özellikler, kutu içeriği, seçenekler, garanti, teslimat, taksit notu.",
            "parameters": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                    "id"
                ],
                "properties": {
                    "id": {
                        "type": "integer"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "show_products",
            "description": "Müşteriye 1-4 ürün kartı gösterir (görsel, güncel fiyat, İncele ve Sepete Ekle düğmesi). Ürün önerdiğinde mutlaka kullan. Önce kısa metnini yaz, sonra çağır.",
            "parameters": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                    "ids"
                ],
                "properties": {
                    "ids": {
                        "type": "array",
                        "items": {
                            "type": "integer"
                        },
                        "minItems": 1,
                        "maxItems": 4
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "show_comparison",
            "description": "2-3 ürünü yan yana karşılaştırma kartında gösterir.",
            "parameters": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                    "ids"
                ],
                "properties": {
                    "ids": {
                        "type": "array",
                        "items": {
                            "type": "integer"
                        },
                        "minItems": 2,
                        "maxItems": 3
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "show_category",
            "description": "Kategori ya da sayfa bağlantı kartı gösterir. Anahtarları yalnızca <baglantilar> listesinden seç.",
            "parameters": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                    "keys"
                ],
                "properties": {
                    "keys": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "maxLength": 60
                        },
                        "minItems": 1,
                        "maxItems": 3
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "store_info",
            "description": "Kargo, aynı gün kargo, ödeme, taksit, iade, garanti ya da destek bilgi kartı gösterir.",
            "parameters": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                    "topics"
                ],
                "properties": {
                    "topics": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": [
                                "shipping",
                                "cutoff",
                                "payment",
                                "installments",
                                "returns",
                                "warranty",
                                "contact"
                            ]
                        },
                        "minItems": 1,
                        "maxItems": 4
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "whatsapp_handoff",
            "description": "Mağaza ekibine hazır mesajla yazmak için WhatsApp kartı gösterir. Numara yazma; kart numarayı içerir.",
            "parameters": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                    "reason",
                    "summary"
                ],
                "properties": {
                    "reason": {
                        "type": "string",
                        "enum": [
                            "whatsapp_order",
                            "order_status",
                            "return",
                            "payment",
                            "bulk",
                            "compatibility",
                            "product_request",
                            "complaint",
                            "human",
                            "other"
                        ]
                    },
                    "summary": {
                        "type": "string",
                        "maxLength": 200,
                        "description": "Müşterinin isteği, 1-2 nötr cümle, kişisel veri ve fiyat olmadan"
                    },
                    "product_ids": {
                        "type": "array",
                        "items": {
                            "type": "integer"
                        },
                        "maxItems": 3
                    }
                }
            }
        }
    }
] as const)

export type ToolName = 'search_products' | 'get_product' | 'show_products' | 'show_comparison' | 'show_category' | 'store_info' | 'whatsapp_handoff'
export const DATA_TOOLS: ReadonlySet<string> = new Set(['search_products', 'get_product'])
export const TOOL_NAMES: ReadonlySet<string> = new Set(TOOLS.map(t => t.function.name))

/** The step a tool shows while it runs. */
export const TOOL_STEP: Record<ToolName, StepId> = {
    search_products: 'search',
    get_product: 'details',
    show_products: 'prices',
    show_comparison: 'compare',
    show_category: 'categories',
    store_info: 'store_info',
    whatsapp_handoff: 'whatsapp',
}

export function isKnownTool(name: string): name is ToolName {
    return TOOL_NAMES.has(name)
}

/** One product as get_product reads it from D1 (active products only). */
export interface ProductDetailRow {
    id: number
    name: string
    description: string | null
    warranty_info: string | null
    delivery_info: string | null
    installment_info: string | null
    /** product_variations rows: option name ("Renk") and value ("Siyah"). */
    variations: { name: string; value: string }[]
}

export type CardKind = 'products' | 'compare' | 'links' | 'store_info' | 'whatsapp'

/** Mutable per-turn state shared by the executors and the turn loop. */
export interface ToolState {
    lastSearch: { query: string; total: number } | null
    /** Card kinds already shown this turn (the first of each kind wins), in order. */
    shown: CardKind[]
    /** Products shown on product/compare cards, in order. */
    productIds: number[]
    /** First product group shown (for the follow-up chips). */
    productGroup: CatalogRow['group'] | null
    waVariant: 'full' | 'compact' | null
    handoff: HandoffReason | null
    pageProduct: CatalogRow | null
    maskedInput: string
    loggedIn: boolean
}

export function newToolState(init: { pageProduct: CatalogRow | null; maskedInput: string; loggedIn: boolean }): ToolState {
    return { lastSearch: null, shown: [], productIds: [], productGroup: null, waVariant: null, handoff: null, ...init }
}

export interface ToolContext {
    k: Knowledge
    getProductDetail: (id: number) => Promise<ProductDetailRow | null>
    state: ToolState
}

export interface ToolResult {
    /** Tool message content for the model. */
    forModel: string
    /** Card events for the client (already respecting "first of each kind wins"). */
    events: AssistantEvent[]
    /** Done steps to emit after the run (the active step is emitted by the caller before). */
    steps: Extract<AssistantEvent, { t: 'step' }>[]
    /** A data result: the loop may call the model again. */
    isData: boolean
    /** Products this result talks about (their catalogue lines become validator tool text). */
    productIds: number[]
}

const RESULT_MAX = 4000

/** `<urun_verisi>` + JSON + `</urun_verisi>`, at most 4,000 characters. */
export function wrapForModel(result: unknown): string {
    const json = JSON.stringify(result)
    const max = RESULT_MAX - '<urun_verisi></urun_verisi>'.length
    return `<urun_verisi>${json.length > max ? json.slice(0, max) : json}</urun_verisi>`
}

// ---------------------------------------------------------------------------------------------
// Argument helpers (the model's arguments are untrusted)
// ---------------------------------------------------------------------------------------------

function toInt(v: unknown): number | null {
    const x = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
    return Number.isFinite(x) ? Math.trunc(x) : null
}

function toNum(v: unknown): number | null {
    const x = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : NaN
    return Number.isFinite(x) && x >= 0 ? x : null
}

function idList(v: unknown, max: number): number[] {
    if (!Array.isArray(v)) {
        const one = toInt(v)
        return one && one > 0 ? [one] : []
    }
    const out: number[] = []
    for (const x of v) {
        const id = toInt(x)
        if (id && id > 0 && !out.includes(id)) out.push(id)
        if (out.length >= max) break
    }
    return out
}

function text(v: unknown, max: number): string {
    return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

// ---------------------------------------------------------------------------------------------
// WhatsApp card (section 4.2)
// ---------------------------------------------------------------------------------------------

/**
 * wa.me base ("https://wa.me/905xxxxxxxxx", no text) for a Turkish MOBILE number written any common way
 * ("0532 …", "+90 532 …", "0090…", "532…"), or null. WhatsApp needs a mobile line, so a landline (the
 * footer phone can be one) gives null and the card is simply not shown.
 */
export function waBaseOf(number: string | null | undefined): string | null {
    let d = (number ?? '').replace(/\D/g, '')
    if (d.startsWith('00')) d = d.slice(2)
    if (d.length === 12 && d.startsWith('90')) d = d.slice(2)
    else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
    return /^5\d{9}$/.test(d) ? `https://wa.me/90${d}` : null
}

/**
 * The store's WhatsApp number (owner decision): the number entered on /admin/assistant
 * (ai_whatsapp_number), else site_settings.whatsapp_number, else site_settings.footer_phone; the first
 * one that is a usable mobile number wins. null = no WhatsApp cards.
 */
export function pickStoreWhatsapp(candidates: readonly (string | null | undefined)[]): string | null {
    for (const c of candidates) if (waBaseOf(c)) return (c ?? '').trim()
    return null
}

/** Summary for the prefilled message: masked, no URLs/e-mails/phone numbers, ≤ 160 characters. */
export function scrubSummary(s: string): string {
    return maskPII(s || '')
        .replace(/https?:\/\/\S+|www\.\S+|\b\S+\.(?:com|net|org|xyz|info|tr)\S*/gi, '')
        .replace(/\[(?:telefon|e-posta|tckn|kart|iban)\]/g, '')
        .replace(/\+?\d[\d\s().-]{6,}\d/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160)
}

export interface WhatsappCardInput {
    reason: HandoffReason
    summary: string
    productIds: number[]
    variant: 'full' | 'compact'
}

/** Builds the card event, or null when there is no usable WhatsApp number. */
export function buildWhatsappCard(k: Knowledge, state: Pick<ToolState, 'pageProduct' | 'maskedInput'>, input: WhatsappCardInput): Extract<AssistantEvent, { t: 'whatsapp' }> | null {
    const valid = input.productIds.filter(id => k.byId.has(id)).slice(0, 3)
    let product: CatalogRow | null = valid.length ? k.byId.get(valid[0]) ?? null : null
    if (!product && state.pageProduct && (input.reason === 'whatsapp_order' || input.reason === 'compatibility')) product = state.pageProduct
    // A product with its own WhatsApp ordering number uses it (when it is a usable mobile number)
    const waBase = (product && product.whatsappOrder ? waBaseOf(product.whatsappNumber) : null) ?? waBaseOf(k.storeWhatsapp)
    if (!waBase) return null
    const summary = scrubSummary(input.summary) || scrubSummary(state.maskedInput)
    const message = buildWhatsappMessage(
        input.reason,
        summary,
        product ? { name: product.displayName, code: product.code, href: product.href, displayPrice: product.displayPrice } : null,
    )
    return {
        t: 'whatsapp',
        variant: input.variant,
        reason: input.reason,
        message,
        waBase,
        productIds: valid.length ? valid : product ? [product.id] : [],
    }
}

const ORDERS_LINK: LinkItem = { title: 'Siparişlerim', href: '/orders/', count: null, fromPrice: null, icon: null }

// ---------------------------------------------------------------------------------------------
// Executors
// ---------------------------------------------------------------------------------------------

const step = (id: StepId, n?: number): Extract<AssistantEvent, { t: 'step' }> => (n == null ? { t: 'step', id, state: 'done' } : { t: 'step', id, state: 'done', n })

function cards(ctx: ToolContext, ids: number[]): CardProduct[] {
    return ids.map(id => ctx.k.byId.get(id)).filter((r): r is CatalogRow => !!r).map(r => toCardProduct(r, ctx.k.ratings))
}

function markShown(state: ToolState, kind: CardKind): boolean {
    if (state.shown.includes(kind)) return false
    state.shown.push(kind)
    return true
}

function addShownProducts(state: ToolState, rows: CatalogRow[]) {
    for (const r of rows) if (!state.productIds.includes(r.id)) state.productIds.push(r.id)
    if (!state.productGroup && rows[0]) state.productGroup = rows[0].group
}

const SORTS = new Set(['relevance', 'price_asc', 'price_desc'])

async function searchProducts(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const query = text(args.query, 100)
    const group = isGroupKey(args.group) ? args.group : null
    const limit = Math.max(1, Math.min(8, toInt(args.limit) ?? 6))
    const sort = typeof args.sort === 'string' && SORTS.has(args.sort) ? (args.sort as 'relevance' | 'price_asc' | 'price_desc') : 'relevance'
    const { rows, total } = searchCatalog(ctx.k.rows, query, {
        group,
        minPrice: toNum(args.min_price),
        maxPrice: toNum(args.max_price),
        sort,
        limit,
    })
    ctx.state.lastSearch = { query, total }
    const result = {
        toplam: total,
        sonuclar: rows.map(r => ({ id: r.id, ad: r.displayName, fiyat: `${priceText(r.displayPrice)} TL`, grup: r.group, etiketler: rowTags(r) })),
    }
    return { forModel: wrapForModel(result), events: [], steps: [step('search', total)], isData: true, productIds: rows.map(r => r.id) }
}

async function getProduct(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const id = toInt(args.id)
    const row = id ? ctx.k.byId.get(id) : undefined
    const detail = row ? await ctx.getProductDetail(row.id).catch(() => null) : null
    if (!row || !detail) {
        return { forModel: wrapForModel({ hata: 'urun_bulunamadi' }), events: [], steps: [step('details')], isData: true, productIds: [] }
    }
    const options = new Map<string, string[]>()
    for (const v of detail.variations) {
        const name = text(v.name, 40)
        const value = text(v.value, 60)
        if (!name || !value) continue
        const list = options.get(name) ?? []
        if (!list.includes(value)) list.push(value)
        options.set(name, list)
    }
    const specs = parseDescription(detail.description ?? '', row.name).specs
        .filter(s => !/desi|stok/i.test(s.label))
        .slice(0, 12)
        .map(s => `${s.label}: ${s.value}`)
    const info = (html: string | null) => infoText(html).slice(0, 300) || null
    const result = {
        id: row.id,
        ad: row.displayName,
        fiyat: `${priceText(row.displayPrice)} TL`,
        kod: row.code,
        grup: row.group,
        stok: row.inStock ? 'var' : 'tükendi',
        ucretsiz_kargo: row.freeShipping,
        secenekler: options.size ? [...options].map(([ad, degerler]) => ({ ad, degerler })) : null,
        // Descriptions sometimes carry the stock line of the import template ("Stok: 25 adet"): never a count
        aciklama: cleanDescriptionText(detail.description ?? '').replace(/\bstok(?:\s*adedi)?\s*:?\s*\d+(?:\s*adet)?/gi, '').replace(/\s{2,}/g, ' ').trim().slice(0, 1200),
        ozellikler: specs,
        garanti: info(detail.warranty_info),
        teslimat: info(detail.delivery_info),
        taksit_notu: info(detail.installment_info),
        whatsapp_siparis: row.whatsappOrder,
        // The same line as in <urun_bilgileri> (box contents, power, real fast charging, …)
        bilgi: ctx.k.productFacts?.get(row.id) ?? null,
    }
    let forModel = wrapForModel(result)
    // Too long: shorten the description first, so the JSON stays whole
    if (forModel.length >= RESULT_MAX) {
        const over = forModel.length - RESULT_MAX + 40
        result.aciklama = result.aciklama.slice(0, Math.max(0, result.aciklama.length - over)) + '…'
        forModel = wrapForModel(result)
    }
    return { forModel, events: [], steps: [step('details')], isData: true, productIds: [row.id] }
}

function showProducts(args: Record<string, unknown>, ctx: ToolContext): ToolResult {
    const ids = idList(args.ids, 4).filter(id => ctx.k.byId.has(id))
    if (ids.length === 0) {
        return { forModel: wrapForModel({ hata: 'gecersiz_id' }), events: [], steps: [step('prices')], isData: true, productIds: [] }
    }
    const rows = ids.map(id => ctx.k.byId.get(id)!)
    const events: AssistantEvent[] = []
    if (markShown(ctx.state, 'products')) {
        addShownProducts(ctx.state, rows)
        const ls = ctx.state.lastSearch
        events.push({
            t: 'products',
            layout: rows.length === 1 ? 'single' : 'carousel',
            products: cards(ctx, ids),
            moreHref: ls && ls.query && ls.total > rows.length ? `/products/?q=${encodeURIComponent(ls.query)}` : null,
            total: ls ? ls.total : null,
        })
    }
    return { forModel: wrapForModel({ gosterildi: ids }), events, steps: [step('prices')], isData: false, productIds: ids }
}

function connectorOf(chips: string[]): string {
    return chips.find(c => c === 'Type-C' || c === 'Lightning' || c === 'Micro USB') ?? '—'
}

async function showComparison(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const ids = idList(args.ids, 3).filter(id => ctx.k.byId.has(id))
    if (ids.length < 2) {
        return { forModel: wrapForModel({ hata: 'gecersiz_id' }), events: [], steps: [step('compare', ids.length)], isData: true, productIds: [] }
    }
    const rows = ids.map(id => ctx.k.byId.get(id)!)
    const events: AssistantEvent[] = []
    if (markShown(ctx.state, 'compare')) {
        addShownProducts(ctx.state, rows)
        const details = await Promise.all(rows.map(r => ctx.getProductDetail(r.id).catch(() => null)))
        const chips = rows.map(r => specChips(r.name, 4))
        const warranty = details.map(d => {
            const t = infoText(d?.warranty_info ?? '')
            return t ? (t.length > 40 ? `${t.slice(0, 39).trimEnd()}…` : t) : '—'
        })
        const T = amountText(ctx.k.facts.freeThreshold)
        events.push({
            t: 'compare',
            products: cards(ctx, ids),
            rows: [
                { label: 'Fiyat', values: rows.map(r => formatPriceTR(r.displayPrice)) },
                { label: 'Güç', values: chips.map(c => c.find(x => /^\d+W$/.test(x)) ?? '—') },
                { label: 'Bağlantı', values: chips.map(connectorOf) },
                { label: 'Uzunluk', values: chips.map(c => c.find(x => / (m|cm)$/.test(x)) ?? '—') },
                { label: 'Kargo', values: rows.map(r => (r.freeShipping ? 'Ücretsiz' : `${T} TL üzeri ücretsiz`)) },
                { label: 'Garanti', values: warranty },
                { label: 'Stok', values: rows.map(r => (r.inStock ? 'Var' : 'Tükendi')) },
            ],
        })
    }
    return { forModel: wrapForModel({ gosterildi: ids }), events, steps: [step('compare', ids.length)], isData: false, productIds: ids }
}

function showCategory(args: Record<string, unknown>, ctx: ToolContext): ToolResult {
    const raw = Array.isArray(args.keys) ? args.keys : typeof args.keys === 'string' ? [args.keys] : []
    const keys: string[] = []
    for (const k of raw) {
        const key = text(k, 60)
        if (key && ctx.k.links.has(key) && !keys.includes(key)) keys.push(key)
        if (keys.length >= 3) break
    }
    if (keys.length === 0) {
        return { forModel: wrapForModel({ hata: 'gecersiz_anahtar' }), events: [], steps: [step('categories')], isData: true, productIds: [] }
    }
    const events: AssistantEvent[] = []
    if (markShown(ctx.state, 'links')) {
        events.push({
            t: 'links',
            items: keys.map(key => {
                const l = ctx.k.links.get(key)!
                return { title: l.title, href: l.href, count: l.count, fromPrice: l.fromPrice, icon: l.icon }
            }),
        })
    }
    return { forModel: wrapForModel({ gosterildi: keys }), events, steps: [step('categories')], isData: false, productIds: [] }
}

function storeInfo(args: Record<string, unknown>, ctx: ToolContext): ToolResult {
    const raw = Array.isArray(args.topics) ? args.topics : typeof args.topics === 'string' ? [args.topics] : []
    const topics = raw.filter((t): t is string => typeof t === 'string' && (INFO_TOPICS as readonly string[]).includes(t)).slice(0, 4)
    const rows = infoRows(ctx.k.facts, topics.length ? topics : ['shipping', 'cutoff'])
    const events: AssistantEvent[] = []
    if (markShown(ctx.state, 'store_info')) events.push({ t: 'store_info', rows, href: ctx.k.shippingHref })
    return { forModel: wrapForModel({ gosterildi: true }), events, steps: [step('store_info')], isData: false, productIds: [] }
}

const REASONS = new Set<HandoffReason>(['whatsapp_order', 'order_status', 'return', 'payment', 'bulk', 'compatibility', 'product_request', 'complaint', 'human', 'other'])

/** Emits the full WhatsApp card (plus "Siparişlerim" for a logged-in order question). Shared with the turn's server cards. */
export function whatsappEvents(ctx: Pick<ToolContext, 'k' | 'state'>, input: WhatsappCardInput): AssistantEvent[] | null {
    if (ctx.state.waVariant === 'full' || (input.variant === 'compact' && ctx.state.waVariant)) return []
    const card = buildWhatsappCard(ctx.k, ctx.state, input)
    if (!card) return null
    const events: AssistantEvent[] = []
    if (input.reason === 'order_status' && ctx.state.loggedIn && input.variant === 'full' && markShown(ctx.state, 'links')) {
        events.push({ t: 'links', items: [ORDERS_LINK] })
    }
    if (!ctx.state.shown.includes('whatsapp')) ctx.state.shown.push('whatsapp')
    ctx.state.waVariant = input.variant
    ctx.state.handoff = input.reason
    events.push(card)
    return events
}

function whatsappHandoff(args: Record<string, unknown>, ctx: ToolContext): ToolResult {
    const reason = typeof args.reason === 'string' && REASONS.has(args.reason as HandoffReason) ? (args.reason as HandoffReason) : 'other'
    const productIds = idList(args.product_ids, 3)
    const events = whatsappEvents(ctx, { reason, summary: text(args.summary, 200), productIds, variant: 'full' })
    if (events === null) {
        return { forModel: wrapForModel({ gosterildi: false, neden: 'numara_yok' }), events: [], steps: [step('whatsapp')], isData: false, productIds: [] }
    }
    return { forModel: wrapForModel({ gosterildi: true }), events, steps: [step('whatsapp')], isData: false, productIds: productIds.filter(id => ctx.k.byId.has(id)) }
}

/** Runs one tool. `rawArgs` is the model's JSON string or object; bad arguments give {"hata":"gecersiz_arguman"}. */
export async function runTool(name: ToolName, rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
    const args = safeJson(rawArgs)
    if (!args) {
        return { forModel: wrapForModel({ hata: 'gecersiz_arguman' }), events: [], steps: [step(TOOL_STEP[name])], isData: DATA_TOOLS.has(name), productIds: [] }
    }
    switch (name) {
        case 'search_products': return searchProducts(args, ctx)
        case 'get_product': return getProduct(args, ctx)
        case 'show_products': return showProducts(args, ctx)
        case 'show_comparison': return showComparison(args, ctx)
        case 'show_category': return showCategory(args, ctx)
        case 'store_info': return storeInfo(args, ctx)
        case 'whatsapp_handoff': return whatsappHandoff(args, ctx)
    }
}

/**
 * Catalogue lines of the products a tool result names, with their facts line (validator tool text: brand
 * words, prices, and the numbers of "2 yıl garanti" style facts the model may repeat).
 */
export function catalogLinesFor(k: Knowledge, ids: number[]): string {
    return ids
        .map(id => k.byId.get(id))
        .filter((r): r is CatalogRow => !!r)
        .map(r => {
            const facts = k.productFacts?.get(r.id)
            return facts ? `${catalogLine(r)} | bilgi: ${facts}` : catalogLine(r)
        })
        .join('\n')
}
