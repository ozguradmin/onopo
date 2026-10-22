/**
 * Onopo Asistan: keeping the product facts lines (product-facts.ts) up to date without anyone pressing a button.
 *
 * Three triggers share one runner (runFactsPaced):
 *  1. A product is created or saved in the admin (POST/PUT /api/products, bulk import): its line is rewritten in
 *     ctx.waitUntil right away, but only when the name + description hash changed (a price or stock edit costs
 *     nothing). waitUntil lasts ~30 s after the answer, so a big import does a few and the daily sweep the rest.
 *  2. The daily cron (worker.ts → /api/cron/automation/?job=facts): every missing or outdated line, at most
 *     FACTS_SWEEP_MAX per run.
 *  3. The "Ürün bilgilerini yenile" button on /admin/assistant: short requests the page repeats until done.
 *
 * DeepSeek allows 20 requests/min for the whole account, live chats included. So calls start at most every
 * 4 s (15/min), each one first takes a slot from the chat's own CHAT_RL_MODEL limiter (a busy minute makes
 * the job wait, not the visitor), a 429 / 3040 answer is retried after a growing pause, and only a real error
 * (daily allocation used up, database down, many products failing in a row) stops the run. Today's assistant
 * budget is checked before every call. Failures go to the system log (lib/system-log.ts, source 'facts').
 *
 * No `server-only` import: unit-tested with fakes (scripts/automation.test.mjs); the env wiring is in data.ts.
 */
import type { SystemLogEvent } from '../system-log'
import { runPaced, type AttemptResult, type PaceClock, type PaceState } from '../automation/pacing'
import { decideFacts, generateFactsDetailed, storeFacts, type FactsAi, type FactsProduct, type StaleItem, type StoredFacts } from './product-facts'
import type { D1Lite } from './limits'

/** 4 s between call starts = 15 calls/min, under DeepSeek's 20/min with room for live chats. */
export const FACTS_INTERVAL_MS = 4_000
/** Waits before retrying a rate-limited product (then the run stops and a later one continues). */
export const FACTS_BACKOFF_MS = [10_000, 25_000, 45_000] as const
/** At most this many lines per daily sweep (120 × 4 s ≈ 8 minutes of the cron's 15). */
export const FACTS_SWEEP_MAX = 120
/** After an admin save: what fits in waitUntil's ~30 s. */
export const FACTS_ON_SAVE_MAX = 5
export const FACTS_ON_SAVE_WINDOW_MS = 25_000

/** One pace per isolate, shared by every trigger, so two runs in one isolate never double the rate. */
export const deepseekPace: PaceState = { lastStartAt: 0 }

export type AiErrorKind = 'rate_limited' | 'quota' | 'transient' | 'other'

/**
 * What a failed Workers AI call means. 429 / 3040 (out of capacity) = wait and retry; 3036 (daily allocation
 * used up) = stop for today; timeouts and 5xx = once more; anything else = this product failed.
 */
export function classifyAiError(err: unknown): AiErrorKind {
    const e = err as { status?: unknown; code?: unknown; message?: unknown } | null
    const status = Number(e?.status)
    const text = `${e?.code ?? ''} ${typeof e?.message === 'string' ? e.message : String(err ?? '')}`
    if (/\b3036\b|daily free allocation/i.test(text)) return 'quota'
    if (status === 429 || /\b(429|3040)\b|rate.?limit|too many requests|capacity temporarily exceeded/i.test(text)) return 'rate_limited'
    if (status === 408 || status >= 500 || /\b(408|500|502|503|504|3007|3008)\b|time(d)?\s?out|network|fetch failed|connection/i.test(text)) return 'transient'
    return 'other'
}

/** Products whose line must be (re)written: no stored line, or the name + description hash changed. */
export async function factsItemsToRefresh(products: readonly FactsProduct[], stored: ReadonlyMap<number, StoredFacts>): Promise<StaleItem[]> {
    return (await decideFacts(products, stored)).stale
}

export interface FactsRunDeps {
    db: D1Lite
    ai: FactsAi
    model: string
    /** CHAT_RL_MODEL.limit({ key: 'deepseek' }); false = this minute is full */
    takeSlot?: () => Promise<boolean>
    /** false = today's assistant budget is used up */
    budgetOk?: () => Promise<boolean>
    /** counts the cost in today's budget row (limits.ts recordExtraCost) */
    recordCost?: (modelCalls: number, costMicroUsd: number) => Promise<void>
    clock?: PaceClock
    state?: PaceState
    now?: () => Date
}

export interface FactsRunOptions {
    maxItems: number
    /** epoch ms */
    deadline?: number
    intervalMs?: number
    backoffMs?: readonly number[]
}

export interface FactsRunResult {
    done: number
    failed: { id: number; reason: string }[]
    /** stale items this run did not finish (not attempted, rate limited or cut by the deadline) */
    remaining: number
    stopped: string
    costMicroUsd: number
}

/** Writes the lines of `items` one at a time, paced (see the file comment). Never throws. */
export async function runFactsPaced(deps: FactsRunDeps, items: readonly StaleItem[], opts: FactsRunOptions): Promise<FactsRunResult> {
    let cost = 0
    const now = deps.now ?? (() => new Date())
    const attempt = async (item: StaleItem): Promise<AttemptResult<true>> => {
        if (deps.takeSlot) {
            let free = true
            try {
                free = await deps.takeSlot()
            } catch {
                free = true
            }
            if (!free) return { kind: 'rate_limited', reason: 'slot' }
        }
        const r = await generateFactsDetailed(deps.ai, deps.model, item)
        if (!r.ok && r.error === 'call') {
            const kind = classifyAiError(r.cause)
            if (kind === 'rate_limited') return { kind: 'rate_limited', reason: 'rate_limited' }
            if (kind === 'quota') return { kind: 'stop', reason: 'quota' }
            if (kind === 'transient') return { kind: 'transient', reason: 'transient' }
            return { kind: 'skip', reason: 'ai_error' }
        }
        // A call that answered costs money even when the line was unusable
        const callCost = r.costMicroUsd
        cost += callCost
        if (callCost > 0 && deps.recordCost) await deps.recordCost(1, callCost).catch(() => {})
        if (!r.ok) return { kind: 'skip', reason: 'empty' }
        try {
            await storeFacts(deps.db, item, r.facts, deps.model, now())
        } catch {
            // The database is down or the table is missing: every other product would fail the same way
            return { kind: 'stop', reason: 'db' }
        }
        return { kind: 'ok', value: true }
    }
    try {
        const r = await runPaced(items, attempt, {
            intervalMs: opts.intervalMs ?? FACTS_INTERVAL_MS,
            backoffMs: opts.backoffMs ?? FACTS_BACKOFF_MS,
            maxItems: opts.maxItems,
            deadline: opts.deadline,
            clock: deps.clock,
            state: deps.state ?? deepseekPace,
            beforeItem: deps.budgetOk ? async () => ((await deps.budgetOk!()) ? null : 'budget') : undefined,
        })
        return {
            done: r.ok.length,
            failed: r.failed.map(f => ({ id: f.item.id, reason: f.reason })),
            remaining: r.remaining.length,
            stopped: r.stopped,
            costMicroUsd: cost,
        }
    } catch {
        return { done: 0, failed: [], remaining: items.length, stopped: 'exception', costMicroUsd: cost }
    }
}

const FAIL_REASON_TR: Record<string, string> = {
    empty: 'yapay zekâ kullanılabilir bir cevap vermedi',
    ai_error: 'yapay zekâ hata verdi',
    transient: 'yapay zekâ zaman aşımına uğradı',
    exception: 'beklenmeyen hata',
}

/**
 * System log lines for a run: one warning per product that failed, and one line when the run stopped for a
 * reason the owner should know about. `context` says which trigger ran ('sweep', 'save' or 'button').
 * Being rate limited or cut by the deadline is normal (a later run continues) and only logged by the sweep
 * when it left work undone.
 */
export function factsRunLogEvents(r: FactsRunResult, context: 'sweep' | 'save' | 'button'): SystemLogEvent[] {
    const out: SystemLogEvent[] = []
    for (const f of r.failed) {
        out.push({
            source: 'facts',
            level: 'warn',
            message: 'Ürünün asistan bilgisi yazılamadı; açıklamadan otomatik özet kullanılıyor.',
            detail: `${FAIL_REASON_TR[f.reason] ?? f.reason} (${context})`,
            ref: `ürün #${f.id}`,
        })
    }
    const ctx = context === 'sweep' ? 'Günlük tarama' : context === 'save' ? 'Kayıttan sonraki güncelleme' : 'Yenile düğmesi'
    if (r.stopped === 'quota') {
        out.push({ source: 'facts', level: 'error', message: 'Yapay zekânın günlük kullanım hakkı doldu; ürün bilgileri yarın tamamlanacak.', detail: `${ctx}: ${r.done} yazıldı, ${r.remaining} kaldı (3036)` })
    } else if (r.stopped === 'db') {
        out.push({ source: 'facts', level: 'error', message: 'Ürün bilgileri veritabanına yazılamadı.', detail: `${ctx}: ${r.done} yazıldı, ${r.remaining} kaldı` })
    } else if (r.stopped === 'failures') {
        out.push({ source: 'facts', level: 'error', message: 'Art arda birçok ürünün bilgisi yazılamadı; yapay zekâ bağlantısında sorun olabilir.', detail: `${ctx}: ${r.done} yazıldı, ${r.failed.length} hata` })
    } else if (r.stopped === 'budget') {
        out.push({ source: 'facts', level: 'info', message: 'Günlük yapay zekâ bütçesi doldu; kalan ürün bilgileri sonraki gün yazılacak.', detail: `${ctx}: ${r.done} yazıldı, ${r.remaining} kaldı` })
    } else if (r.stopped === 'exception' || r.stopped === 'check_failed') {
        out.push({ source: 'facts', level: 'error', message: 'Ürün bilgisi güncellemesi beklenmedik şekilde durdu.', detail: `${ctx}: ${r.stopped}` })
    } else if (context === 'sweep' && r.stopped === 'rate_limited' && r.remaining > 0) {
        out.push({ source: 'facts', level: 'warn', message: 'Yapay zekâ çok yoğundu; kalan ürün bilgileri sonraki taramada yazılacak.', detail: `${r.done} yazıldı, ${r.remaining} kaldı` })
    }
    return out
}
