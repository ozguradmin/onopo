// HSTS from worker.ts: the real Worker entry with a fake OpenNext handler, a fake edge cache and D1 on node:sqlite.
// Every HTTPS response the Worker returns carries Strict-Transport-Security: max-age=31536000 (no
// includeSubDomains, no preload): pages, APIs and POSTs, edge-cache MISS and HIT, the www -> apex 301, the
// old-URL 301 and plain 404s. Plain-http responses do not (browsers ignore it there). Static assets get it from
// public/_headers (checked below). wrangler.toml keeps workers.dev and preview URLs off.
// Run: node --test scripts/worker-hsts.test.mjs   (Node 23.6+; node:sqlite)
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

/** D1 on node:sqlite: prepare → bind → run/all/first, like the real binding. */
function fakeD1() {
    const raw = new DatabaseSync(':memory:')
    const stmt = (sql, binds = []) => ({
        bind: (...values) => stmt(sql, values),
        async run() { raw.prepare(sql).run(...binds); return { meta: {} } },
        async all() { return { results: raw.prepare(sql).all(...binds).map(r => ({ ...r })) } },
        async first() { const r = raw.prepare(sql).get(...binds); return r ? { ...r } : null },
    })
    raw.exec(`
        CREATE TABLE site_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);
        CREATE TABLE products (id INTEGER PRIMARY KEY, slug TEXT, name TEXT, is_active INTEGER, images TEXT, category TEXT);
        CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT, slug TEXT);
        CREATE TABLE pages (slug TEXT);
        CREATE TABLE system_logs (id INTEGER PRIMARY KEY);
        INSERT INTO site_settings VALUES ('cache_version', 'v1', NULL);
        INSERT INTO products VALUES (1, 'onopo-10000-mah-powerbank', 'Onopo 10000 mAh Powerbank', 1, '[]', 'Cep Telefonu Aksesuarları');
    `)
    return { prepare: sql => stmt(sql) }
}

/** Workers Cache API stand-in (caches.default). */
const store = new Map()
globalThis.caches = {
    default: {
        async match(req) { const r = store.get(req.url); return r ? r.clone() : undefined },
        async put(req, res) { store.set(req.url, res) },
    },
}

const calls = []
globalThis.__next = async request => {
    const url = new URL(request.url)
    calls.push(`${request.method} ${url.pathname}`)
    if (url.pathname === '/products/') return new Response('<html><body>Tüm ürünler</body></html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
    if (url.pathname === '/api/orders/') return Response.json({ success: true })
    if (url.pathname === '/api/payment/callback/') return new Response('OK', { headers: { 'content-type': 'text/plain' } })
    if (url.pathname === '/rehber/') return new Response('<html><body><h1>Alışveriş rehberleri</h1></body></html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
    return new Response('<html>404</html>', { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

const env = {
    DB: fakeD1(),
    ASSETS: { async fetch(req) { return new URL(req.url).pathname === '/BUILD_ID' ? new Response('test-build') : new Response(null, { status: 404 }) } },
}
const pending = []
const ctx = { waitUntil: p => pending.push(p), passThroughOnException() {} }
const { default: worker } = await import('../worker.ts')
const { HSTS_VALUE, hstsHeader } = await import('../lib/edge-cache.ts')

const fetchWorker = async (url, init) => {
    const res = await worker.fetch(new Request(url, init), env, ctx)
    await Promise.all(pending.splice(0))
    return res
}
const HSTS = 'max-age=31536000'

test('hstsHeader: one year, this host only, https only', () => {
    assert.equal(HSTS_VALUE, HSTS)
    assert.doesNotMatch(HSTS_VALUE, /includeSubDomains|preload/i)
    assert.equal(hstsHeader(new URL('https://onopostore.com/')), HSTS)
    assert.equal(hstsHeader(new URL('https://www.onopostore.com/x/')), HSTS)
    assert.equal(hstsHeader(new URL('http://onopostore.com/api/x')), null)
    assert.equal(hstsHeader(new URL('http://127.0.0.1:8811/')), null)
})

test('worker: pages answer with HSTS on edge-cache MISS and HIT', async () => {
    const miss = await fetchWorker('https://onopostore.com/products/')
    assert.equal(miss.status, 200)
    assert.equal(miss.headers.get('x-onopo-cache'), 'MISS')
    assert.equal(miss.headers.get('strict-transport-security'), HSTS)
    assert.equal(await miss.text(), '<html><body>Tüm ürünler</body></html>')

    const hit = await fetchWorker('https://onopostore.com/products/')
    assert.equal(hit.headers.get('x-onopo-cache'), 'HIT')
    assert.equal(hit.headers.get('strict-transport-security'), HSTS)
    assert.equal(await hit.text(), '<html><body>Tüm ürünler</body></html>')

    const guides = await fetchWorker('https://onopostore.com/rehber/')
    assert.equal(guides.headers.get('x-onopo-cache'), 'MISS')
    assert.equal(guides.headers.get('strict-transport-security'), HSTS)
})

test('worker: canonical-host and old-URL redirects carry HSTS on https', async () => {
    const www = await fetchWorker('https://www.onopostore.com/products/?page=2')
    assert.equal(www.status, 301)
    assert.equal(www.headers.get('location'), 'https://onopostore.com/products/?page=2')
    assert.equal(www.headers.get('strict-transport-security'), HSTS)

    const old = await fetchWorker('https://onopostore.com/urun/onopo-10000-mah-powerbank/')
    assert.equal(old.status, 301)
    assert.equal(old.headers.get('location'), '/onopo-10000-mah-powerbank/')
    assert.equal(old.headers.get('strict-transport-security'), HSTS)

    const missing = await fetchWorker('https://onopostore.com/rehber/yok-boyle-rehber/')
    assert.equal(missing.status, 404)
    assert.equal(missing.headers.get('strict-transport-security'), HSTS)
})

test('worker: APIs and writes (checkout, payment callbacks) get the header too, with their bodies unchanged', async () => {
    const order = await fetchWorker('https://onopostore.com/api/orders/', { method: 'POST', body: '{}' })
    assert.equal(order.headers.get('strict-transport-security'), HSTS)
    assert.deepEqual(await order.json(), { success: true })

    const callback = await fetchWorker('https://onopostore.com/api/payment/callback/', { method: 'POST', body: 'x' })
    assert.equal(callback.headers.get('strict-transport-security'), HSTS)
    assert.equal(await callback.text(), 'OK')
})

test('worker: plain http answers without HSTS (the http -> https 301, http APIs)', async () => {
    const redirect = await fetchWorker('http://onopostore.com/products/')
    assert.equal(redirect.status, 301)
    assert.equal(redirect.headers.get('location'), 'https://onopostore.com/products/')
    assert.equal(redirect.headers.get('strict-transport-security'), null)

    const api = await fetchWorker('http://onopostore.com/api/payment/callback/', { method: 'POST', body: 'x' })
    assert.equal(api.headers.get('strict-transport-security'), null)
    assert.equal(await api.text(), 'OK')
})

test('static assets: public/_headers sends the same HSTS value to every path', () => {
    const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')
    assert.match(headers, /^\/\*\r?\n {2}Strict-Transport-Security: max-age=31536000\r?\n/m)
    const rules = headers.split(/\r?\n/).filter(line => !line.startsWith('#')).join('\n')
    assert.doesNotMatch(rules, /includeSubDomains|preload/i)
})

test('wrangler.toml: no workers.dev URL and no preview URLs', () => {
    const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8')
    assert.match(toml, /^workers_dev = false$/m)
    assert.match(toml, /^preview_urls = false$/m)
})
