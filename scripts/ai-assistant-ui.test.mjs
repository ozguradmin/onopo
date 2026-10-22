// Unit tests for the Onopo Asistan chat UI's pure modules (SPEC §13.2): components/assistant/chat-reducer.ts,
// persist.ts, page-context.ts, starters.ts, mini-markdown.ts, cart-ops.ts and sheet-drag.ts. No React, no npm packages.
// Run: node --test scripts/ai-assistant-ui.test.mjs   (Node 23.6+ strips the TypeScript types itself)
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

// The app imports '@/…' and extensionless relative paths ('./roundPrice'); resolve them to the .ts files.
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
const reducer = await import('../components/assistant/chat-reducer.ts')
const persist = await import('../components/assistant/persist.ts')
const page = await import('../components/assistant/page-context.ts')
const start = await import('../components/assistant/starters.ts')
const md = await import('../components/assistant/mini-markdown.ts')
const ops = await import('../components/assistant/cart-ops.ts')
const drag = await import('../components/assistant/sheet-drag.ts')

// Synthetic card product (no real product data)
const card = (id, over = {}) => ({
    id, slug: `urun-${id}`, href: `/urun-${id}/`, name: `Test Ürün ${id}`, code: null, price: 100 + id, displayPrice: 104.99,
    originalPrice: null, image: null, rating: null, freeShipping: false, inStock: true, hasVariations: false,
    isBestSeller: false, whatsappOrder: false, category: null, ...over,
})
const WA_BASE = 'https://wa.me/900000000000'

function fold(events) {
    return events.reduce(reducer.applyEvent, reducer.assistantMessage(1000))
}

// ---------------------------------------------------------------------------------------------
// chat-reducer
// ---------------------------------------------------------------------------------------------

test('chat-reducer: events build the assistant message', () => {
    const m = fold([
        { t: 'meta', turnId: 't1', mode: 'llm', waBase: WA_BASE },
        { t: 'step', id: 'understand', state: 'active' },
        { t: 'text', v: 'Sana uygun ' },
        { t: 'text', v: 'seçenekler şunlar:' },
        { t: 'device', v: 'iPhone 15' },
        { t: 'suggestions', chips: [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }] },
    ])
    assert.equal(m.role, 'assistant')
    assert.equal(m.text, 'Sana uygun seçenekler şunlar:')
    assert.equal(m.status, 'streaming')
    assert.deepEqual(m.steps, [{ id: 'understand', state: 'active' }])
    assert.equal(m.suggestions.length, 3)
})

test('chat-reducer: a step goes from active to done with its count', () => {
    let m = fold([{ t: 'step', id: 'search', state: 'active' }])
    m = reducer.applyEvent(m, { t: 'step', id: 'search', state: 'done', n: 12 })
    assert.deepEqual(m.steps, [{ id: 'search', state: 'done', n: 12 }])
    m = reducer.applyEvent(m, { t: 'step', id: 'prices', state: 'active' })
    assert.equal(m.steps.length, 2)
})

test('chat-reducer: cards keep their order and the first WhatsApp card wins', () => {
    const wa1 = { t: 'whatsapp', variant: 'full', reason: 'return', message: 'a', waBase: WA_BASE, productIds: [] }
    const wa2 = { ...wa1, variant: 'compact', reason: 'other', message: 'b' }
    const m = fold([
        { t: 'links', items: [] },
        { t: 'products', layout: 'single', products: [card(1)], moreHref: null, total: null },
        wa1,
        { t: 'store_info', rows: [], href: null },
        wa2,
    ])
    assert.deepEqual(m.cards.map(c => c.t), ['links', 'products', 'store_info'])
    assert.equal(m.whatsapp.message, 'a')
    assert.equal(m.wa, true)
})

test('chat-reducer: done sets the status, product ids and wa, and settles active steps', () => {
    const m = fold([
        { t: 'step', id: 'understand', state: 'active' },
        { t: 'text', v: 'Tamam.' },
        { t: 'done', finish: 'cards', productIds: [3, 4], wa: true },
    ])
    assert.equal(m.status, 'done')
    assert.deepEqual(m.productIds, [3, 4])
    assert.equal(m.wa, true)
    assert.deepEqual(m.steps, [{ id: 'understand', state: 'done' }])
    assert.equal(fold([{ t: 'done', finish: 'error', productIds: [], wa: false }]).status, 'error')
})

test('chat-reducer: an error event sets the error', () => {
    const m = fold([{ t: 'error', code: 'timeout' }])
    assert.deepEqual(m.error, { code: 'timeout' })
    const r = fold([{ t: 'error', code: 'rate_limited', retryAfter: 10 }, { t: 'done', finish: 'error', productIds: [], wa: false }])
    assert.deepEqual(r.error, { code: 'rate_limited', retryAfter: 10 })
    assert.equal(r.status, 'error')
})

test('chat-reducer: history holds finished text only, with shown products and the WhatsApp flag', () => {
    const u = reducer.userMessage('iPhone 15 için şarj aleti')
    const a = fold([{ t: 'text', v: 'Şunlar uygun.' }, { t: 'done', finish: 'cards', productIds: [7], wa: false }])
    const streaming = reducer.assistantMessage()
    const local = reducer.localCardMessage(reducer.localWhatsapp({ reason: 'human', summary: 'x', waBase: WA_BASE }))
    const h = reducer.toHistory([u, a, local, streaming])
    assert.deepEqual(h, [
        { role: 'user', text: 'iPhone 15 için şarj aleti' },
        { role: 'assistant', text: 'Şunlar uygun.', productIds: [7] },
    ])
    const many = Array.from({ length: 14 }, (_, i) => reducer.userMessage(`m${i}`))
    assert.equal(reducer.toHistory(many).length, 10)
    assert.equal(reducer.toHistory(many)[0].text, 'm4')
})

test('chat-reducer: a local WhatsApp card masks the summary and never prints the number', () => {
    const wa = reducer.localWhatsapp({ reason: 'product_request', summary: 'Numaram 0500 123 45 67', waBase: WA_BASE, product: card(5) })
    assert.equal(wa.t, 'whatsapp')
    assert.ok(!wa.message.includes('0500 123'))
    assert.ok(wa.message.includes('[telefon]'))
    assert.ok(!wa.message.includes('900000000000'))
    assert.deepEqual(wa.productIds, [5])
})

test('chat-reducer: the store WhatsApp fallback takes the first Turkish mobile number only', () => {
    // Synthetic numbers (555 is reserved for fiction), never a real one
    assert.equal(reducer.mobileWaBase('0555 000 00 00'), 'https://wa.me/905550000000')
    assert.equal(reducer.mobileWaBase('+90 (555) 000 00 00'), 'https://wa.me/905550000000')
    assert.equal(reducer.mobileWaBase('5550000000'), 'https://wa.me/905550000000')
    assert.equal(reducer.mobileWaBase('0090 555 000 0000'), 'https://wa.me/905550000000')
    // empty whatsapp_number → the footer phone; a landline is not usable
    assert.equal(reducer.mobileWaBase('', '0555 000 00 01'), 'https://wa.me/905550000001')
    assert.equal(reducer.mobileWaBase('0212 000 00 00'), null)
    assert.equal(reducer.mobileWaBase('0212 000 00 00', '0555 000 00 02'), 'https://wa.me/905550000002')
    assert.equal(reducer.mobileWaBase(null, undefined, ''), null)
    assert.equal(reducer.mobileWaBase('0555 000'), null)
})

test('chat-reducer: stale cards get the current price, and missing products are marked gone', () => {
    const m = fold([
        { t: 'products', layout: 'carousel', products: [card(1, { price: 100 }), card(2)], moreHref: null, total: 2 },
        { t: 'done', finish: 'cards', productIds: [1, 2], wa: false },
    ])
    const [patched] = reducer.patchStaleCards([m], [{ id: 1, price: 120, original_price: 150, stock: 0 }])
    const p = patched.cards[0].products
    assert.equal(p[0].price, 120)
    assert.equal(p[0].originalPrice, 150)
    assert.equal(p[0].inStock, false)
    assert.deepEqual(patched.stale, { 1: 'price', 2: 'gone' })
})

// ---------------------------------------------------------------------------------------------
// persist
// ---------------------------------------------------------------------------------------------

function memoryStorage() {
    const map = new Map()
    return {
        map,
        getItem: k => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: k => map.delete(k),
    }
}
const CONV = '6f1c2a9e-0000-4000-8000-000000000001'
const done = text => ({ ...reducer.userMessage(text), status: 'done' })

test('persist: saves at most 30 messages and drops streaming ones', () => {
    const s = memoryStorage()
    const messages = Array.from({ length: 40 }, (_, i) => done(`m${i}`))
    messages.push(reducer.assistantMessage())
    assert.equal(persist.saveChat(s, { conversationId: CONV, device: 'iPhone 15', messages }, 1_000), true)
    const back = persist.loadChat(s, 2_000)
    assert.equal(back.messages.length, 30)
    assert.equal(back.messages[29].text, 'm39')
    assert.ok(back.messages.every(m => m.status !== 'streaming'))
    assert.equal(back.device, 'iPhone 15')
    assert.equal(back.conversationId, CONV)
})

test('persist: running steps are not kept', () => {
    const s = memoryStorage()
    const m = { ...fold([{ t: 'step', id: 'search', state: 'done', n: 3 }, { t: 'step', id: 'prices', state: 'active' }]), status: 'stopped' }
    persist.saveChat(s, { conversationId: CONV, device: null, messages: [m] }, 0)
    assert.deepEqual(persist.loadChat(s, 0).messages[0].steps, [{ id: 'search', state: 'done', n: 3 }])
})

test('persist: reloads only within 2 hours', () => {
    const s = memoryStorage()
    persist.saveChat(s, { conversationId: CONV, device: null, messages: [done('a')] }, 0)
    assert.ok(persist.loadChat(s, 2 * 60 * 60 * 1000))
    assert.equal(persist.loadChat(s, 2 * 60 * 60 * 1000 + 1), null)
    assert.equal(s.map.size, 0) // the expired value is removed
})

test('persist: a corrupt value gives an empty state', () => {
    const s = memoryStorage()
    s.setItem(persist.STORAGE_KEY, '{not json')
    assert.equal(persist.loadChat(s), null)
    s.setItem(persist.STORAGE_KEY, JSON.stringify({ v: 2, conversationId: CONV, updatedAt: Date.now(), messages: [] }))
    assert.equal(persist.loadChat(s), null)
    s.setItem(persist.STORAGE_KEY, JSON.stringify({ v: 1, conversationId: CONV, updatedAt: Date.now(), messages: [{ id: 1 }, done('ok')] }))
    assert.deepEqual(persist.loadChat(s).messages.map(m => m.text), ['ok'])
})

test('persist: works against a storage that throws', () => {
    const throwing = {
        getItem() { throw new Error('SecurityError') },
        setItem() { throw new Error('QuotaExceededError') },
        removeItem() { throw new Error('SecurityError') },
    }
    assert.equal(persist.saveChat(throwing, { conversationId: CONV, device: null, messages: [done('a')] }), false)
    assert.equal(persist.loadChat(throwing), null)
    assert.doesNotThrow(() => persist.clearChat(throwing))
    assert.equal(persist.loadChat(null), null)
})

// ---------------------------------------------------------------------------------------------
// page-context
// ---------------------------------------------------------------------------------------------

test('page-context: paths map to page contexts', () => {
    assert.deepEqual(page.pageContext('/'), { type: 'home' })
    assert.deepEqual(page.pageContext('/kategori/x/'), { type: 'category', slug: 'x' })
    assert.deepEqual(page.pageContext('/products/', '?q=a&f=kablo'), { type: 'listing', query: 'a', facets: ['kablo'] })
    assert.deepEqual(page.pageContext('/products/', new URLSearchParams('f=kablo,type-c')), { type: 'listing', facets: ['kablo', 'type-c'] })
    assert.deepEqual(page.pageContext('/page/help/'), { type: 'page', slug: 'help' })
    assert.deepEqual(page.pageContext('/onopo-67w/'), { type: 'product', slug: 'onopo-67w' })
    assert.deepEqual(page.pageContext('/odeme/'), { type: 'other' })
    assert.deepEqual(page.pageContext('/profile/'), { type: 'other' })
    assert.deepEqual(page.pageContext('/product/12/'), { type: 'other' })
    assert.deepEqual(page.pageContext('/Büyük-Harf/'), { type: 'other' })
    assert.equal(page.pageContext('/products/', `?q=${'a'.repeat(150)}`).query.length, 100)
    assert.equal(page.isProductPath('/onopo-67w/'), true)
    assert.equal(page.isProductPath('/products/'), false)
})

test('page-context: cart ids take the leading product id and quantities are clamped', () => {
    assert.deepEqual(page.cartContext([{ id: '123-45-6', quantity: 2 }]), [{ id: 123, qty: 2 }])
    assert.deepEqual(page.cartContext([{ id: 7, quantity: 500 }, { id: 'x', quantity: 1 }, { id: 0, quantity: 1 }, { id: 8, quantity: 0 }]), [
        { id: 7, qty: 99 },
        { id: 8, qty: 1 },
    ])
    assert.equal(page.cartContext(Array.from({ length: 40 }, (_, i) => ({ id: i + 1, quantity: 1 }))).length, 30)
})

// ---------------------------------------------------------------------------------------------
// starters
// ---------------------------------------------------------------------------------------------

// 2026-10-21 is a Wednesday. Istanbul is UTC+3: 14:59 UTC = 17:59, 15:00 UTC = 18:00.
const WED_1759 = new Date('2026-10-21T14:59:00Z')
const WED_1800 = new Date('2026-10-21T15:00:00Z')
const SAT_1000 = new Date('2026-10-24T07:00:00Z')
const base = { cartTotal: 0, cartHasFreeShipping: false, freeThreshold: 500, now: WED_1759 }

test('starters: product page chips come after the fixed free-shipping chip', () => {
    const chips = start.starters({ ...base, page: { type: 'product', slug: 'x' } })
    assert.deepEqual(chips.map(c => c.label), ['Kargo bedava için ne eklesem?', 'Telefonuma uyar mı?', 'Kutuda neler var?', 'Benzerleriyle karşılaştır'])
    // a cart that already ships free: page chips only
    const free = start.starters({ ...base, page: { type: 'product', slug: 'x' }, cartTotal: 600 })
    assert.deepEqual(free.map(c => c.label), ['Telefonuma uyar mı?', 'Kutuda neler var?', 'Benzerleriyle karşılaştır', 'Yanına ne alınır?'])
})

test('starters: popular questions follow the fixed chip, at most 3, at most 4 chips in all', () => {
    const popular = JSON.stringify(['Sepetimde neler var?', 'Kablo önerir misin?', 'iPad için şarj aleti', 'Dördüncü soru'])
    const chips = start.starters({ ...base, page: { type: 'home' }, popular })
    assert.deepEqual(chips.map(c => c.label), ['Kargo bedava için ne eklesem?', 'Sepetimde neler var?', 'Kablo önerir misin?', 'iPad için şarj aleti'])
    // an already parsed array works too; one popular question leaves room for page chips
    const one = start.starters({ ...base, page: { type: 'home' }, popular: ['Kablo önerir misin?'] })
    assert.deepEqual(one.map(c => c.label), ['Kargo bedava için ne eklesem?', 'Kablo önerir misin?', 'iPhone 15 için şarj aleti', 'Ekran koruyucu öner'])
    // a popular question equal to a page chip is not shown twice
    const dup = start.starters({ ...base, page: { type: 'home' }, popular: ['ekran koruyucu öner'] })
    assert.equal(dup.filter(c => c.label.toLocaleLowerCase('tr') === 'ekran koruyucu öner').length, 1)
})

test('starters: invalid popular questions are ignored', () => {
    for (const bad of [undefined, null, '', 'not json', '{"a":1}', 42, '[1,2]', JSON.stringify({ q: 'x' })]) {
        assert.deepEqual(start.popularQuestions(bad), [], String(bad))
    }
    const mixed = start.popularQuestions(JSON.stringify([
        'ok soru mu?', 'a', 'x'.repeat(81), 'https://evil.test bak', '<b>kalın</b>', 'Numaram 0532 000 00 00', 7,
        'OK SORU MU?', '  boşluklu   soru  ',
    ]))
    assert.deepEqual(mixed, ['ok soru mu?', 'boşluklu soru'])
})

test('starters: a cart under the free-shipping threshold puts the free-shipping chip first', () => {
    const chips = start.starters({ ...base, page: { type: 'home' }, cartTotal: 320 })
    assert.equal(chips[0].label, 'Kargo bedava için ne eklesem?')
    assert.equal(chips.length, 4)
    assert.notEqual(start.starters({ ...base, page: { type: 'home' }, cartTotal: 520 })[0].label, 'Kargo bedava için ne eklesem?')
    assert.notEqual(start.starters({ ...base, page: { type: 'home' }, cartTotal: 320, cartHasFreeShipping: true })[0].label, 'Kargo bedava için ne eklesem?')
})

test('starters: the shipping chip switches at the cut-off in Istanbul time', () => {
    const label = now => start.starters({ ...base, now, page: { type: 'home' } }).find(c => c.chip === 'faq_cutoff').label
    assert.equal(label(WED_1759), 'Bugün kargoda olur mu?')
    assert.equal(label(WED_1800), 'Ne zaman kargoya verilir?')
    assert.equal(label(SAT_1000), 'Ne zaman kargoya verilir?')
    assert.equal(start.beforeCutoff(SAT_1000, 'hafta-ici-cumartesi', '18:00'), true)
    assert.equal(start.starters({ ...base, page: { type: 'listing' }, cartTotal: 600 }).at(-1).chip, 'faq_cutoff')
})

// ---------------------------------------------------------------------------------------------
// mini-markdown
// ---------------------------------------------------------------------------------------------

test('mini-markdown: bold and bullets are tokenised', () => {
    const blocks = md.parseMiniMarkdown('**67W** set iyi bir seçim.\n- Hızlı şarj\n- Type-C\n1. Bir\n2. İki')
    assert.deepEqual(blocks[0], { t: 'p', c: [{ t: 'bold', v: '67W' }, { t: 'text', v: ' set iyi bir seçim.' }] })
    assert.deepEqual(blocks[1], { t: 'ul', items: [[{ t: 'text', v: 'Hızlı şarj' }], [{ t: 'text', v: 'Type-C' }]] })
    assert.deepEqual(blocks[2], { t: 'ol', items: [[{ t: 'text', v: 'Bir' }], [{ t: 'text', v: 'İki' }]] })
    // a price is not a numbered list
    assert.equal(md.parseMiniMarkdown('1.499,99 TL')[0].t, 'p')
})

test('mini-markdown: only internal links become link tokens', () => {
    assert.deepEqual(md.parseInline('Bak: [kablolar](/kategori/a/)'), [{ t: 'text', v: 'Bak: ' }, { t: 'link', v: 'kablolar', href: '/kategori/a/' }])
    const evil = md.parseInline('[x](https://evil)')
    assert.ok(evil.every(t => t.t !== 'link'))
    assert.ok(!JSON.stringify(evil).includes('evil'))
    assert.ok(md.parseInline('[x](//evil.com/a)').every(t => t.t !== 'link'))
    assert.ok(md.parseInline('[x](javascript:alert(1))').every(t => t.t !== 'link'))
})

test('mini-markdown: HTML stays literal text', () => {
    assert.deepEqual(md.parseMiniMarkdown('<img src=x onerror=alert(1)>'), [{ t: 'p', c: [{ t: 'text', v: '<img src=x onerror=alert(1)>' }] }])
})

test('mini-markdown: an unclosed ** at the end renders as bold until the end', () => {
    assert.deepEqual(md.parseInline('Fiyatı **129,99 T'), [{ t: 'text', v: 'Fiyatı ' }, { t: 'bold', v: '129,99 T' }])
    assert.deepEqual(md.parseInline('**'), [])
})

// ---------------------------------------------------------------------------------------------
// cart card and cart changes (contract v2)
// ---------------------------------------------------------------------------------------------

// Synthetic cart lines (store shape: raw price, quantity)
const line = (id, quantity = 1, over = {}) => ({ id, name: `Test Ürün ${id}`, price: 100, image: '', quantity, ...over })
const cartEvent = products => ({
    t: 'cart', lines: products.map(p => ({ product: p, qty: 1, lineTotal: p.displayPrice })),
    count: products.length, total: 0, threshold: 500, freeShippingRemaining: 0,
})

test('chat-reducer: a cart card is a card, and cart_ops become a pending receipt', () => {
    const m = fold([
        { t: 'text', v: 'Sepetinde 2 ürün var.' },
        cartEvent([card(1), card(2)]),
        { t: 'cart_ops', ops: [{ id: 1, qty: 0 }], note: '  Test Ürün 1   sepetten çıkarıldı ' },
        { t: 'done', finish: 'cards', productIds: [], wa: false },
    ])
    assert.deepEqual(m.cards.map(c => c.t), ['cart'])
    assert.equal(m.receipts.length, 1)
    assert.deepEqual(m.receipts[0], { note: 'Test Ürün 1 sepetten çıkarıldı', ops: [{ id: 1, qty: 0 }], state: 'pending', touched: [], before: [] })
    const settled = reducer.settleReceipt(m, { touched: [1], before: [line(1, 2)] })
    assert.equal(settled.receipts[0].state, 'applied')
    assert.deepEqual(settled.receipts[0].before, [line(1, 2)])
    assert.equal(reducer.settleReceipt(m, { touched: [], before: [] }).receipts[0].state, 'none')
    const undone = reducer.markUndone(settled, 0)
    assert.equal(undone.receipts[0].state, 'undone')
    // only an applied receipt can be undone
    assert.equal(reducer.markUndone(undone, 0), undone)
    // cards of the cart count as shown products (a later cart_ops may add them back)
    assert.deepEqual([...reducer.shownProducts([settled]).keys()], [1, 2])
})

test('chat-reducer: a second cart event in one turn replaces the cart card instead of stacking a copy', () => {
    const m = fold([
        { t: 'text', v: 'Sepetin:' },
        cartEvent([card(1), card(2)]),
        { t: 'cart_ops', ops: [{ id: 2, qty: 0 }, { id: 3, qty: 1 }], note: 'x' },
        { t: 'links', items: [] },
        cartEvent([card(1), card(3)]),
        { t: 'done', finish: 'cards', productIds: [], wa: false },
    ])
    assert.deepEqual(m.cards.map(c => c.t), ['cart', 'links'])
    assert.deepEqual(m.cards[0].lines.map(l => l.product.id), [1, 3])
})

test('persist: applied receipts survive a reload, pending ones do not', () => {
    const store = memoryStorage()
    const m = { ...reducer.assistantMessage(1), status: 'done', text: 'Tamam.' }
    m.receipts = [
        { note: 'a', ops: [], state: 'applied', touched: [1], before: [line(1)] },
        { note: 'b', ops: [], state: 'pending', touched: [], before: [] },
    ]
    persist.saveChat(store, { conversationId: 'conv-1234-abcd', device: null, messages: [m] }, 1000)
    const back = persist.loadChat(store, 2000)
    assert.deepEqual(back.messages[0].receipts.map(r => r.note), ['a'])
})

test('cart-ops: product ids come from the leading digits of the cart line id', () => {
    assert.equal(ops.productIdOf(12), 12)
    assert.equal(ops.productIdOf('12-kirmizi'), 12)
    assert.equal(ops.productIdOf('x'), 0)
    assert.equal(ops.inCartQty([line(5, 2), line('5-mavi', 1), line(6, 3)], 5), 3)
})

test('cart-ops: qty 0 removes every line of the product, another qty sets the first line', () => {
    const items = [line(1, 1), line('2-a', 2), line('2-b', 1), line(3, 1)]
    const plan = ops.planCartOps(items, [{ id: 2, qty: 0 }, { id: 3, qty: 4 }], () => null)
    assert.deepEqual(plan.touched, [2, 3])
    assert.deepEqual(plan.steps, [{ do: 'remove', itemId: '2-a' }, { do: 'remove', itemId: '2-b' }, { do: 'qty', itemId: 3, qty: 4 }])
    assert.deepEqual(plan.before.map(l => l.id), ['2-a', '2-b', 3])
    const after = ops.applyCartSteps(items, plan.steps)
    assert.deepEqual(after.map(l => [l.id, l.quantity]), [[1, 1], [3, 4]])
    // a product with options keeps its other lines when only the quantity changes
    const one = ops.planCartOps(items, [{ id: 2, qty: 5 }], () => null)
    assert.deepEqual(ops.applyCartSteps(items, one.steps).map(l => [l.id, l.quantity]), [[1, 1], ['2-a', 5], ['2-b', 1], [3, 1]])
})

test('cart-ops: unknown products are added only when shown and addable; bad ops are ignored', () => {
    const items = [line(1, 1)]
    const addable = id => (id === 9 ? { id: 9, name: 'Test Ürün 9', price: 50, image: '' } : null)
    const plan = ops.planCartOps(items, [
        { id: 9, qty: 2 },      // shown: added with 2
        { id: 8, qty: 1 },      // not shown: ignored
        { id: 7, qty: 0 },      // not in the cart, removing: nothing to do
        { id: 1, qty: 1 },      // already 1: nothing to do
        { id: -3, qty: 1 }, { id: 'x', qty: 1 }, { id: 4, qty: -1 },
    ], addable)
    assert.deepEqual(plan.touched, [9])
    assert.deepEqual(plan.steps, [{ do: 'add', item: { id: 9, name: 'Test Ürün 9', price: 50, image: '' }, qty: 2 }])
    assert.deepEqual(ops.applyCartSteps(items, plan.steps).map(l => [l.id, l.quantity]), [[1, 1], [9, 2]])
    // the last op for a product wins, and quantities are capped at 99
    assert.deepEqual(ops.planCartOps(items, [{ id: 1, qty: 3 }, { id: 1, qty: 500 }], () => null).steps, [{ do: 'qty', itemId: 1, qty: 99 }])
    assert.deepEqual(ops.planCartOps(items, 'nonsense', () => null).steps, [])
})

test('cart-ops: Geri al puts the earlier lines back and takes added products out', () => {
    const items = [line(1, 1), line('2-a', 2), line('2-b', 1)]
    const addable = id => (id === 9 ? { id: 9, name: 'Test Ürün 9', price: 50, image: '' } : null)
    const plan = ops.planCartOps(items, [{ id: 2, qty: 0 }, { id: 1, qty: 3 }, { id: 9, qty: 1 }], addable)
    const after = ops.applyCartSteps(items, plan.steps)
    assert.deepEqual(after.map(l => [l.id, l.quantity]), [[1, 3], [9, 1]])
    // the visitor added something else meanwhile: it stays
    const later = [...after, line(4, 1)]
    const restored = ops.applyCartSteps(later, ops.planUndo(later, plan.before, plan.touched))
    const byId = Object.fromEntries(restored.map(l => [l.id, l.quantity]))
    assert.deepEqual(byId, { 4: 1, 1: 1, '2-a': 2, '2-b': 1 })
    assert.equal(restored.find(l => l.id === '2-a').name, 'Test Ürün 2-a')
})

test('cart-ops: free-shipping state follows the cart store rule', () => {
    assert.deepEqual(ops.freeShippingState(320, 500, false), { free: false, left: 180, progress: 64 })
    assert.deepEqual(ops.freeShippingState(500, 500, false), { free: true, left: 0, progress: 100 })
    assert.deepEqual(ops.freeShippingState(100, 500, true), { free: true, left: 0, progress: 100 })
    assert.equal(ops.freeShippingState(449.97, 500, false).left, 50.03)
})

// ---------------------------------------------------------------------------------------------
// sheet drag (phone)
// ---------------------------------------------------------------------------------------------

test('sheet-drag: follows the finger down, resists up', () => {
    assert.equal(drag.dragOffset(120), 120)
    assert.equal(drag.dragOffset(0), 0)
    const up = drag.dragOffset(-400)
    assert.ok(up < 0 && up > -drag.RUBBER_MAX_PX)
    assert.ok(Math.abs(drag.dragOffset(-10)) < 10)
    assert.equal(drag.dragOffset(NaN), 0)
})

test('sheet-drag: a press becomes a drag only when it moves mostly vertically', () => {
    assert.equal(drag.dragIntent(2, 3), null)
    assert.equal(drag.dragIntent(1, 10), 'drag')
    assert.equal(drag.dragIntent(1, -10), 'drag')
    assert.equal(drag.dragIntent(20, 10), 'other')
    // the transcript: only a pull down
    assert.equal(drag.dragIntent(1, -10, true), 'other')
    assert.equal(drag.dragIntent(1, 10, true), 'drag')
})

test('sheet-drag: closes past 30% of the height or on a fast flick, otherwise springs back', () => {
    const height = 700
    assert.equal(drag.shouldClose({ dy: 211, height, velocity: 0 }), true)
    assert.equal(drag.shouldClose({ dy: 150, height, velocity: 0.1 }), false)
    assert.equal(drag.shouldClose({ dy: 60, height, velocity: 0.8 }), true)
    assert.equal(drag.shouldClose({ dy: 10, height, velocity: 2 }), false)
    assert.equal(drag.shouldClose({ dy: -40, height, velocity: 2 }), false)
    // velocity from the last 100 ms of samples; a pause before release counts as slow
    const fast = [{ y: 0, t: 0 }, { y: 30, t: 40 }, { y: 80, t: 80 }]
    assert.equal(drag.releaseVelocity(fast), 1)
    const paused = [{ y: 0, t: 0 }, { y: 80, t: 80 }, { y: 80, t: 400 }]
    assert.equal(drag.releaseVelocity(paused), 0)
    assert.equal(drag.releaseVelocity([{ y: 5, t: 1 }]), 0)
    assert.equal(drag.backdropOpacity(350, 700), 0.5)
    assert.equal(drag.backdropOpacity(-10, 700), 1)
})

// ---------------------------------------------------------------------------------------------
// Panel copy and launcher (source guards: React components are not loaded here)
// ---------------------------------------------------------------------------------------------

const src = path => readFileSync(new URL(path, ROOT), 'utf8')

test('panel: no notice box or composer footer; the notice opens from the empty chat line and the ⋯ menu', () => {
    const panel = src('components/assistant/AssistantPanel.tsx')
    const composer = src('components/assistant/parts/Composer.tsx')
    const empty = src('components/assistant/parts/EmptyState.tsx')
    assert.ok(!/Sohbet saklanmaz|sohbet içeriği saklanmaz/.test(panel + composer + empty))
    assert.ok(!composer.includes('Aydınlatma Metni'))
    assert.ok(!panel.includes('onopo:assistant:notice'))
    assert.match(empty, /Yapay zekâ asistanı ·\{' '\}[\s\S]*Aydınlatma Metni için tıkla/)
    // ⋯ menu: Yeni sohbet, Telefon modelini değiştir, Aydınlatma Metni
    const menu = panel.slice(panel.indexOf('function HeaderMenu'), panel.indexOf('function NoticeSheet'))
    assert.deepEqual([...menu.matchAll(/role="menuitem"[^>]*>\s*([^<{]+?)\s*</g)].map(m => m[1]).slice(-2), ['Telefon modelini değiştir', 'Aydınlatma Metni'])
    assert.ok(menu.includes('Yeni sohbet'))
    // The notice: a labelled dialog that says transcripts are kept masked for up to 12 months
    const sheet = panel.slice(panel.indexOf('function NoticeSheet'))
    assert.match(sheet, /role="dialog"[\s\S]*aria-modal="true"[\s\S]*aria-labelledby="assistant-notice-title"/)
    assert.match(sheet, /kişisel bilgiler gizlenerek en çok 12 ay saklanır/)
    assert.match(sheet, /silinmesini istersen WhatsApp/)
    // The placeholder hint stays
    assert.match(composer, /placeholder="Ne arıyorsun\? Örn\. iPhone 15 için hızlı şarj"/)
})

test('launcher: 52 px circle on phones, pill on desktop, one entrance that reduced motion turns off', () => {
    const launcher = src('components/assistant/AssistantLauncher.tsx')
    const css = src('app/globals.css')
    assert.ok(launcher.includes('data-assistant-launcher=""'))
    assert.match(launcher, /h-\[52px\]/)
    assert.match(launcher, /md:inline">\{label\}/)
    assert.match(launcher, /animate-ai-launcher-in/)
    assert.ok(!/animate-(?:pulse|bounce|ping)/.test(launcher))
    assert.match(css, /@keyframes ai-launcher-in/)
    assert.match(css, /prefers-reduced-motion: reduce\)[\s\S]*\.animate-ai-launcher-in[\s\S]*animation: none/)
    // The hide rules (toast, bottom nav, PDP buy bar) are still there
    assert.match(css, /body:has\(\[data-sonner-toast\]\) \[data-assistant-launcher\]/)
    assert.match(css, /body:has\(\[data-hide-bottom-nav\]\[aria-hidden="true"\]\) \[data-assistant-launcher\]/)
})

test('panel: the phone sheet is dragged by the handle, the header and the transcript top', () => {
    const panel = src('components/assistant/AssistantPanel.tsx')
    const hook = src('components/assistant/useSheetDrag.ts')
    assert.match(panel, /useSheetDrag\(\{ enabled: isSheet, visible, frameRef, backdropRef, scrollRef, onClose: minimize \}\)/)
    assert.match(panel, /<DragHandle handlers=\{drag\.handle\} \/>/)
    assert.match(panel, /\{\.\.\.\(isSheet \? drag\.header : \{\}\)\}/)
    assert.ok(!panel.includes('SWIPE_CLOSE_PX'))
    // no transition while dragging, a non-passive touchmove for the transcript, reduced motion skips the animation
    assert.match(hook, /el\.style\.transition = 'none'/)
    assert.match(hook, /addEventListener\('touchmove', onMove, \{ passive: false \}\)/)
    assert.match(hook, /prefers-reduced-motion: reduce/)
})

test('cards: in-cart products show the stepper, sold-out products have no add button', () => {
    const cards = src('components/assistant/parts/ProductCards.tsx')
    assert.match(cards, /Sepette · \{qty\}/)
    assert.ok(!cards.includes('Stokta yok'))
    assert.match(cards, /if \(!p\.inStock\) return <SoldOutAction/)
    assert.match(cards, /<Badge variant="soldout">Tükendi<\/Badge>/)
    const list = src('components/assistant/parts/MessageList.tsx')
    assert.match(list, /case 'cart':\s*return <CartCard card=\{card\} \/>/)
    assert.match(list, /<CartReceiptRow receipt=\{r\} messageId=\{m\.id\} index=\{i\} \/>/)
})
