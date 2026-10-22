/**
 * Onopo Asistan: parser for Workers AI chat streams (pure, isomorphic). Verbatim from r1 §2.4.
 *
 * Why our own parser: every Workers AI model streams a hybrid of OpenAI-shaped deltas (each with a
 * per-delta usage), `choices: []` heartbeats, a native `{ response: "", usage }` tail with the cumulative
 * usage, then `[DONE]`; some models send native `{ response }` deltas or top-level `tool_calls`, tool
 * arguments come as string fragments by index or as an object, and `finish_reason` may be missing.
 * Tool calls are yielded only at the end of the stream.
 */

export type Usage = {
    prompt_tokens?: number
    completion_tokens?: number
    prompt_tokens_details?: { cached_tokens?: number }
}

export type Ev =
    | { t: 'text'; v: string }
    | { t: 'reasoning'; v: string }
    | { t: 'tool'; id: string; name: string; args: string }
    | { t: 'usage'; u: Usage }
    | { t: 'finish'; reason: string }

export async function* parseWorkersAiSse(body: ReadableStream<Uint8Array>): AsyncGenerator<Ev> {
    const reader = body.pipeThrough(new TextDecoderStream()).getReader()
    const calls = new Map<number, { id: string; name: string; args: string }>()
    let buf = '', finish: string | undefined, usage: Usage | undefined
    const addCall = (tc: any, fallbackIndex: number) => {
        const k = typeof tc.index === 'number' ? tc.index : fallbackIndex
        const cur = calls.get(k) ?? { id: '', name: '', args: '' }
        const fn = tc.function ?? tc
        if (tc.id) cur.id = tc.id
        if (fn.name) cur.name = fn.name
        const a = fn.arguments
        if (a != null) cur.args += typeof a === 'string' ? a : JSON.stringify(a)
        calls.set(k, cur)
    }
    for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += value
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).replace(/\r$/, ''); buf = buf.slice(nl + 1)
            if (!line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (!data || data === '[DONE]') continue
            let j: any
            try { j = JSON.parse(data) } catch { continue }
            if (j.error) throw new Error(typeof j.error === 'string' ? j.error : JSON.stringify(j.error))
            const choices: any[] | undefined = j.choices
            if ((!choices || choices.length === 0) && j.usage) usage = j.usage      // cumulative tail
            if (typeof j.response === 'string' && j.response) yield { t: 'text', v: j.response } // native delta
            if (Array.isArray(j.tool_calls)) j.tool_calls.forEach(addCall)          // native tool calls
            const c = choices?.[0]
            if (!c) continue
            const d = c.delta ?? {}
            const r = d.reasoning_content || d.reasoning
            if (r) yield { t: 'reasoning', v: r }
            if (d.content) yield { t: 'text', v: d.content }
            if (Array.isArray(d.tool_calls)) d.tool_calls.forEach(addCall)
            if (c.finish_reason) finish = c.finish_reason
        }
    }
    for (const c of calls.values()) yield { t: 'tool', id: c.id || `call_${crypto.randomUUID()}`, name: c.name, args: c.args || '{}' }
    if (usage) yield { t: 'usage', u: usage }
    yield { t: 'finish', reason: finish ?? (calls.size ? 'tool_calls' : 'stop') }
}

/** Tool arguments arrive as a JSON string or an object; null when neither gives a plain object. */
export function safeJson(raw: unknown): Record<string, unknown> | null {
    if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
    if (typeof raw !== 'string') return null
    const s = raw.trim()
    if (!s) return {}
    try {
        const v = JSON.parse(s)
        return v != null && typeof v === 'object' && !Array.isArray(v) ? v : null
    } catch {
        return null
    }
}
