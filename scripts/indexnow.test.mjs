// IndexNow (lib/indexnow.ts): which URLs are sent, the POST body, the production gate, failure logging, the
// admin-save URL list, the daily sweep (indexnow_urls), the key file served by worker.ts and the cron step.
// Run: node --test scripts/indexnow.test.mjs   (Node 23.6+; node:sqlite stands in for D1). No network: fetch is a
// fake, the OpenNext handler too.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

// worker.ts imports the generated ./.open-next/worker.js: a fake that forwards to globalThis.__next
const FAKE_OPEN_NEXT = 'data:text/javascript,' + encodeURIComponent(
    'export default { fetch: (request, env, ctx) => globalThis.__next(request, env, ctx) };' +
    'export class DOQueueHandler {}; export class DOShardedTagCache {}; export class BucketCachePurge {};',
)
const ROOT = new URL('../', import.meta.url)
registerHooks({
    resolve(specifier, context, next) {
        if (specifier.endsWith('.open-next/worker.js')) return { url: FAKE_OPEN_NEXT, shortCircuit: true }
        let spec = specifier.startsWith('@/') ? new URL(specifier.slice(2), ROOT).href : specifier
        if ((spec.startsWith('.') || spec.startsWith('file:')) && !/\.[cm]?[jt]sx?$/.test(spec)) {
            for (const ext of ['.ts', '.tsx', '/index.ts']) {
                const url = new URL(spec + ext, context.parentURL)
                if (existsSync(fileURLToPath(url))) return next(url.href, context)
            }
        }
        return next(spec, context)
    },
})

const ix = await import('../lib/indexnow.ts')
const sl = await import('../lib/system-log.ts')
const { isCacheableRequest } = await import('../lib/edge-cache.ts')
const { isLiveTarget, resolvePath, buildIndex } = await import('../lib/redirects.ts')
const { RESERVED_SLUGS } = await import('../lib/seo-routing.ts')

/** D1 on node:sqlite: prepare → bind → run/all/first, like the real binding. */
function fakeD1(setup = '') {
    const raw = new DatabaseSync(':memory:')
    if (setup) raw.exec(setup)
    const stmt = (sql, binds = []) => ({
        bind: (...values) => stmt(sql, values),
        async run() { const r = raw.prepare(sql).run(...binds); return { meta: { changes: Number(r.changes) } } },
        async all() { return { results: raw.prepare(sql).all(...binds).map(r => ({ ...r })) } },
        async first() { const r = raw.prepare(sql).get(...binds); return r ? { ...r } : null },
    })
    return { prepare: sql => stmt(sql), raw }
}

/** A fetch that records every call and answers `status` (or throws `error`). */
function fakeFetch({ status = 200, error = null } = {}) {
    const calls = []
    const fn = async (url, init) => {
        calls.push({ url, init, body: JSON.parse(init.body) })
        if (error) throw error
        return { status, ok: status >= 200 && status < 300 }
    }
    return { fn, calls }
}

const KEY = '0123456789abcdef0123456789abcdef'
const PROD = { key: KEY, host: 'onopostore.com', nodeEnv: 'production' }
const logs = db => db.raw.prepare('SELECT source, level, message, detail, count FROM system_logs ORDER BY id').all().map(r => ({ ...r }))

test.beforeEach(() => {
    ix.resetIndexNowMemo()
    sl.resetSystemLogMemo()
})

// ---------------------------------------------------------------------------------------------
// URLs and payload
// ---------------------------------------------------------------------------------------------

test('canonicalSubmitUrls: absolute canonical URLs only, de-duplicated, in order', () => {
    assert.deepEqual(ix.canonicalSubmitUrls([
        '/kategori/sarj/',
        'https://onopostore.com/kategori/sarj/',
        'https://onopostore.com/x/',
        '/products/?page=2',
        '/products/#a',
        'https://www.onopostore.com/x/',
        'http://onopostore.com/x/',
        'https://evil.example/x/',
        '//evil.example/x/',
        '/sepet',
        '/llms.txt',
        '/api/products/',
        '/admin/',
        '',
        null,
        '/rehber/powerbank-secimi-mah-ve-cikis-gucu/',
    ]), [
        'https://onopostore.com/kategori/sarj/',
        'https://onopostore.com/x/',
        'https://onopostore.com/rehber/powerbank-secimi-mah-ve-cikis-gucu/',
    ])
})

test('canonicalSubmitUrls: at most 10000 URLs per POST', () => {
    const many = Array.from({ length: 10_050 }, (_, i) => `/p-${i}/`)
    assert.equal(ix.canonicalSubmitUrls(many).length, ix.INDEXNOW_MAX_URLS)
})

test('submitUrls: one POST to api.indexnow.org with host, key, keyLocation and urlList', async () => {
    const f = fakeFetch()
    const r = await ix.submitUrls(['/a/', '/a/', '/kategori/b/'], { ...PROD, fetch: f.fn })
    assert.deepEqual(r, { status: 'sent', count: 2, http: 200 })
    assert.equal(f.calls.length, 1)
    assert.equal(f.calls[0].url, 'https://api.indexnow.org/indexnow')
    assert.equal(f.calls[0].init.method, 'POST')
    assert.match(f.calls[0].init.headers['Content-Type'], /^application\/json/)
    assert.deepEqual(f.calls[0].body, {
        host: 'onopostore.com',
        key: KEY,
        keyLocation: `https://onopostore.com/${KEY}.txt`,
        urlList: ['https://onopostore.com/a/', 'https://onopostore.com/kategori/b/'],
    })
})

test('submitUrls: 202 (key not verified yet) counts as accepted', async () => {
    const f = fakeFetch({ status: 202 })
    assert.equal((await ix.submitUrls(['/a/'], { ...PROD, fetch: f.fn })).status, 'sent')
})

test('submitUrls: nothing is sent outside production', async () => {
    const f = fakeFetch()
    const cases = [
        { ...PROD, key: '' },
        { ...PROD, key: undefined },
        { ...PROD, key: 'kısa' },
        { ...PROD, host: '127.0.0.1' },
        { ...PROD, host: 'localhost' },
        { ...PROD, host: 'onopo-app.example.workers.dev' },
        { ...PROD, host: null },
        { ...PROD, nodeEnv: 'development' },
    ]
    for (const gate of cases) {
        assert.deepEqual(await ix.submitUrls(['/a/'], { ...gate, fetch: f.fn }), { status: 'skipped' }, JSON.stringify(gate))
    }
    assert.equal(f.calls.length, 0)
    // www is the same site (admin saves may come from www)
    assert.equal(ix.indexNowEnabled({ ...PROD, host: 'www.onopostore.com' }), true)
})

test('submitUrls: no valid URL, no POST', async () => {
    const f = fakeFetch()
    assert.deepEqual(await ix.submitUrls(['/llms.txt', 'https://evil.example/'], { ...PROD, fetch: f.fn }), { status: 'empty' })
    assert.equal(f.calls.length, 0)
})

// ---------------------------------------------------------------------------------------------
// Failures
// ---------------------------------------------------------------------------------------------

test('submitUrls: a refused POST is logged once per day (source indexnow), never thrown', async () => {
    const db = fakeD1()
    const f = fakeFetch({ status: 403 })
    const now = new Date('2026-10-22T07:00:00Z')
    const r1 = await ix.submitUrls(['/a/'], { ...PROD, fetch: f.fn, db, now })
    const r2 = await ix.submitUrls(['/b/'], { ...PROD, fetch: f.fn, db, now: new Date('2026-10-22T09:00:00Z') })
    assert.deepEqual(r1, { status: 'failed', count: 1, http: 403 })
    assert.equal(r2.status, 'failed')
    const rows = logs(db)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].source, 'indexnow')
    assert.equal(rows[0].level, 'warn')
    assert.equal(rows[0].count, 2)
    assert.match(rows[0].detail, /HTTP 403 \(anahtar doğrulanamadı/)
})

test('submitUrls: a network error is logged and answered as failed', async () => {
    const db = fakeD1()
    const f = fakeFetch({ error: new Error('connect timeout') })
    const r = await ix.submitUrls(['/a/'], { ...PROD, fetch: f.fn, db, record: true })
    assert.deepEqual(r, { status: 'failed', count: 1 })
    const rows = logs(db)
    assert.equal(rows.length, 1)
    assert.match(rows[0].message, /gönderilemedi/)
    assert.equal(rows[0].detail, 'connect timeout')
    // Nothing recorded as sent
    assert.equal((await ix.loadSubmitted(db)).size, 0)
})

test('submitUrls: without a database a failure still never throws', async () => {
    const f = fakeFetch({ status: 500 })
    assert.equal((await ix.submitUrls(['/a/'], { ...PROD, fetch: f.fn })).status, 'failed')
})

// ---------------------------------------------------------------------------------------------
// Admin saves: the URLs of a change
// ---------------------------------------------------------------------------------------------

const CATALOG = `
    CREATE TABLE products (id INTEGER PRIMARY KEY, slug TEXT, name TEXT, category TEXT, is_active INTEGER, updated_at TEXT, created_at TEXT);
    CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT, slug TEXT);
    INSERT INTO categories VALUES (1, 'Cep Telefonu Aksesuarları', 'cep-telefonu-aksesuarlari'), (2, 'Çok Satanlar', 'ok-satanlar');
    INSERT INTO products VALUES (10, 'onopo-t67-kablo', 'Onopo T67', 'Cep Telefonu Aksesuarları', 1, '2026-10-20 10:00:00', '2026-01-01 00:00:00');
    INSERT INTO products VALUES (11, 'onopo-powerbank', 'Onopo Powerbank', 'çok satanlar', 0, NULL, '2026-01-01 00:00:00');
`

test('pathsForChange: product page, its listing, the old listing and extra paths; unknown ids/names skipped', async () => {
    const db = fakeD1(CATALOG)
    assert.deepEqual(await ix.pathsForChange(db, {
        productIds: [10, 11, 999, NaN, null],
        categories: ['Çok Satanlar', 'yok', '', null],
        paths: ['/products/', null],
    }), [
        '/onopo-t67-kablo/',
        '/onopo-powerbank/',
        // the named category (Turkish case-folded), then the products' own ones, without repeats
        '/kategori/ok-satanlar/',
        '/kategori/cep-telefonu-aksesuarlari/',
        '/products/',
    ])
})

test('submitUrls with record: accepted URLs are remembered for the daily sweep', async () => {
    const db = fakeD1()
    const f = fakeFetch()
    const now = new Date('2026-10-22T12:00:00Z')
    await ix.submitUrls(['/a/', '/b/'], { ...PROD, fetch: f.fn, db, record: true, now })
    const sent = await ix.loadSubmitted(db)
    assert.deepEqual([...sent], [['https://onopostore.com/a/', now.toISOString()], ['https://onopostore.com/b/', now.toISOString()]])
})

// ---------------------------------------------------------------------------------------------
// Daily sweep
// ---------------------------------------------------------------------------------------------

const sitemap = (overrides = {}) => [
    { url: 'https://onopostore.com/', lastModified: '2026-10-20T10:00:00.000Z' },
    { url: 'https://onopostore.com/onopo-t67-kablo/', lastModified: '2026-10-20T10:00:00.000Z' },
    { url: 'https://onopostore.com/rehber/', lastModified: '2026-10-22' },
    { url: 'https://onopostore.com/page/shipping/' },
    ...Object.entries(overrides).map(([url, lastModified]) => ({ url, lastModified })),
]

test('sweep: first run sends the whole sitemap, a second run nothing', async () => {
    const db = fakeD1()
    const f = fakeFetch()
    const r1 = await ix.sweepIndexNow(db, sitemap(), { ...PROD, fetch: f.fn, now: new Date('2026-10-22T07:00:00Z') })
    assert.deepEqual(r1, { status: 'sent', changed: 4, removed: 0 })
    assert.equal(f.calls.length, 1)
    assert.equal(f.calls[0].body.urlList.length, 4)
    const r2 = await ix.sweepIndexNow(db, sitemap(), { ...PROD, fetch: f.fn, now: new Date('2026-10-23T07:00:00Z') })
    assert.deepEqual(r2, { status: 'empty', changed: 0, removed: 0 })
    assert.equal(f.calls.length, 1)
})

test('sweep: new and changed URLs, and URLs gone from the sitemap (then forgotten)', async () => {
    const db = fakeD1()
    const f = fakeFetch()
    await ix.sweepIndexNow(db, [...sitemap(), { url: 'https://onopostore.com/silinen-urun/', lastModified: '2026-01-01T00:00:00Z' }], { ...PROD, fetch: f.fn, now: new Date('2026-10-22T07:00:00Z') })
    const next = sitemap({ 'https://onopostore.com/kategori/yeni/': '2026-10-22T20:00:00Z' })
    next[1].lastModified = '2026-10-22T15:00:00.000Z' // product saved after the last run
    const r = await ix.sweepIndexNow(db, next, { ...PROD, fetch: f.fn, now: new Date('2026-10-23T07:00:00Z') })
    assert.deepEqual(r, { status: 'sent', changed: 2, removed: 1 })
    assert.deepEqual(f.calls[1].body.urlList, [
        'https://onopostore.com/onopo-t67-kablo/',
        'https://onopostore.com/kategori/yeni/',
        'https://onopostore.com/silinen-urun/',
    ])
    assert.equal((await ix.loadSubmitted(db)).has('https://onopostore.com/silinen-urun/'), false)
    assert.equal((await ix.sweepIndexNow(db, next, { ...PROD, fetch: f.fn, now: new Date('2026-10-24T07:00:00Z') })).status, 'empty')
})

test('sweep: an admin save already sent the URL, so the sweep skips it', async () => {
    const db = fakeD1()
    const f = fakeFetch()
    await ix.sweepIndexNow(db, sitemap(), { ...PROD, fetch: f.fn, now: new Date('2026-10-22T07:00:00Z') })
    // Saved at 15:00:00 (updated_at), sent by the admin route a moment later
    await ix.submitUrls(['/onopo-t67-kablo/'], { ...PROD, fetch: f.fn, db, record: true, now: new Date('2026-10-22T15:00:02Z') })
    const next = sitemap()
    next[1].lastModified = '2026-10-22T15:00:00.000Z'
    assert.equal((await ix.sweepIndexNow(db, next, { ...PROD, fetch: f.fn, now: new Date('2026-10-23T07:00:00Z') })).status, 'empty')
})

test('sweep: a refused POST changes nothing, so the next day retries', async () => {
    const db = fakeD1()
    const refused = fakeFetch({ status: 429 })
    const r = await ix.sweepIndexNow(db, sitemap(), { ...PROD, fetch: refused.fn, now: new Date('2026-10-22T07:00:00Z') })
    assert.equal(r.status, 'failed')
    assert.equal((await ix.loadSubmitted(db)).size, 0)
    assert.equal(logs(db).length, 1)
    const ok = fakeFetch()
    assert.equal((await ix.sweepIndexNow(db, sitemap(), { ...PROD, fetch: ok.fn })).status, 'sent')
})

test('sweep: off outside production (no table read, no POST)', async () => {
    const db = fakeD1()
    const f = fakeFetch()
    assert.deepEqual(await ix.sweepIndexNow(db, sitemap(), { ...PROD, host: '127.0.0.1', fetch: f.fn }), { status: 'skipped', changed: 0, removed: 0 })
    assert.equal(f.calls.length, 0)
})

// ---------------------------------------------------------------------------------------------
// Key file, wrangler.toml, routing tables
// ---------------------------------------------------------------------------------------------

test('key file: exactly the key as text/plain, GET and HEAD only', async () => {
    const res = ix.indexNowKeyFileResponse(`/${KEY}.txt`, 'GET', KEY)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /^text\/plain/)
    assert.equal(await res.text(), KEY)
    assert.equal(await ix.indexNowKeyFileResponse(`/${KEY}.txt`, 'HEAD', KEY).text(), '')
    assert.equal(ix.indexNowKeyFileResponse(`/${KEY}.txt`, 'POST', KEY), null)
    assert.equal(ix.indexNowKeyFileResponse('/baska.txt', 'GET', KEY), null)
    assert.equal(ix.indexNowKeyFileResponse('/.txt', 'GET', ''), null)
    assert.equal(ix.indexNowKeyFileResponse('/undefined.txt', 'GET', undefined), null)
})

test('wrangler.toml: INDEXNOW_KEY is a 32-character hex key', () => {
    const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8')
    const m = /^INDEXNOW_KEY\s*=\s*"([^"]*)"/m.exec(toml)
    assert.ok(m, 'INDEXNOW_KEY missing from [vars]')
    assert.match(m[1], /^[0-9a-f]{32}$/)
    assert.equal(ix.isValidIndexNowKey(m[1]), true)
})

test('/llms.txt: edge-cacheable, a live redirect target, reserved, never guessed to be a product', async () => {
    const req = (path, headers = {}) => ({ method: 'GET', url: new URL(`https://onopostore.com${path}`), headers: new Headers(headers) })
    assert.equal(isCacheableRequest(req('/llms.txt')), true)
    assert.equal(isCacheableRequest(req('/llms.txt', { cookie: 'auth_token=x' })), false)
    const index = buildIndex({ products: [{ id: 1, slug: 'llms-rehberi', name: 'LLMS Rehberi', images: '[]' }], categories: [], pages: [] })
    assert.equal(isLiveTarget('/llms.txt', index), true)
    assert.ok(RESERVED_SLUGS.includes('llms.txt'))
    // A 404 under the name of the file is never guessed to be a product
    assert.equal(await resolvePath('/llms.txt', { index }), null)
})

// ---------------------------------------------------------------------------------------------
// worker.ts: key file and the cron step
// ---------------------------------------------------------------------------------------------

const nextCalls = []
let automationStatus = 200
globalThis.__next = async request => {
    const url = new URL(request.url)
    nextCalls.push(`${request.method} ${url.pathname}${url.search}`)
    if (url.pathname === '/api/cron/update-prices/') return new Response('{"ok":true}', { status: 200 })
    if (url.pathname === '/api/cron/automation/') {
        const job = url.searchParams.get('job')
        return new Response(JSON.stringify({ job }), { status: job === 'indexnow' ? automationStatus : 200 })
    }
    return new Response('<html>404</html>', { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } })
}
globalThis.caches = { default: { async match() { return undefined }, async put() {} } }
const workerDb = fakeD1('CREATE TABLE site_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);')
const workerEnv = {
    DB: workerDb,
    INDEXNOW_KEY: KEY,
    CRON_SECRET: 'test-secret',
    NEXT_PUBLIC_BASE_URL: 'https://onopostore.com',
    ASSETS: { async fetch() { return new Response('test-build') } },
}
const pending = []
const ctx = { waitUntil: p => pending.push(p), passThroughOnException() {} }
const { default: worker } = await import('../worker.ts')

test('worker: /<key>.txt is answered by the Worker itself (Next never sees it), with HSTS', async () => {
    nextCalls.length = 0
    const res = await worker.fetch(new Request(`https://onopostore.com/${KEY}.txt`), workerEnv, ctx)
    assert.equal(res.status, 200)
    assert.equal(await res.text(), KEY)
    assert.equal(res.headers.get('strict-transport-security'), 'max-age=31536000')
    assert.equal(res.headers.get('x-onopo-cache'), null)
    assert.deepEqual(nextCalls, [])
    // Another .txt is left to Next (and its 404 to the old-URL resolver)
    const other = await worker.fetch(new Request('https://onopostore.com/ffffffffffffffffffffffffffffffff.txt'), workerEnv, ctx)
    await Promise.all(pending.splice(0))
    assert.equal(other.status, 404)
    // Without a key nothing is served
    const off = await worker.fetch(new Request(`https://onopostore.com/${KEY}.txt`), { ...workerEnv, INDEXNOW_KEY: '' }, ctx)
    await Promise.all(pending.splice(0))
    assert.equal(off.status, 404)
})

test('cron: the IndexNow step runs after the review e-mails, and its failure does not stop the others', async () => {
    nextCalls.length = 0
    automationStatus = 500
    await worker.scheduled({ cron: '0 7 * * *' }, workerEnv, ctx)
    const jobs = nextCalls.filter(c => c.startsWith('POST /api/cron/automation/')).map(c => new URL(`https://x${c.slice(5)}`).searchParams.get('job'))
    assert.deepEqual(jobs, ['reviews', 'indexnow', 'images', 'facts'])
    const rows = workerDb.raw.prepare("SELECT source, ref FROM system_logs WHERE source = 'cron'").all().map(r => ({ ...r }))
    assert.deepEqual(rows, [{ source: 'cron', ref: 'indexnow' }])
    automationStatus = 200
})
