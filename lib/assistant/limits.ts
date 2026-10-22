/**
 * Onopo Asistan: daily limits, the global budget and content-free usage logging (D1).
 *
 * Why D1 and not KV: the counters are tiny, the shop already has D1, and one UPSERT … RETURNING gives an
 * exact per-IP daily count in a single round trip. Privacy: no chat text is ever written here (the masked
 * transcripts the owner chose to keep live in transcripts.ts).
 * IPs are stored only as an HMAC whose key includes the day, so a value cannot be linked across days, and
 * those rows are deleted after two days. ai_chat_events holds codes, counts and durations only.
 *
 * No `server-only` import on purpose: turn.ts (pure, unit-tested) uses the cost table from here. Every
 * D1 call takes the database as a parameter, so this file never imports the Cloudflare context.
 */
import type { UiEventBody } from './contract'
import { istanbulDay } from './facts'

/** The few D1 methods used here (a real D1Database satisfies it; tests pass a fake). */
export interface D1Lite {
    prepare(sql: string): D1StmtLite
    batch?(statements: D1StmtLite[]): Promise<unknown>
}
export interface D1StmtLite {
    bind(...values: unknown[]): D1StmtLite
    first<T = Record<string, unknown>>(): Promise<T | null>
    all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>
    run(): Promise<unknown>
}

// ---------------------------------------------------------------------------------------------
// Cost (USD per million tokens; micro-USD per token is the same number)
// ---------------------------------------------------------------------------------------------

interface ModelPrice { input: number; cached: number; output: number }

/** SPEC 8.5. Matched by model id substring; an unknown model is billed at the DeepSeek rates (the dearest). */
export const MODEL_PRICES: readonly { match: string; price: ModelPrice }[] = [
    { match: 'clef-flash', price: { input: 0.038, cached: 0.038, output: 0 } },
    { match: 'glm-4.7-flash', price: { input: 0.06, cached: 0.06, output: 0.4 } },
    { match: 'deepseek', price: { input: 0.3, cached: 0.006, output: 1.2 } },
]
const FALLBACK_PRICE: ModelPrice = { input: 0.3, cached: 0.006, output: 1.2 }

export interface TokenUse { inTokens: number; cachedTokens: number; outTokens: number }

/** Cost of one model call in micro-USD (rounded up, so the budget never under-counts). */
export function costMicroUsd(model: string, u: TokenUse): number {
    const p = MODEL_PRICES.find(m => model.includes(m.match))?.price ?? FALLBACK_PRICE
    const cached = Math.max(0, Math.min(u.cachedTokens || 0, u.inTokens || 0))
    const fresh = Math.max(0, (u.inTokens || 0) - cached)
    const cost = fresh * p.input + cached * p.cached + Math.max(0, u.outTokens || 0) * p.output
    return Math.ceil(cost)
}

// ---------------------------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------------------------

/** Same statements as schema.sql (section 11.3), so a database created before this feature works too. */
export const TABLE_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS ai_usage_daily (
    day TEXT NOT NULL,
    bucket TEXT NOT NULL,
    turns INTEGER NOT NULL DEFAULT 0,
    model_calls INTEGER NOT NULL DEFAULT 0,
    cost_micro_usd INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, bucket)
)`,
    `CREATE TABLE IF NOT EXISTS ai_chat_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    day TEXT NOT NULL,
    kind TEXT NOT NULL,
    conv_hash TEXT,
    turn INTEGER,
    mode TEXT,
    intent TEXT,
    flags TEXT,
    model TEXT,
    model_calls INTEGER,
    tools TEXT,
    products TEXT,
    handoff TEXT,
    in_tokens INTEGER,
    cached_tokens INTEGER,
    out_tokens INTEGER,
    cost_micro_usd INTEGER,
    first_text_ms INTEGER,
    total_ms INTEGER,
    outcome TEXT
)`,
    'CREATE INDEX IF NOT EXISTS idx_ai_chat_events_day ON ai_chat_events(day)',
]

let tablesReady: Promise<void> | null = null

/** Runs the CREATE … IF NOT EXISTS statements once per isolate (a failure is retried on the next call). */
export function ensureTables(db: D1Lite): Promise<void> {
    if (!tablesReady) {
        tablesReady = (async () => {
            for (const sql of TABLE_STATEMENTS) await db.prepare(sql).run()
        })().catch(err => {
            tablesReady = null
            throw err
        })
    }
    return tablesReady
}

// ---------------------------------------------------------------------------------------------
// Per-IP daily counter
// ---------------------------------------------------------------------------------------------

/** Turns per IP and Istanbul day (SPEC 9.3). */
export const IP_DAILY_TURNS = 80

function hex(buf: ArrayBuffer): string {
    return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('')
}

/** IPv6 → its /64 prefix (one subscriber usually owns a whole /64); IPv4 unchanged. */
export function ipKey(ip: string): string {
    const v = (ip || 'unknown').trim().toLowerCase()
    if (!v.includes(':')) return v
    const [head, tail] = v.split('::')
    const left = head ? head.split(':') : []
    const right = tail != null ? (tail ? tail.split(':') : []) : null
    const groups = right == null ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
    return groups.slice(0, 4).map(g => g.replace(/^0+(?=.)/, '')).join(':') + '::/64'
}

/** 'ip:' + first 32 hex of HMAC-SHA256(key = JWT_SECRET + ':ai-ip', data = day + '|' + ip). */
export async function ipBucket(ip: string, day: string): Promise<string> {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    const secret = `${env?.JWT_SECRET || 'onopo'}:ai-ip`
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${day}|${ipKey(ip)}`))
    return `ip:${hex(sig).slice(0, 32)}`
}

/** Counts this turn for the IP and returns the day's total (including this one). */
export async function countIpTurn(db: D1Lite, ip: string, now: Date): Promise<number> {
    await ensureTables(db)
    const day = istanbulDay(now)
    const row = await db
        .prepare('INSERT INTO ai_usage_daily (day, bucket, turns) VALUES (?, ?, 1) ON CONFLICT(day, bucket) DO UPDATE SET turns = turns + 1 RETURNING turns')
        .bind(day, await ipBucket(ip, day))
        .first<{ turns: number }>()
    return Number(row?.turns) || 1
}

// ---------------------------------------------------------------------------------------------
// Global daily budget
// ---------------------------------------------------------------------------------------------

const BUDGET_MEMO_MS = 30_000
let budgetMemo: { day: string; at: number; cost: number } | null = null
/** Cost this isolate recorded since the memo was read (so a busy isolate does not overshoot for 30 s). */
let localCost = 0

/** Daily budget in USD from site_settings.ai_daily_budget_usd (0.5–50; default 3). */
export function parseBudgetUsd(v: string | null | undefined): number {
    const n = parseFloat(String(v ?? '').replace(',', '.'))
    if (!Number.isFinite(n)) return 3
    return Math.min(50, Math.max(0.5, n))
}

/** true when today's recorded cost (memo 30 s + what this isolate added since) is over the budget. */
export async function budgetExceeded(db: D1Lite, now: Date, budgetUsd: number): Promise<boolean> {
    const day = istanbulDay(now)
    if (!budgetMemo || budgetMemo.day !== day || now.getTime() - budgetMemo.at > BUDGET_MEMO_MS) {
        try {
            await ensureTables(db)
            const row = await db
                .prepare("SELECT cost_micro_usd FROM ai_usage_daily WHERE day = ? AND bucket = 'global'")
                .bind(day)
                .first<{ cost_micro_usd: number }>()
            budgetMemo = { day, at: now.getTime(), cost: Number(row?.cost_micro_usd) || 0 }
            localCost = 0
        } catch (err) {
            // A read failure keeps today's last known spend (plus this isolate's own); with none, the
            // caller treats the error as "exceeded" (runTurn fails closed)
            if (!budgetMemo || budgetMemo.day !== day) throw err
        }
    }
    return budgetMemo.cost + localCost > budgetUsd * 1e6
}

// ---------------------------------------------------------------------------------------------
// Logging (content-free)
// ---------------------------------------------------------------------------------------------

/** What runTurn returns (turn.ts TurnLog), restated structurally so this file does not import turn.ts. */
export interface TurnLogRow {
    day: string
    convHash: string
    turn: number
    mode: string
    intent: string | null
    flags: string[]
    model: string | null
    modelCalls: number
    tools: string[]
    products: number[]
    handoff: string | null
    inTokens: number
    cachedTokens: number
    outTokens: number
    costMicroUsd: number
    firstTextMs: number | null
    totalMs: number
    outcome: string
}

const list = (v: readonly (string | number)[]) => (v.length ? v.join(',').slice(0, 300) : null)

/** Old IP rows and events go 1 time in 50 (two days / 365 days), so no cron is needed. */
async function maybePrune(db: D1Lite, now: Date, random: () => number): Promise<void> {
    if (random() >= 1 / 50) return
    await db.prepare("DELETE FROM ai_usage_daily WHERE bucket LIKE 'ip:%' AND day < ?").bind(istanbulDay(now, 2)).run()
    await db.prepare('DELETE FROM ai_chat_events WHERE day < ?').bind(istanbulDay(now, 365)).run()
}

/** Adds the turn to the global day row and writes one ai_chat_events row. Never throws. */
export async function recordTurn(db: D1Lite, log: TurnLogRow, now: Date = new Date(), random: () => number = Math.random): Promise<void> {
    try {
        localCost += log.costMicroUsd
        await ensureTables(db)
        const upsert = db
            .prepare(`INSERT INTO ai_usage_daily (day, bucket, turns, model_calls, cost_micro_usd) VALUES (?, 'global', 1, ?, ?)
ON CONFLICT(day, bucket) DO UPDATE SET turns = turns + 1, model_calls = model_calls + excluded.model_calls, cost_micro_usd = cost_micro_usd + excluded.cost_micro_usd`)
            .bind(log.day, log.modelCalls, log.costMicroUsd)
        const event = db
            .prepare(`INSERT INTO ai_chat_events (day, kind, conv_hash, turn, mode, intent, flags, model, model_calls, tools, products, handoff,
in_tokens, cached_tokens, out_tokens, cost_micro_usd, first_text_ms, total_ms, outcome) VALUES (?, 'turn', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(
                log.day, log.convHash, log.turn, log.mode, log.intent, list(log.flags), log.model, log.modelCalls,
                list(log.tools), list(log.products), log.handoff, log.inTokens, log.cachedTokens, log.outTokens,
                log.costMicroUsd, log.firstTextMs, log.totalMs, log.outcome,
            )
        if (db.batch) await db.batch([upsert, event])
        else {
            await upsert.run()
            await event.run()
        }
        await maybePrune(db, now, random)
    } catch (err) {
        console.error('ai_record_failed', err instanceof Error ? err.name : 'error')
    }
}

/**
 * Model cost outside a chat turn (the product facts lines): added to today's global row without counting
 * a turn, so the daily budget covers it too. Never throws.
 */
export async function recordExtraCost(db: D1Lite, modelCalls: number, cost: number, now: Date = new Date()): Promise<void> {
    try {
        localCost += cost
        await ensureTables(db)
        await db
            .prepare(`INSERT INTO ai_usage_daily (day, bucket, turns, model_calls, cost_micro_usd) VALUES (?, 'global', 0, ?, ?)
ON CONFLICT(day, bucket) DO UPDATE SET model_calls = model_calls + excluded.model_calls, cost_micro_usd = cost_micro_usd + excluded.cost_micro_usd`)
            .bind(istanbulDay(now), modelCalls, cost)
            .run()
    } catch (err) {
        console.error('ai_extra_cost_failed', err instanceof Error ? err.name : 'error')
    }
}

/** One UI beacon row (kind 'ui'). Never throws. */
export async function recordUiEvent(db: D1Lite, ev: UiEventBody, convHash: string, now: Date = new Date()): Promise<void> {
    try {
        await ensureTables(db)
        await db
            .prepare("INSERT INTO ai_chat_events (day, kind, conv_hash, outcome, products, handoff) VALUES (?, 'ui', ?, ?, ?, ?)")
            .bind(istanbulDay(now), convHash, ev.type, ev.productId != null ? String(ev.productId) : null, ev.reason ?? null)
            .run()
    } catch (err) {
        console.error('ai_ui_event_failed', err instanceof Error ? err.name : 'error')
    }
}

/** Test hook: forget the per-isolate memos. */
export function resetLimitsMemo(): void {
    budgetMemo = null
    localCost = 0
    tablesReady = null
}
