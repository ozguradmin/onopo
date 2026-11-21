// Unit tests for lib/assistant/ai-provider.ts: Runware AIR ids go to Runware's OpenAI-compatible endpoint with the
// key, "@cf/…" ids stay on the Workers AI binding, and failures keep the shapes the callers expect.
// Run: node --test scripts/ai-provider.test.mjs   (no network: fetch is a fake)
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

// The app imports extensionless relative paths ('./facts'); resolve them to the .ts files
registerHooks({
    resolve(specifier, context, next) {
        if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
            const url = new URL(specifier + '.ts', context.parentURL)
            if (existsSync(fileURLToPath(url))) return next(url.href, context)
        }
        return next(specifier, context)
    },
})

const p =await import('../lib/assistant/ai-provider.ts')
const limits = await import('../lib/assistant/limits.ts')

const KEY = 'test-key-not-real'

function fakeFetch(response) {
    const calls = []
    const fn = async (url, init) => {
        calls.push({ url, init, body: JSON.parse(init.body) })
        return typeof response === 'function' ? response() : response
    }
    fn.calls = calls
    return fn
}

test('isRunwareModel: AIR ids yes, Workers AI ids and junk no', () => {
    for (const m of ['deepseek:v4.1@flash-1017', 'deepseek:v4@flash', 'google:gemini@3.5-flash-lite', 'zai:glm@5.3-flash', ' minimax:m3@0 ']) assert.ok(p.isRunwareModel(m), m)
    for (const m of ['@cf/deepseek-ai/deepseek-v4.1-flash-1017', '@cf/cloudflare/clef-flash', '', null, undefined, 'deepseek', 'a:b', 'a@b', 'a b:c@d']) assert.ok(!p.isRunwareModel(m), String(m))
})

test('Workers AI ids go to the binding untouched; fetch is never called', async () => {
    const seen = []
    const fetch = fakeFetch(new Response('{}'))
    const ai = p.createAiRunner({ workersAi: { run: async (...a) => (seen.push(a), 'binding') }, runwareKey: KEY, fetch })
    const opts = { returnRawResponse: true }
    assert.equal(await ai.run('@cf/cloudflare/clef-flash', { x: 1 }, opts), 'binding')
    assert.deepEqual(seen, [['@cf/cloudflare/clef-flash', { x: 1 }, opts]])
    assert.equal(fetch.calls.length, 0)
})

test('Runware raw call: POST to chat/completions with bearer key, body = inputs + model, Workers-only options dropped', async () => {
    const res = new Response('data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
    const fetch = fakeFetch(res)
    const ai = p.createAiRunner({ runwareKey: ` ${KEY} `, fetch })
    const ctrl = new AbortController()
    const out = await ai.run('deepseek:v4.1@flash-1017', { messages: [{ role: 'user', content: 'selam' }], stream: true, reasoning_effort: 'none', model: 'ignored' }, {
        returnRawResponse: true, signal: ctrl.signal, extraHeaders: { 'x-session-affinity': 'a' }, rejectIfBusy: true, gateway: { id: 'g' },
    })
    assert.equal(out, res)
    const [c] = fetch.calls
    assert.equal(c.url, 'https://api.runware.ai/v1/chat/completions')
    assert.equal(c.init.method, 'POST')
    assert.equal(c.init.headers.authorization, `Bearer ${KEY}`)
    assert.equal(c.init.signal, ctrl.signal)
    assert.deepEqual(c.body, { messages: [{ role: 'user', content: 'selam' }], stream: true, reasoning_effort: 'none', model: 'deepseek:v4.1@flash-1017' })
    assert.equal(JSON.stringify(c.body).includes('affinity'), false)
})

test('Runware raw call returns an error Response as is (turn.ts reads the status)', async () => {
    const ai = p.createAiRunner({ runwareKey: KEY, fetch: fakeFetch(new Response('{"error":"bad"}', { status: 429 })) })
    const r = await ai.run('deepseek:v4.1@flash', {}, { returnRawResponse: true })
    assert.equal(r.status, 429)
})

test('Runware JSON call: parsed OpenAI body on success; Error with .status (no body text) on failure', async () => {
    const ok = p.createAiRunner({ runwareKey: KEY, fetch: fakeFetch(new Response(JSON.stringify({ choices: [{ message: { content: 'Merhaba' } }], usage: { prompt_tokens: 3, completion_tokens: 1 } }))) })
    const j = await ok.run('deepseek:v4.1@flash', { messages: [] })
    assert.equal(j.choices[0].message.content, 'Merhaba')
    const bad = p.createAiRunner({ runwareKey: KEY, fetch: fakeFetch(new Response('secret request echo', { status: 503 })) })
    await assert.rejects(bad.run('deepseek:v4.1@flash', {}), err => err.status === 503 && !String(err.message).includes('secret'))
})

test('No key: a Runware model never calls fetch (raw → 503 Response, JSON → Error 503)', async () => {
    const fetch = fakeFetch(new Response('{}'))
    const ai = p.createAiRunner({ runwareKey: '  ', fetch })
    assert.equal((await ai.run('deepseek:v4.1@flash', {}, { returnRawResponse: true })).status, 503)
    await assert.rejects(ai.run('deepseek:v4.1@flash', {}), err => err.status === 503)
    assert.equal(fetch.calls.length, 0)
})

test('No Workers AI binding: a "@cf/" model fails with status 503', async () => {
    const ai = p.createAiRunner({ runwareKey: KEY, fetch: fakeFetch(new Response('{}')) })
    await assert.rejects(ai.run('@cf/cloudflare/clef-flash', {}), err => err.status === 503)
})

test('cost: Runware DeepSeek V4.1 Flash is billed at its own rates, not the Workers AI ones', () => {
    const u = { inTokens: 1_000_000, cachedTokens: 0, outTokens: 1_000_000 }
    assert.equal(limits.costMicroUsd('deepseek:v4.1@flash-1017', u), 750_000)
    assert.equal(limits.costMicroUsd('@cf/deepseek-ai/deepseek-v4.1-flash-1017', u), 1_500_000)
})
