// Unit tests for the Onopo Asistan chat UI's pure modules (SPEC §13.2): components/assistant/chat-reducer.ts,
// persist.ts, page-context.ts, starters.ts and mini-markdown.ts. No React, no npm packages.
// Run: node --test scripts/ai-assistant-ui.test.mjs   (Node 23.6+ strips the TypeScript types itself)
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
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
    const wa = reducer.localWhatsapp({ reason: 'product_request', summary: 'Numaram 0532 123 45 67', waBase: WA_BASE, product: card(5) })
    assert.equal(wa.t, 'whatsapp')
    assert.ok(!wa.message.includes('0532'))
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

test('starters: product page chips', () => {
    const chips = start.starters({ ...base, page: { type: 'product', slug: 'x' } })
    assert.deepEqual(chips.map(c => c.label), ['Telefonuma uyar mı?', 'Kutuda neler var?', 'Benzerleriyle karşılaştır', 'Yanına ne alınır?'])
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
    assert.equal(start.starters({ ...base, page: { type: 'listing' } }).at(-1).chip, 'faq_cutoff')
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
