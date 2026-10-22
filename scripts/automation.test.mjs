// Unit tests for the automatic upkeep: the paced runner (lib/automation/pacing.ts), the assistant's product
// facts automation (lib/assistant/facts-auto.ts), server-side image variants (lib/image-variants-auto.ts) and
// the system log (lib/system-log.ts).
// Run: node --test scripts/automation.test.mjs   (Node 23.6+ strips the TypeScript types itself; node:sqlite
// stands in for D1). No network, no Cloudflare: the clock, Workers AI, R2 and the Images binding are fakes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

// The app imports '@/…' and extensionless relative paths; resolve them to the .ts files.
const ROOT = new URL('../', import.meta.url)
registerHooks({
    resolve(specifier, context, next) {
        let spec = specifier.startsWith('@/') ? new URL(specifier.slice(2), ROOT).href : specifier
        if ((spec.startsWith('.') || spec.startsWith('file:')) && !/\.[cm]?[jt]sx?$/.test(spec)) {
            for (const ext of ['.ts', '.tsx']) {
                const url = new URL(spec + ext, context.parentURL)
                if (existsSync(fileURLToPath(url))) return next(url.href, context)
            }
        }
        return next(spec, context)
    },
})
const { runPaced } = await import('../lib/automation/pacing.ts')
const fa = await import('../lib/assistant/facts-auto.ts')
const pf = await import('../lib/assistant/product-facts.ts')
const iv = await import('../lib/image-variants-auto.ts')
const sl = await import('../lib/system-log.ts')

// ---------------------------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------------------------

/** A clock whose sleep() only moves the time forward (records every wait). */
function fakeClock(start = 1_000_000) {
    const c = { t: start, sleeps: [], now: () => c.t, sleep: async ms => { c.sleeps.push(ms); c.t += Math.max(0, ms) } }
    return c
}

/** D1 on node:sqlite: prepare → bind → run/all/first, like the real binding. */
function fakeD1() {
    const raw = new DatabaseSync(':memory:')
    const norm = v => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v)
    const stmt = (sql, binds = []) => ({
        bind: (...values) => stmt(sql, values),
        async run() {
            const r = raw.prepare(sql).run(...binds.map(norm))
            return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
        },
        async all() {
            return { results: raw.prepare(sql).all(...binds.map(norm)).map(r => ({ ...r })) }
        },
        async first() {
            const r = raw.prepare(sql).get(...binds.map(norm))
            return r ? { ...r } : null
        },
    })
    return { prepare: sql => stmt(sql), raw }
}

const ok = value => ({ kind: 'ok', value })
const DAY = 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------------------------
// Paced runner
// ---------------------------------------------------------------------------------------------

test('pacing: calls start at most every intervalMs, all items done', async () => {
    const clock = fakeClock()
    const starts = []
    const r = await runPaced([1, 2, 3], async i => { starts.push(clock.now()); return ok(i) }, { intervalMs: 4000, backoffMs: [], clock })
    assert.equal(r.stopped, 'done')
    assert.deepEqual(r.ok.map(o => o.value), [1, 2, 3])
    assert.equal(r.attempts, 3)
    assert.ok(starts[1] - starts[0] >= 4000 && starts[2] - starts[1] >= 4000)
    assert.deepEqual(r.remaining, [])
})

test('pacing: a rate-limited item waits with growing backoff and is tried again', async () => {
    const clock = fakeClock()
    let calls = 0
    const r = await runPaced(['a', 'b'], async i => {
        calls++
        if (i === 'a' && calls <= 2) return { kind: 'rate_limited' }
        return ok(i)
    }, { intervalMs: 1000, backoffMs: [5000, 9000, 20000], clock })
    assert.equal(r.stopped, 'done')
    assert.equal(r.ok.length, 2)
    assert.equal(r.failed.length, 0)
    assert.ok(clock.sleeps.includes(5000) && clock.sleeps.includes(9000))
    assert.ok(!clock.sleeps.includes(20000))
})

test('pacing: still rate limited after every backoff → stops, the item stays for a later run', async () => {
    const clock = fakeClock()
    const r = await runPaced([1, 2, 3], async i => (i === 2 ? { kind: 'rate_limited' } : ok(i)), { intervalMs: 100, backoffMs: [1000, 2000], clock })
    assert.equal(r.stopped, 'rate_limited')
    assert.deepEqual(r.ok.map(o => o.item), [1])
    assert.deepEqual(r.remaining, [2, 3])
    assert.equal(r.failed.length, 0)
})

test('pacing: transient failure retried once; twice counts as failed and the run goes on', async () => {
    const clock = fakeClock()
    const seen = new Map()
    const r = await runPaced(['x', 'y', 'z'], async i => {
        seen.set(i, (seen.get(i) ?? 0) + 1)
        if (i === 'x' && seen.get(i) === 1) return { kind: 'transient' }
        if (i === 'y') return { kind: 'transient', reason: 'timeout' }
        return ok(i)
    }, { intervalMs: 10, backoffMs: [], clock })
    assert.equal(r.stopped, 'done')
    assert.deepEqual(r.ok.map(o => o.item), ['x', 'z'])
    assert.deepEqual(r.failed, [{ item: 'y', reason: 'timeout' }])
    assert.equal(seen.get('y'), 2)
})

test('pacing: skipped items do not stop the run; many in a row do', async () => {
    const clock = fakeClock()
    const r1 = await runPaced([1, 2, 3, 4], async i => (i % 2 ? { kind: 'skip', reason: 'empty' } : ok(i)), { intervalMs: 1, backoffMs: [], clock, maxConsecutiveFailures: 2 })
    assert.equal(r1.stopped, 'done')
    assert.equal(r1.failed.length, 2)
    const r2 = await runPaced([1, 2, 3, 4], async () => ({ kind: 'skip', reason: 'bad' }), { intervalMs: 1, backoffMs: [], clock, maxConsecutiveFailures: 3 })
    assert.equal(r2.stopped, 'failures')
    assert.equal(r2.failed.length, 3)
    assert.deepEqual(r2.remaining, [4])
})

test('pacing: a real error stops at once; deadline, item cap and beforeItem stop too', async () => {
    const clock = fakeClock()
    const stop = await runPaced([1, 2], async i => (i === 1 ? { kind: 'stop', reason: 'quota' } : ok(i)), { intervalMs: 1, backoffMs: [], clock })
    assert.equal(stop.stopped, 'quota')
    assert.deepEqual(stop.remaining, [1, 2])

    const c2 = fakeClock()
    const late = await runPaced([1, 2, 3], async i => ok(i), { intervalMs: 4000, backoffMs: [], clock: c2, deadline: c2.now() + 5000 })
    assert.equal(late.stopped, 'deadline')
    assert.equal(late.ok.length, 2)
    assert.deepEqual(late.remaining, [3])

    const capped = await runPaced([1, 2, 3], async i => ok(i), { intervalMs: 1, backoffMs: [], clock: fakeClock(), maxItems: 2 })
    assert.equal(capped.stopped, 'max')
    assert.deepEqual(capped.remaining, [3])

    let n = 0
    const budget = await runPaced([1, 2, 3], async i => ok(i), { intervalMs: 1, backoffMs: [], clock: fakeClock(), beforeItem: async () => (++n > 1 ? 'budget' : null) })
    assert.equal(budget.stopped, 'budget')
    assert.equal(budget.ok.length, 1)
})

test('pacing: the shared state keeps the pace across runs in one isolate', async () => {
    const clock = fakeClock()
    const state = { lastStartAt: 0 }
    await runPaced([1], async i => ok(i), { intervalMs: 4000, backoffMs: [], clock, state })
    const before = clock.now()
    await runPaced([2], async i => ok(i), { intervalMs: 4000, backoffMs: [], clock, state })
    assert.ok(clock.now() - before >= 4000 - 1, 'the second run waits for the first one\'s interval')
})

test('pacing regression: 118 products against a 20/min account limit with live chats all get done (was 32/118)', async () => {
    const clock = fakeClock()
    // The account: at most 20 calls in any 60 s; live chats use 8 calls a minute (15 + 8 > 20: some calls hit 429)
    const calls = []
    const chatAt = Array.from({ length: 400 }, (_, i) => clock.now() + i * 7_500)
    const allowed = () => {
        const now = clock.now()
        const inWindow = calls.filter(t => now - t < 60_000).length + chatAt.filter(t => t <= now && now - t < 60_000).length
        if (inWindow >= 20) return false
        calls.push(now)
        return true
    }
    const items = Array.from({ length: 118 }, (_, i) => i + 1)
    const r = await runPaced(items, async i => (allowed() ? ok(i) : { kind: 'rate_limited' }), {
        intervalMs: fa.FACTS_INTERVAL_MS,
        backoffMs: fa.FACTS_BACKOFF_MS,
        clock,
    })
    assert.equal(r.stopped, 'done')
    assert.equal(r.ok.length, 118)
    assert.equal(r.failed.length, 0)
    assert.ok(r.attempts > 118, 'some calls were rate limited and retried')
})

// ---------------------------------------------------------------------------------------------
// Product facts automation
// ---------------------------------------------------------------------------------------------

test('facts: classifyAiError tells rate limits, quota, transient and other errors apart', () => {
    assert.equal(fa.classifyAiError(new Error('AiError: 3040: Capacity temporarily exceeded, please try again.')), 'rate_limited')
    assert.equal(fa.classifyAiError({ status: 429, message: 'Too Many Requests' }), 'rate_limited')
    assert.equal(fa.classifyAiError(new Error('3036: You have used up your daily free allocation of 10,000 neurons')), 'quota')
    assert.equal(fa.classifyAiError(new Error('3007: Request timeout')), 'transient')
    assert.equal(fa.classifyAiError({ status: 503, message: 'unavailable' }), 'transient')
    assert.equal(fa.classifyAiError(new Error('5006: invalid input')), 'other')
})

test('facts: only a new product or a changed name/description needs a new line (hash trigger)', async () => {
    const a = { id: 1, name: 'Şarj Adaptörü 20W', description: 'Kutu içeriği: adaptör.' }
    const b = { id: 2, name: 'Type-C Kablo 1 m', description: 'Örgülü kablo.' }
    const c = { id: 3, name: 'Yeni ürün', description: 'Açıklama' }
    const stored = new Map([
        [1, { hash: await pf.factsHash(a.name, a.description), facts: 'Kutu: adaptör' }],
        [2, { hash: await pf.factsHash(b.name, 'Eski açıklama'), facts: 'eski' }],
    ])
    const todo = await fa.factsItemsToRefresh([a, b, c], stored)
    assert.deepEqual(todo.map(i => i.id), [2, 3])
    assert.equal(todo[0].hash, await pf.factsHash(b.name, b.description))
    // Whitespace-only edits do not change the hash (no model call for them)
    assert.equal(await pf.factsHash('Şarj  Adaptörü 20W', ' Kutu içeriği:   adaptör. '), await pf.factsHash(a.name, a.description))
})

async function factsDb() {
    const db = fakeD1()
    pf.resetFactsMemo()
    await pf.ensureFactsTable(db)
    return db
}

function fakeAi(script) {
    let n = 0
    const ai = {
        calls: 0,
        async run() {
            ai.calls++
            const step = script(n++)
            if (step instanceof Error) throw step
            return { response: step, usage: { prompt_tokens: 600, completion_tokens: 40 } }
        },
    }
    return ai
}

const staleItems = async list => Promise.all(list.map(async p => ({ ...p, hash: await pf.factsHash(p.name, p.description) })))

test('facts: runFactsPaced retries a 3040, stores the lines and records the cost', async () => {
    const db = await factsDb()
    const ai = fakeAi(n => (n === 1 ? new Error('AiError: 3040: Capacity temporarily exceeded') : `Kutu: adaptör + kablo; Güç: 20W #${n}`))
    const costs = []
    const items = await staleItems([
        { id: 10, name: 'Adaptör 20W', description: 'Kutu içeriği: adaptör ve kablo' },
        { id: 11, name: 'Adaptör 33W', description: 'Kutu içeriği: adaptör' },
    ])
    const clock = fakeClock()
    const r = await fa.runFactsPaced(
        { db, ai, model: '@cf/deepseek-ai/deepseek-v4.1-flash-1017', clock, state: { lastStartAt: 0 }, recordCost: async (calls, cost) => { costs.push([calls, cost]) } },
        items,
        { maxItems: 10 },
    )
    assert.equal(r.stopped, 'done')
    assert.equal(r.done, 2)
    assert.equal(ai.calls, 3)
    assert.equal(costs.length, 2)
    assert.ok(r.costMicroUsd > 0)
    assert.ok(clock.sleeps.includes(fa.FACTS_BACKOFF_MS[0]), 'backed off after the 3040')
    const stored = await pf.loadStoredFacts(db)
    assert.equal(stored.get(10).hash, items[0].hash)
    assert.match(stored.get(11).facts, /Güç: 20W/)
})

test('facts: a full DeepSeek minute (slot limiter) waits instead of calling the model', async () => {
    const db = await factsDb()
    const ai = fakeAi(() => 'Kutu: adaptör; Güç: 20W')
    let slots = 0
    const r = await fa.runFactsPaced(
        { db, ai, model: 'deepseek', clock: fakeClock(), state: { lastStartAt: 0 }, takeSlot: async () => ++slots > 1 },
        await staleItems([{ id: 1, name: 'A', description: 'B' }]),
        { maxItems: 5 },
    )
    assert.equal(r.done, 1)
    assert.equal(ai.calls, 1, 'no model call while the slot was taken')
})

test('facts: 3036 (daily allocation) stops the run and is an error in the system log', async () => {
    const db = await factsDb()
    const ai = fakeAi(() => new Error('AiError: 3036: daily free allocation used up'))
    const r = await fa.runFactsPaced({ db, ai, model: 'deepseek', clock: fakeClock(), state: { lastStartAt: 0 } }, await staleItems([
        { id: 1, name: 'A', description: 'x' }, { id: 2, name: 'B', description: 'y' },
    ]), { maxItems: 5 })
    assert.equal(r.stopped, 'quota')
    assert.equal(r.remaining, 2)
    const events = fa.factsRunLogEvents(r, 'sweep')
    assert.equal(events.length, 1)
    assert.equal(events[0].level, 'error')
    assert.equal(events[0].source, 'facts')
})

test('facts: an unusable answer is skipped and logged per product; the budget check stops the run', async () => {
    const db = await factsDb()
    const ai = fakeAi(n => (n === 0 ? 'ok' : 'Kutu: adaptör; Güç: 20W'))
    const items = await staleItems([{ id: 5, name: 'A', description: 'x' }, { id: 6, name: 'B', description: 'y' }, { id: 7, name: 'C', description: 'z' }])
    let checks = 0
    const r = await fa.runFactsPaced({ db, ai, model: 'deepseek', clock: fakeClock(), state: { lastStartAt: 0 }, budgetOk: async () => ++checks <= 2 }, items, { maxItems: 5 })
    assert.equal(r.stopped, 'budget')
    assert.equal(r.done, 1)
    assert.deepEqual(r.failed, [{ id: 5, reason: 'empty' }])
    const events = fa.factsRunLogEvents(r, 'button')
    assert.equal(events.filter(e => e.ref === 'ürün #5').length, 1)
    assert.ok(events.some(e => e.level === 'info' && /bütçe/.test(e.message)))
})

test('facts: a database write failure stops the run (it would fail for every product)', async () => {
    const db = fakeD1() // no ai_product_facts table
    const ai = fakeAi(() => 'Kutu: adaptör; Güç: 20W')
    const r = await fa.runFactsPaced({ db, ai, model: 'deepseek', clock: fakeClock(), state: { lastStartAt: 0 } }, await staleItems([
        { id: 1, name: 'A', description: 'x' }, { id: 2, name: 'B', description: 'y' },
    ]), { maxItems: 5 })
    assert.equal(r.stopped, 'db')
    assert.equal(ai.calls, 1)
})

// ---------------------------------------------------------------------------------------------
// Image variants
// ---------------------------------------------------------------------------------------------

test('images: collectReferencedImages finds what the storefront shows, once per key, logo first', () => {
    const { refs, unsupported } = iv.collectReferencedImages({
        logoUrl: '/api/images/1700000000000-ab12cd34-logo.png',
        heroSlides: [{ title: 'Kampanya', image_url: 'https://images.onopostore.com/1700000000001-hero.jpg' }],
        imageCards: [{ title: 'Kart', config: JSON.stringify({ image_url: '/api/images/1700000000002-card.webp' }) }],
        products: [
            { id: 1, name: 'Eski', images: JSON.stringify(['/api/images/1700000000003-a.jpg', 'https://example.com/x.jpg']) },
            { id: 9, name: 'Yeni', images: ['/api/images/1700000000004-b.png', '/api/images/1700000000003-a.jpg', '/api/images/anim.gif'] },
            { id: 4, name: 'Bozuk', images: 'not json' },
        ],
    })
    assert.deepEqual(refs.map(r => r.key), [
        '1700000000000-ab12cd34-logo.png',
        '1700000000001-hero.jpg',
        '1700000000002-card.webp',
        '1700000000004-b.png',
        '1700000000003-a.jpg',
    ])
    assert.equal(refs[0].keepTransparency, true)
    assert.equal(refs[1].keepTransparency, false)
    assert.equal(refs[4].uses.length, 2, 'used by two products, listed once')
    assert.deepEqual(unsupported, ['anim.gif'])
})

function fakeBucket(objects = {}) {
    const store = new Map(Object.entries(objects))
    const puts = []
    return {
        store,
        puts,
        async get(key) {
            if (!store.has(key)) return null
            const v = store.get(key)
            const bytes = v.bytes ?? new Uint8Array([1, 2, 3]).buffer
            return { size: v.size ?? bytes.byteLength, httpMetadata: { contentType: v.contentType ?? 'image/jpeg' }, arrayBuffer: async () => bytes }
        },
        async put(key, value, options) {
            puts.push({ key, size: value.byteLength, options })
            if (options?.onlyIf?.get?.('If-None-Match') === '*' && store.has(key)) return null
            store.set(key, { bytes: value })
            return { key }
        },
        async list({ prefix, cursor, limit = 1000 }) {
            const keys = [...store.keys()].filter(k => k.startsWith(prefix)).sort()
            const start = cursor ? Number(cursor) : 0
            const page = keys.slice(start, start + Math.min(limit, 2)) // tiny pages: paging is exercised
            const next = start + page.length
            return { objects: page.map(key => ({ key })), truncated: next < keys.length, cursor: next < keys.length ? String(next) : undefined }
        },
    }
}

function fakeImages({ failWith } = {}) {
    const calls = []
    return {
        calls,
        input() {
            const transforms = []
            const chain = {
                transform(o) { transforms.push(o); return chain },
                async output(o) {
                    calls.push({ transforms, output: o })
                    if (failWith) throw failWith
                    return { response: () => new Response(new Uint8Array([9, 9, 9, 9])) }
                },
            }
            return chain
        },
    }
}

test('images: existing variants are listed with paging and only missing widths are selected', async () => {
    const bucket = fakeBucket({
        'k1.png': {}, 'v/200/k1.png.webp': {}, 'v/400/k1.png.webp': {}, 'v/800/k1.png.webp': {}, 'v/1200/k1.png.webp': {},
        'k2.jpg': {}, 'v/200/k2.jpg.webp': {}, 'v/400/x.webp': {}, 'v/400/y.webp': {},
    })
    const existing = await iv.listExistingVariants(bucket)
    assert.ok(existing.has('v/1200/k1.png.webp') && existing.has('v/400/y.webp'))
    const missing = iv.selectMissing([{ key: 'k1.png', uses: [], keepTransparency: false }, { key: 'k2.jpg', uses: [], keepTransparency: false }], existing)
    assert.deepEqual(missing.map(m => [m.ref.key, m.widths]), [['k2.jpg', [400, 800, 1200]]])
})

test('images: createVariants makes WebP at each width (scale-down, white background) with the upload headers', async () => {
    const bucket = fakeBucket({ 'p.jpg': {}, 'v/200/p.jpg.webp': {} })
    const images = fakeImages()
    const r = await iv.createVariants({ bucket, images }, { key: 'p.jpg' })
    assert.deepEqual(r.stored, [400, 800, 1200])
    assert.deepEqual(r.existed, [200], 'an existing variant is never replaced')
    assert.equal(r.failed, null)
    assert.deepEqual(images.calls.map(c => c.transforms[0].width), [200, 400, 800, 1200])
    assert.equal(images.calls[0].transforms[0].fit, 'scale-down')
    assert.equal(images.calls[0].transforms[0].background, '#ffffff')
    assert.deepEqual(images.calls[0].output, { format: 'image/webp', quality: 80 })
    const put = bucket.puts.find(p => p.key === 'v/400/p.jpg.webp')
    assert.equal(put.options.httpMetadata.contentType, 'image/webp')
    assert.equal(put.options.httpMetadata.cacheControl, 'public, max-age=31536000, immutable')
    assert.equal(put.options.onlyIf.get('If-None-Match'), '*')
})

test('images: the logo keeps transparency; an upload uses the bytes in memory', async () => {
    const bucket = fakeBucket()
    const images = fakeImages()
    const r = await iv.createVariants({ bucket, images }, { key: 'logo.png', keepTransparency: true }, [200, 400], { bytes: new Uint8Array([1, 2]).buffer, contentType: 'image/png' })
    assert.deepEqual(r.stored, [200, 400])
    assert.equal(images.calls[0].transforms[0].background, undefined)
    const svg = await iv.createVariants({ bucket, images }, { key: 'logo.svg' }, [200], { bytes: new Uint8Array([1]).buffer, contentType: 'image/svg+xml' })
    assert.equal(svg.failed.reason, 'unsupported')
})

test('images: the sweep skips a missing original, stops on 9422 and logs both', async () => {
    const bucket = fakeBucket({ 'b.jpg': {} })
    const refs = [{ key: 'gone.jpg', uses: ['Ürün #3'], keepTransparency: false }, { key: 'b.jpg', uses: ['Ürün #2'], keepTransparency: false }]
    const okRun = await iv.runVariantSweep({ bucket, images: fakeImages(), clock: fakeClock() }, refs)
    assert.equal(okRun.missingImages, 2)
    assert.equal(okRun.done, 1)
    assert.equal(okRun.failed[0].reason, 'original_missing')
    assert.equal(okRun.stopped, 'done')
    const ev = iv.sweepLogEvents(okRun)
    assert.equal(ev.length, 1)
    assert.equal(ev[0].ref, 'gone.jpg')
    assert.equal(ev[0].source, 'images')

    // Nothing missing any more for b.jpg; c.jpg hits the monthly quota
    bucket.store.set('c.jpg', {})
    const quota = await iv.runVariantSweep(
        { bucket, images: fakeImages({ failWith: new Error('IMAGES_TRANSFORM_ERROR 9422: usage limit reached') }), clock: fakeClock() },
        [{ key: 'b.jpg', uses: [], keepTransparency: false }, { key: 'c.jpg', uses: [], keepTransparency: false }, { key: 'd.jpg', uses: [], keepTransparency: false }],
    )
    assert.equal(quota.missingImages, 2, 'b.jpg already has all four')
    assert.equal(quota.stopped, 'quota')
    assert.equal(quota.remaining, 2)
    const qe = iv.sweepLogEvents(quota)
    assert.ok(qe.some(e => e.level === 'error' && /5\.000/.test(e.message)))
})

test('images: classifyImagesError', () => {
    assert.equal(iv.classifyImagesError(new Error('9422 limit')), 'quota')
    assert.equal(iv.classifyImagesError(new Error('9432 legacy')), 'billing')
    assert.equal(iv.classifyImagesError(new Error('9520 format')), 'unsupported')
    assert.equal(iv.classifyImagesError(new Error('9529 timed out')), 'transient')
    assert.equal(iv.classifyImagesError(new Error('weird')), 'other')
})

// ---------------------------------------------------------------------------------------------
// System log
// ---------------------------------------------------------------------------------------------

test('system log: the same source + message + ref within 24 h is one row with a count', async () => {
    sl.resetSystemLogMemo()
    const db = fakeD1()
    const t0 = new Date('2026-10-22T07:00:00Z')
    const e = { source: 'images', level: 'error', message: 'Görsel yapılamadı', ref: 'a.jpg', detail: 'ilk' }
    await sl.logSystemEvent(db, e, t0)
    await sl.logSystemEvent(db, { ...e, detail: 'ikinci' }, new Date(t0.getTime() + 3600_000))
    await sl.logSystemEvent(db, { ...e, ref: 'b.jpg' }, new Date(t0.getTime() + 3600_000))
    await sl.logSystemEvent(db, { source: 'cron', level: 'warn', message: 'refsiz' }, t0)
    await sl.logSystemEvent(db, { source: 'cron', level: 'warn', message: 'refsiz' }, new Date(t0.getTime() + 60_000))
    let rows = await sl.listSystemLogs(db)
    assert.equal(rows.length, 3)
    const a = rows.find(r => r.ref === 'a.jpg')
    assert.equal(a.count, 2)
    assert.equal(a.detail, 'ikinci')
    assert.equal(a.last_at, new Date(t0.getTime() + 3600_000).toISOString())
    assert.equal(a.created_at, t0.toISOString())
    assert.equal(rows.find(r => r.message === 'refsiz').count, 2)

    // After 24 h without it: a new row
    await sl.logSystemEvent(db, e, new Date(t0.getTime() + 3600_000 + DAY + 1))
    rows = await sl.listSystemLogs(db, { source: 'images' })
    assert.equal(rows.filter(r => r.ref === 'a.jpg').length, 2)
    assert.equal(rows[0].ref, 'a.jpg', 'newest first')
})

test('system log: Çözüldü hides an entry until it happens again; counts per level', async () => {
    sl.resetSystemLogMemo()
    const db = fakeD1()
    const t0 = new Date('2026-10-22T07:00:00Z')
    await sl.logSystemEvent(db, { source: 'facts', level: 'error', message: 'Yazılamadı', ref: 'ürün #1' }, t0)
    await sl.logSystemEvent(db, { source: 'facts', level: 'warn', message: 'Yoğun' }, t0)
    assert.deepEqual(await sl.countUnresolved(db), { error: 1, warn: 1, info: 0 })
    const [row] = await sl.listSystemLogs(db, { level: 'error' })
    assert.equal(await sl.resolveSystemLog(db, row.id, new Date(t0.getTime() + 1000)), true)
    assert.equal(await sl.resolveSystemLog(db, 999), false)
    assert.deepEqual(await sl.countUnresolved(db), { error: 0, warn: 1, info: 0 })
    assert.equal((await sl.listSystemLogs(db)).length, 1)
    assert.equal((await sl.listSystemLogs(db, { includeResolved: true })).length, 2)
    // Happens again: back in the list, same row
    await sl.logSystemEvent(db, { source: 'facts', level: 'error', message: 'Yazılamadı', ref: 'ürün #1' }, new Date(t0.getTime() + 2000))
    const again = await sl.listSystemLogs(db, { level: 'error' })
    assert.equal(again.length, 1)
    assert.equal(again[0].id, row.id)
    assert.equal(again[0].count, 2)
    assert.equal(again[0].resolved_at, null)
    await sl.resolveAllSystemLogs(db, 'facts')
    assert.deepEqual(await sl.countUnresolved(db), { error: 0, warn: 0, info: 0 })
})

test('system log: rows older than 90 days are pruned lazily; bad input and a broken database never throw', async () => {
    sl.resetSystemLogMemo()
    const db = fakeD1()
    const old = new Date('2026-06-01T00:00:00Z')
    await sl.logSystemEvent(db, { source: 'cron', level: 'error', message: 'eski' }, old)
    sl.resetSystemLogMemo() // a new isolate: prunes on its first event
    await sl.logSystemEvent(db, { source: 'cron', level: 'info', message: 'yeni' }, new Date('2026-10-22T07:00:00Z'))
    const rows = await sl.listSystemLogs(db, { includeResolved: true })
    assert.deepEqual(rows.map(r => r.message), ['yeni'])

    // Unknown source/level fall back; an empty message is ignored; long text is clipped
    await sl.logSystemEvent(db, { source: 'nope', level: 'loud', message: 'x'.repeat(1000) })
    await sl.logSystemEvent(db, { source: 'cron', level: 'info', message: '   ' })
    const other = await sl.listSystemLogs(db, { source: 'other' })
    assert.equal(other.length, 1)
    assert.equal(other[0].level, 'error')
    assert.ok(other[0].message.length <= 300)

    sl.resetSystemLogMemo()
    const broken = { prepare() { throw new Error('D1 down') } }
    await assert.doesNotReject(sl.logSystemEvent(broken, { source: 'facts', level: 'error', message: 'x' }))
    await assert.doesNotReject(sl.logSystemEvent(null, { source: 'facts', level: 'error', message: 'x' }))
})

test('system log: the table in schema.sql matches the lazy ensure', async () => {
    const { readFileSync } = await import('node:fs')
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
    assert.match(schema, /CREATE TABLE IF NOT EXISTS system_logs \(/)
    const cols = s => [...s.matchAll(/^\s+(\w+) (INTEGER|TEXT)/gm)].map(m => m[1])
    const fromSchema = cols(schema.slice(schema.indexOf('CREATE TABLE IF NOT EXISTS system_logs')).split(');')[0])
    const fromCode = cols(sl.SYSTEM_LOG_TABLE_STATEMENTS[0])
    assert.deepEqual(fromSchema, fromCode)
})
