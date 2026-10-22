/**
 * Paced, retrying runner for background jobs that call a rate-limited service one item at a time
 * (the assistant's product facts against DeepSeek; image variants against the Images binding).
 *
 * Why: the "Ürün bilgilerini yenile" button stopped at 32/118. It fired batches of parallel model calls; one
 * batch hit DeepSeek's 20 requests/min account limit, every call in it failed, and "nothing moved" ended the
 * loop. Here calls start at most every `intervalMs` (4 s = 15/min, leaving room for live chats), a rate-limited
 * item waits (`backoffMs`, growing) and is tried again, and the run only stops for a real error, the deadline,
 * the item cap or the caller's own check (e.g. today's budget).
 *
 * Pure: the clock (now/sleep) is injected, so tests run in no time.
 */

/** What one attempt at one item came to. */
export type AttemptResult<T> =
    | { kind: 'ok'; value: T }
    /** the service said "too many requests" (or our own slot limiter did): wait, then the same item again */
    | { kind: 'rate_limited'; reason?: string }
    /** timeout / 5xx: the same item once more after a short wait, then it counts as failed */
    | { kind: 'transient'; reason?: string }
    /** this item cannot be done (bad output, unsupported input): count it and go on */
    | { kind: 'skip'; reason: string }
    /** a real error that would repeat for every item (quota used up, database down): stop the run */
    | { kind: 'stop'; reason: string }

export interface PaceClock {
    now(): number
    sleep(ms: number): Promise<void>
}

export const realClock: PaceClock = {
    now: () => Date.now(),
    sleep: ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms))),
}

/** Shared "last call started at" so several runs in one isolate (e.g. consecutive button requests) keep the pace. */
export interface PaceState {
    lastStartAt: number
}

export interface PaceOptions {
    /** minimum gap between the starts of two attempts */
    intervalMs: number
    /** waits before retrying a rate-limited item; its length is the number of retries */
    backoffMs: readonly number[]
    /** wait before retrying a transient failure (default 2 s); one retry */
    transientWaitMs?: number
    /** at most this many items are attempted in this run */
    maxItems?: number
    /** epoch ms: no attempt or wait that would end after it is started (the item stays for later) */
    deadline?: number
    /** this many failed items in a row stop the run (something is broken, not just one product); default 5 */
    maxConsecutiveFailures?: number
    /** checked before each item; a string stops the run with that reason (e.g. 'budget') */
    beforeItem?: () => Promise<string | null>
    clock?: PaceClock
    state?: PaceState
}

export type StopReason = 'done' | 'max' | 'deadline' | 'rate_limited' | 'failures' | string

export interface PaceResult<I, T> {
    ok: { item: I; value: T }[]
    failed: { item: I; reason: string }[]
    /** items not finished in this run (not attempted, or still rate limited / cut by the deadline) */
    remaining: I[]
    attempts: number
    stopped: StopReason
}

/**
 * Runs `attempt` over `items` in order, one at a time (see the file comment). Never throws: an exception
 * from `attempt` counts as a skipped item with reason 'exception'.
 */
export async function runPaced<I, T>(items: readonly I[], attempt: (item: I) => Promise<AttemptResult<T>>, opts: PaceOptions): Promise<PaceResult<I, T>> {
    const clock = opts.clock ?? realClock
    const state = opts.state ?? { lastStartAt: 0 }
    const maxItems = Math.max(0, opts.maxItems ?? items.length)
    const maxFailures = Math.max(1, opts.maxConsecutiveFailures ?? 5)
    const transientWait = opts.transientWaitMs ?? 2000
    const result: PaceResult<I, T> = { ok: [], failed: [], remaining: [], attempts: 0, stopped: 'done' }
    let consecutiveFailures = 0

    // Would waiting `ms` from now still leave room before the deadline?
    const fits = (ms: number) => opts.deadline == null || clock.now() + ms <= opts.deadline

    let index = 0
    outer: for (; index < items.length; index++) {
        if (index >= maxItems) {
            result.stopped = 'max'
            break
        }
        const item = items[index]
        if (opts.beforeItem) {
            let stop: string | null = null
            try {
                stop = await opts.beforeItem()
            } catch {
                stop = 'check_failed'
            }
            if (stop) {
                result.stopped = stop
                break
            }
        }

        let rateLimits = 0
        let transients = 0
        for (;;) {
            const wait = Math.max(0, state.lastStartAt + opts.intervalMs - clock.now())
            if (!fits(wait)) {
                result.stopped = 'deadline'
                break outer
            }
            if (wait > 0) await clock.sleep(wait)
            state.lastStartAt = clock.now()
            result.attempts++

            let r: AttemptResult<T>
            try {
                r = await attempt(item)
            } catch {
                r = { kind: 'skip', reason: 'exception' }
            }

            if (r.kind === 'ok') {
                result.ok.push({ item, value: r.value })
                consecutiveFailures = 0
                break
            }
            if (r.kind === 'stop') {
                result.stopped = r.reason
                break outer
            }
            if (r.kind === 'rate_limited') {
                if (rateLimits >= opts.backoffMs.length) {
                    // Still limited after every backoff: the service is busy, try again in a later run
                    result.stopped = 'rate_limited'
                    break outer
                }
                const backoff = opts.backoffMs[rateLimits++]
                if (!fits(backoff)) {
                    result.stopped = 'deadline'
                    break outer
                }
                await clock.sleep(backoff)
                continue
            }
            if (r.kind === 'transient' && transients < 1) {
                transients++
                if (!fits(transientWait)) {
                    result.stopped = 'deadline'
                    break outer
                }
                await clock.sleep(transientWait)
                continue
            }
            // skip, or a transient failure that happened again
            result.failed.push({ item, reason: r.reason ?? r.kind })
            consecutiveFailures++
            if (consecutiveFailures >= maxFailures) {
                index++
                result.stopped = 'failures'
                break outer
            }
            break
        }
    }
    result.remaining = items.slice(index)
    return result
}
