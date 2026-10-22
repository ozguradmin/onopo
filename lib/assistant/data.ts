/**
 * Onopo Asistan: live knowledge from D1 and the runTurn dependencies (server only).
 *
 * Why a per-isolate memo: the model gets the whole active catalogue in its system message, and that
 * message must be byte-identical between turns so the prompt prefix stays cached. So the Knowledge object
 * (rows, ratings, facts, links, system message) is built once per version and reused. One cheap query,
 * at most every 10 s per isolate, reads the version: cache_version (admin saves and the price cron bump
 * it) + the active product count + MAX(updated_at). A new, removed or re-priced product therefore reaches
 * the assistant within 10 s. The same round trip reads the assistant settings (kill switch, maintenance,
 * budget, shipping days, campaigns, WhatsApp numbers); a change there also rebuilds the knowledge, and so
 * does a new or changed product facts line (ai_product_facts: its row count and newest created_at).
 */
import 'server-only'
import { getCategories, getMaxInstallments, getShippingSettings } from '@/lib/catalog'
import { getReviewStatsMapSafe } from '@/lib/reviews'
import { getSiteSeo } from '@/lib/seo-server'
import { getCmsPageLinks } from '@/lib/cms-pages'
import { SESSION_HINT_COOKIE } from '@/lib/session-hint'
import { toCatalogRow } from './catalog-block'
import { DEFAULT_FACTS, normalizeCutoff, type StoreFacts } from './facts'
import { budgetExceeded, parseBudgetUsd, recordExtraCost, type D1Lite } from './limits'
import { decideFacts, ensureFactsTable, loadStoredFacts, refreshFacts, type FactsProduct, type StaleItem } from './product-facts'
import { pickStoreWhatsapp, type ProductDetailRow } from './tools'
import { buildKnowledge, type Knowledge, type TurnDeps } from './turn'

/** Code defaults for the model ids (wrangler.toml [vars] override them). */
export const DEFAULT_MODELS = {
    chat: '@cf/deepseek-ai/deepseek-v4.1-flash-1017',
    router: '@cf/cloudflare/clef-flash',
    fallback: '@cf/zai-org/glm-4.7-flash',
} as const

/** site_settings keys the assistant reads (admin-only ai_* keys included: this runs on the server). */
export const ASSISTANT_SETTING_KEYS = [
    'ai_assistant_enabled', 'maintenance_mode', 'ai_daily_budget_usd', 'ai_ship_days', 'ai_ship_cutoff',
    'ai_support_hours', 'ai_campaigns', 'ai_whatsapp_number', 'whatsapp_number', 'footer_phone',
] as const
type SettingKey = (typeof ASSISTANT_SETTING_KEYS)[number]
export type AssistantSettings = Partial<Record<SettingKey, string>>

const MEMO_MS = 10_000

interface VersionState {
    at: number
    version: string
    /** version + the settings that shape the knowledge: a change of either rebuilds it */
    key: string
    settings: AssistantSettings
}

let versionMemo: VersionState | null = null
let versionInflight: Promise<VersionState> | null = null
let knowledgeMemo: { key: string; k: Knowledge } | null = null
let knowledgeInflight: { key: string; p: Promise<Knowledge> } | null = null

const bool = (v: string | undefined) => v === 'true' || v === '1'

/** Settings that change the knowledge (facts, campaigns, WhatsApp number); the kill switch does not. */
function knowledgeSettings(s: AssistantSettings): string {
    return JSON.stringify([s.ai_ship_days, s.ai_ship_cutoff, s.ai_support_hours, s.ai_campaigns, s.ai_whatsapp_number, s.whatsapp_number, s.footer_phone])
}

async function readVersion(db: D1Database): Promise<VersionState> {
    const placeholders = ASSISTANT_SETTING_KEYS.map(() => '?').join(', ')
    const verStmt = db.prepare("SELECT (SELECT value FROM site_settings WHERE key = 'cache_version') AS v, COUNT(*) AS n, MAX(updated_at) AS u FROM products WHERE is_active = 1")
    const setStmt = db.prepare(`SELECT key, value FROM site_settings WHERE key IN (${placeholders})`).bind(...ASSISTANT_SETTING_KEYS)
    let ver: D1Result
    let set: D1Result
    let factsVersion = '-'
    try {
        await ensureFactsTable(db as unknown as D1Lite)
        const [a, b, c] = await db.batch([verStmt, setStmt, db.prepare('SELECT COUNT(*) AS n, MAX(created_at) AS u FROM ai_product_facts')])
        ver = a
        set = b
        const f = (c.results?.[0] ?? {}) as { n?: unknown; u?: unknown }
        factsVersion = `${f.n ?? 0}@${f.u ?? ''}`
    } catch {
        // No facts table (yet): the catalogue still works, with the deterministic facts
        const [a, b] = await db.batch([verStmt, setStmt])
        ver = a
        set = b
    }
    const v = (ver.results?.[0] ?? {}) as { v?: unknown; n?: unknown; u?: unknown }
    const settings: AssistantSettings = {}
    for (const r of (set.results ?? []) as { key: string; value: unknown }[]) {
        if ((ASSISTANT_SETTING_KEYS as readonly string[]).includes(r.key)) settings[r.key as SettingKey] = r.value == null ? '' : String(r.value)
    }
    const version = `${v.v ?? '0'}:${v.n ?? 0}:${v.u ?? ''}`
    return { at: Date.now(), version, key: `${version}|${factsVersion}|${knowledgeSettings(settings)}`, settings }
}

/** Version + settings, re-read at most every 10 s per isolate (one batch of two small queries). */
export async function getVersionState(db: D1Database): Promise<VersionState> {
    if (versionMemo && Date.now() - versionMemo.at < MEMO_MS) return versionMemo
    if (!versionInflight) {
        versionInflight = readVersion(db)
            .then(s => (versionMemo = s))
            .finally(() => { versionInflight = null })
    }
    return versionInflight
}

/** The assistant settings (memo 10 s). */
export async function getAssistantSettings(db: D1Database): Promise<AssistantSettings> {
    return (await getVersionState(db)).settings
}

export function isAssistantEnabled(s: AssistantSettings): boolean {
    return bool(s.ai_assistant_enabled)
}

export function isMaintenance(s: AssistantSettings): boolean {
    return bool(s.maintenance_mode)
}

const PRODUCT_SQL = `SELECT p.id, p.name, p.slug, p.price, p.original_price, p.category, p.stock, p.images, p.product_code,
       p.free_shipping, p.whatsapp_order_enabled, p.whatsapp_number, p.updated_at, p.description,
       EXISTS (SELECT 1 FROM product_variations v WHERE v.product_id = p.id) AS has_variations
FROM products p WHERE p.is_active = 1 ORDER BY p.id`

const PRODUCT_SQL_NO_VARIATIONS = `SELECT p.id, p.name, p.slug, p.price, p.original_price, p.category, p.stock, p.images, p.product_code,
       p.free_shipping, p.whatsapp_order_enabled, p.whatsapp_number, p.updated_at, p.description, 0 AS has_variations
FROM products p WHERE p.is_active = 1 ORDER BY p.id`

async function loadRows(db: D1Database) {
    let results: Record<string, unknown>[] | undefined
    try {
        results = (await db.prepare(PRODUCT_SQL).all<Record<string, unknown>>()).results
    } catch {
        // A fresh database without product_variations
        results = (await db.prepare(PRODUCT_SQL_NO_VARIATIONS).all<Record<string, unknown>>()).results
    }
    const rows = (results ?? []).map(toCatalogRow).filter(r => r.id > 0 && r.slug)
    const ids = new Set(rows.map(r => r.id))
    // Descriptions only feed the facts lines; they are not kept in the knowledge
    const products: FactsProduct[] = (results ?? [])
        .filter(r => ids.has(Math.trunc(Number(r.id))))
        .map(r => ({ id: Math.trunc(Number(r.id)), name: String(r.name ?? ''), description: r.description == null ? null : String(r.description) }))
    return { rows, products }
}

/** Store facts from the same sources the storefront uses, plus the admin's ai_* settings. */
async function loadFacts(s: AssistantSettings): Promise<StoreFacts> {
    const [shipping, maxInstallments, seo] = await Promise.all([getShippingSettings(), getMaxInstallments(), getSiteSeo()])
    return {
        freeThreshold: shipping.freeShippingThreshold,
        shippingCost: shipping.shippingCost,
        maxInstallments,
        returnDays: seo.returnPolicy?.days ?? DEFAULT_FACTS.returnDays,
        freeReturn: seo.returnPolicy?.freeReturn ?? false,
        shipDays: s.ai_ship_days === 'hafta-ici-cumartesi' ? 'hafta-ici-cumartesi' : 'hafta-ici',
        cutoff: normalizeCutoff(s.ai_ship_cutoff),
        supportHours: (s.ai_support_hours ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || null,
        campaigns: (s.ai_campaigns ?? '').trim().slice(0, 600) || 'Yok',
    }
}

async function buildFromD1(db: D1Database, state: VersionState): Promise<Knowledge> {
    const s = state.settings
    const [{ rows, products }, ratings, facts, categories, cmsPages, stored] = await Promise.all([
        loadRows(db),
        getReviewStatsMapSafe(),
        loadFacts(s),
        getCategories({ hideEmpty: true }).catch(() => []),
        getCmsPageLinks(),
        loadStoredFacts(db as unknown as D1Lite).catch(() => new Map()),
    ])
    const productFacts = await decideFacts(products, stored)
    staleFactsCount = productFacts.stale.length
    return buildKnowledge({
        version: state.version,
        rows,
        ratings,
        facts,
        categories: categories.map(c => ({ name: c.name, slug: c.slug, icon: c.icon || null, href: c.href, product_count: c.product_count })),
        cmsPages: cmsPages.map(p => ({ slug: p.slug, title: p.title, href: p.href })),
        storeWhatsapp: pickStoreWhatsapp([s.ai_whatsapp_number, s.whatsapp_number, s.footer_phone]),
        productFacts: productFacts.facts,
    })
}

// ---------------------------------------------------------------------------------------------
// Product facts upkeep (lib/assistant/product-facts.ts)
// ---------------------------------------------------------------------------------------------

/** Products without a fresh facts line in the last built knowledge (-1 = not built yet). */
let staleFactsCount = -1
let lastFactsRun = 0
let factsRunning = false
const FACTS_RUN_EVERY_MS = 2 * 60 * 1000
const FACTS_PER_BACKGROUND_RUN = 3

/** Active products whose facts line is missing or older than their description, read fresh (not memoised). */
export async function staleFactItems(db: D1Database): Promise<{ total: number; ready: number; stale: StaleItem[] }> {
    const { results } = await db.prepare('SELECT id, name, description FROM products WHERE is_active = 1 ORDER BY id').all<{ id: number; name: string; description: string | null }>()
    const products = (results ?? []).map(r => ({ id: Number(r.id), name: String(r.name ?? ''), description: r.description ?? null }))
    const decision = await decideFacts(products, await loadStoredFacts(db as unknown as D1Lite))
    return { total: products.length, ready: decision.ready, stale: decision.stale }
}

/** Fills up to the given number of stale facts lines with the chat model and counts the cost in today's budget row. */
export async function fillProductFacts(env: CloudflareEnv, limit: number, concurrency = 2) {
    const db = env.DB
    if (!env.AI) return { done: 0, failed: 0, remaining: -1, total: 0, ready: 0 }
    const before = await staleFactItems(db)
    const batch = before.stale.slice(0, Math.max(0, limit))
    const model = env.AI_CHAT_MODEL || DEFAULT_MODELS.chat
    const r = batch.length ? await refreshFacts(db as unknown as D1Lite, env.AI, model, batch, { concurrency }) : { done: 0, failed: 0, costMicroUsd: 0 }
    if (r.costMicroUsd > 0) await recordExtraCost(db as unknown as D1Lite, batch.length, r.costMicroUsd)
    return { done: r.done, failed: r.failed, remaining: before.stale.length - r.done, total: before.total, ready: before.ready + r.done }
}

/**
 * After a chat turn (ctx.waitUntil): a few stale facts lines, at most every 2 minutes per isolate, only
 * when the last knowledge build found some and today's budget is not used up. Never throws.
 */
export async function refreshFactsInBackground(env: CloudflareEnv, settings: AssistantSettings): Promise<void> {
    if (factsRunning || staleFactsCount === 0 || Date.now() - lastFactsRun < FACTS_RUN_EVERY_MS) return
    factsRunning = true
    lastFactsRun = Date.now()
    try {
        if (await budgetExceeded(env.DB as unknown as D1Lite, new Date(), parseBudgetUsd(settings.ai_daily_budget_usd))) return
        const r = await fillProductFacts(env, FACTS_PER_BACKGROUND_RUN)
        if (r.remaining >= 0) staleFactsCount = r.remaining
        console.log(`ai_facts done=${r.done} failed=${r.failed} remaining=${r.remaining}`)
    } catch (err) {
        console.error('ai_facts_failed', err instanceof Error ? err.name : 'error')
    } finally {
        factsRunning = false
    }
}

/** The knowledge for the current version (rebuilt when the version or the relevant settings change). */
export async function loadKnowledge(db: D1Database): Promise<Knowledge> {
    const state = await getVersionState(db)
    if (knowledgeMemo?.key === state.key) return knowledgeMemo.k
    if (knowledgeInflight?.key !== state.key) {
        const key = state.key
        const p = buildFromD1(db, state).then(k => {
            knowledgeMemo = { key, k }
            return k
        })
        knowledgeInflight = { key, p }
        p.catch(() => {}).finally(() => {
            if (knowledgeInflight?.key === key) knowledgeInflight = null
        })
    }
    try {
        return await knowledgeInflight!.p
    } catch (err) {
        // D1 hiccup during a rebuild: an older knowledge is better than no answer
        if (knowledgeMemo) return knowledgeMemo.k
        throw err
    }
}

/** One active product with the texts get_product needs (no price, stock or old price columns). */
export async function getProductDetail(db: D1Database, id: number): Promise<ProductDetailRow | null> {
    const p = await db
        .prepare('SELECT id, name, description, warranty_info, delivery_info, installment_info FROM products WHERE id = ? AND is_active = 1')
        .bind(id)
        .first<{ id: number; name: string; description: string | null; warranty_info: string | null; delivery_info: string | null; installment_info: string | null }>()
    if (!p) return null
    let variations: { name: string; value: string }[] = []
    try {
        const { results } = await db
            .prepare('SELECT name, value FROM product_variations WHERE product_id = ? ORDER BY name, value')
            .bind(id)
            .all<{ name: string; value: string }>()
        variations = (results ?? []).map(v => ({ name: String(v.name ?? ''), value: String(v.value ?? '') }))
    } catch {
        // No product_variations table
    }
    return {
        id: Number(p.id),
        name: String(p.name ?? ''),
        description: p.description ?? null,
        warranty_info: p.warranty_info ?? null,
        delivery_info: p.delivery_info ?? null,
        installment_info: p.installment_info ?? null,
        variations,
    }
}

/** The readable session-hint cookie (worker.ts keeps it in sync with auth_token): only a hint, never access. */
export function hasSessionHintCookie(req: Request): boolean {
    const cookie = req.headers.get('cookie') ?? ''
    return new RegExp(`(?:^|;\\s*)${SESSION_HINT_COOKIE}=1(?:;|$)`).test(cookie)
}

/** Client IP for limits; IPv6 is reduced to its /64 by ipBucket. */
export function clientIp(req: Request): string {
    return (req.headers.get('cf-connecting-ip') ?? '').trim() || 'unknown'
}

/** runTurn's dependencies from the Worker env (SPEC 8.1). */
export function makeTurnDeps(env: CloudflareEnv, req: Request, settings: AssistantSettings): TurnDeps {
    const db = env.DB
    const ai = env.AI
    if (!ai) throw new Error('ai_binding_missing')
    const fallback = env.AI_FALLBACK_MODEL ?? DEFAULT_MODELS.fallback
    return {
        ai,
        models: {
            chat: env.AI_CHAT_MODEL || DEFAULT_MODELS.chat,
            router: env.AI_ROUTER_MODEL || DEFAULT_MODELS.router,
            // An explicitly empty AI_FALLBACK_MODEL disables the fallback (canned busy only)
            fallback: fallback.trim() ? fallback.trim() : null,
        },
        gatewayId: env.AI_GATEWAY_ID?.trim() || null,
        now: () => new Date(),
        loadKnowledge: () => loadKnowledge(db),
        getProductDetail: id => getProductDetail(db, id),
        takeModelSlot: async () => {
            if (!env.CHAT_RL_MODEL) return true
            try {
                return (await env.CHAT_RL_MODEL.limit({ key: 'deepseek' })).success
            } catch {
                return true
            }
        },
        budgetExceeded: () => budgetExceeded(db as unknown as D1Lite, new Date(), parseBudgetUsd(settings.ai_daily_budget_usd)),
        loggedIn: hasSessionHintCookie(req),
    }
}
