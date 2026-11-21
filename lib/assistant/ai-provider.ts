/**
 * Onopo Asistan: one `run(model, inputs, options)` for both model hosts.
 *
 * Why: every assistant model runs on Runware since 2026-11-21 (owner: off Workers AI) through its
 * OpenAI-compatible chat completions API. "@cf/…" ids still go to env.AI if that binding is ever added back
 * (it is not bound in wrangler.toml any more). Callers keep the Workers AI call shape
 * (env.AI.run): a Runware call with `returnRawResponse` gives back the fetch Response (SSE body when
 * `stream: true`), otherwise the parsed JSON (OpenAI shape, read by readAiResult) or an Error with `.status`
 * (classified by facts-auto's classifyAiError).
 *
 * Model ids tell the host apart: Workers AI ids start with "@cf/", Runware uses AIR ids ("deepseek:v4.1@flash").
 * No `server-only` import: unit tests drive it with a fake fetch. The key is never logged or echoed.
 */

export interface AiRunner {
    run(model: string, inputs: unknown, options?: Record<string, unknown>): Promise<unknown>
}

export const RUNWARE_CHAT_URL = 'https://api.runware.ai/v1/chat/completions'

/** A Runware AIR id (provider:model@version). Workers AI ids ("@cf/…") never match. */
export function isRunwareModel(model: string | null | undefined): boolean {
    const m = (model ?? '').trim()
    return !!m && !m.startsWith('@') && /^[a-z0-9-]+:[^\s@:]+@[^\s@]+$/i.test(m)
}

/** An Error carrying the HTTP status (classifyAiError reads `.status`). Content-free: no response body. */
function httpError(status: number, code: string): Error & { status: number } {
    return Object.assign(new Error(`runware_${code} ${status}`), { status })
}

export interface AiRunnerDeps {
    /** env.AI (Workers AI binding) */
    workersAi?: AiRunner
    /** env.RUNWARE_API_KEY */
    runwareKey?: string | null
    /** Injected for tests */
    fetch?: typeof fetch
}

export function createAiRunner(deps: AiRunnerDeps): AiRunner {
    const doFetch = deps.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))
    const key = deps.runwareKey?.trim() || ''
    return {
        async run(model, inputs, options = {}) {
            if (!isRunwareModel(model)) {
                if (!deps.workersAi) throw httpError(503, 'workers_ai_missing')
                return deps.workersAi.run(model, inputs, options)
            }
            const raw = options.returnRawResponse === true
            if (!key) {
                if (raw) return new Response('runware_key_missing', { status: 503 })
                throw httpError(503, 'key_missing')
            }
            const body = { ...(inputs && typeof inputs === 'object' ? (inputs as Record<string, unknown>) : {}), model: model.trim() }
            const res = await doFetch(RUNWARE_CHAT_URL, {
                method: 'POST',
                headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
                body: JSON.stringify(body),
                signal: options.signal instanceof AbortSignal ? options.signal : undefined,
            })
            if (raw) return res
            if (!res.ok) {
                // The body may quote the request; only the status leaves this function
                await res.body?.cancel().catch(() => {})
                throw httpError(res.status, 'http')
            }
            return res.json()
        },
    }
}
