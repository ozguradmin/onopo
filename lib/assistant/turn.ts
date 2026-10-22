/**
 * Onopo Asistan: one chat turn, from a validated request to a stream of events (pure; every effect injected).
 *
 * Why it is pure: the route handler only does guards and the SSE plumbing; this module holds all the
 * decisions (router, canned answers, model calls with fallback, tools, validator, server-added cards,
 * suggestions), and `node --test` runs it against a mocked `ai.run`. It never logs or stores any text:
 * it returns a content-free TurnLog for the usage tables.
 *
 * Order of one turn (SPEC section 2): meta + "Sorunu anlıyorum…" → router (≤ 700 ms, in parallel with the
 * knowledge memo) → canned answer, or candidates + DeepSeek stream (≤ 3 calls, validated sentence by
 * sentence, UI tools end the turn) → server cards → suggestions → done.
 */
import type { AssistantEvent, ChatRequest, HandoffReason, PageContext } from './contract'
import { maskPII } from './contract'
import type { CatalogRow, RatingMap } from './catalog-block'
import { buildCatalogBlock, GROUP_ORDER, GROUP_TITLES, groupHref, searchCatalog } from './catalog-block'
import type { LinkTarget, StoreFacts } from './facts'
import { buildFactsBlock, buildLinksBlock, istanbulDay } from './facts'
import { buildMessages, buildSystemMessage, buildTurnContext, computeCart, type ChatMessage } from './prompt'
import { sanitize } from './request'
import { buildRouterState, decide, routeTurn, type RouteDecision } from './router'
import { parseWorkersAiSse, type Usage } from './sse-parser'
import { DATA_TOOLS, TOOL_STEP, TOOLS, catalogLinesFor, isKnownTool, newToolState, runTool, waBaseOf, whatsappEvents, type ProductDetailRow, type ToolContext, type ToolResult } from './tools'
import { addToolText, collectAllowed, createTextGuard } from './validator'
import { CANNED, DEFAULT_TEXT, faqAnswer } from './canned'
import { buildSuggestions, type TurnEnd } from './suggestions'
import { detectDevice } from './device'
import { costMicroUsd } from './limits'
import { foldTr } from '../search'
import { cmsPagePath } from '../seo'

// ---------------------------------------------------------------------------------------------
// Knowledge (the per-version, shared part of every turn)
// ---------------------------------------------------------------------------------------------

export interface Knowledge {
    /** cache_version:count:max(updated_at) */
    version: string
    rows: CatalogRow[]
    byId: Map<number, CatalogRow>
    bySlug: Map<string, CatalogRow>
    ratings: RatingMap
    facts: StoreFacts
    factsBlock: string
    /** link key → target (<baglantilar>) */
    links: Map<string, LinkTarget>
    categories: { name: string; slug: string; href: string }[]
    /** messages[0] content: rules + facts + links + catalogue. */
    systemMessage: string
    /** Real prices of this version (display prices, threshold, shipping cost). */
    allowedPrices: number[]
    /** The store's WhatsApp number (pickStoreWhatsapp: admin assistant number → whatsapp_number → footer_phone). */
    storeWhatsapp: string | null
    /** waBaseOf(storeWhatsapp): 'https://wa.me/90…' without text, or null. */
    waBase: string | null
    /** /page/shipping/ when that CMS page exists. */
    shippingHref: string | null
}

export interface KnowledgeInput {
    version: string
    rows: CatalogRow[]
    ratings: RatingMap
    facts: StoreFacts
    categories: { name: string; slug: string; icon?: string | null; href: string; product_count?: number }[]
    cmsPages: { slug: string; title: string; href?: string }[]
    storeWhatsapp: string | null
}

const GAMING_CATEGORY = 'Oyun ve Oyuncu Aksesuarları'

function minPrice(rows: CatalogRow[]): number | null {
    return rows.length ? Math.min(...rows.map(r => r.displayPrice)) : null
}

/** Everything that only changes with the knowledge version (pure: data.ts feeds it from D1, tests from fixtures). */
export function buildKnowledge(input: KnowledgeInput): Knowledge {
    const rows = [...input.rows].sort((a, b) => a.id - b.id)
    const byId = new Map(rows.map(r => [r.id, r]))
    const bySlug = new Map(rows.map(r => [r.slug, r]))
    const links = new Map<string, LinkTarget>()
    for (const c of input.categories) {
        const name = foldTr(c.name).trim()
        const slug = foldTr(c.slug).trim()
        const inCat = rows.filter(r => {
            const pc = foldTr(r.category ?? '').trim()
            return pc !== '' && (pc === name || pc === slug)
        })
        if (inCat.length === 0 && !c.product_count) continue
        links.set(`kategori:${c.slug}`, { key: `kategori:${c.slug}`, title: c.name, href: c.href, count: c.product_count ?? inCat.length, fromPrice: minPrice(inCat), icon: c.icon || null })
    }
    const gaming = input.categories.find(c => c.name === GAMING_CATEGORY)
    for (const g of GROUP_ORDER) {
        const inGroup = rows.filter(r => r.group === g)
        if (!inGroup.length) continue
        links.set(`grup:${g}`, { key: `grup:${g}`, title: GROUP_TITLES[g], href: groupHref(g, gaming?.href), count: inGroup.length, fromPrice: minPrice(inGroup), icon: null })
    }
    for (const p of input.cmsPages) {
        links.set(`sayfa:${p.slug}`, { key: `sayfa:${p.slug}`, title: p.title, href: p.href ?? cmsPagePath(p.slug), count: null, fromPrice: null, icon: null })
    }
    links.set('siparislerim', { key: 'siparislerim', title: 'Siparişlerim', href: '/orders/', count: null, fromPrice: null, icon: null })
    links.set('tum-urunler', { key: 'tum-urunler', title: 'Tüm ürünler', href: '/products/', count: rows.length, fromPrice: minPrice(rows), icon: null })

    const factsBlock = buildFactsBlock(input.facts)
    const systemMessage = buildSystemMessage({
        facts: factsBlock,
        links: buildLinksBlock([...links.values()]),
        catalog: buildCatalogBlock(rows, input.version),
    })
    const prices = new Set<number>(rows.map(r => r.displayPrice))
    prices.add(input.facts.freeThreshold)
    prices.add(input.facts.shippingCost)
    const store = input.storeWhatsapp?.trim() || null
    return {
        version: input.version,
        rows,
        byId,
        bySlug,
        ratings: input.ratings,
        facts: input.facts,
        factsBlock,
        links,
        categories: input.categories.map(c => ({ name: c.name, slug: c.slug, href: c.href })),
        systemMessage,
        allowedPrices: [...prices],
        storeWhatsapp: store,
        waBase: waBaseOf(store),
        shippingHref: input.cmsPages.some(p => p.slug === 'shipping') ? cmsPagePath('shipping') : null,
    }
}

// ---------------------------------------------------------------------------------------------
// Dependencies and log
// ---------------------------------------------------------------------------------------------

export interface TurnDeps {
    ai: { run(model: string, inputs: unknown, options?: Record<string, unknown>): Promise<unknown> }
    /** env vars with code defaults */
    models: { chat: string; router: string; fallback: string | null }
    /** env.AI_GATEWAY_ID || null */
    gatewayId: string | null
    now: () => Date
    /** lib/assistant/data.ts (memo) */
    loadKnowledge: () => Promise<Knowledge>
    /** one D1 query, active only */
    getProductDetail: (id: number) => Promise<ProductDetailRow | null>
    /** env.CHAT_RL_MODEL.limit({key:'deepseek'}), missing → true */
    takeModelSlot: () => Promise<boolean>
    /** limits.ts, memo 30 s */
    budgetExceeded: () => Promise<boolean>
    /** hasSessionHint cookie */
    loggedIn: boolean
    /** defaults 700 / 10_000 / 30_000 (tests shrink) */
    timeouts?: { routerMs: number; firstByteMs: number; turnMs: number }
}

export type TurnOutcome = 'ok' | 'canned' | 'blocked' | 'fallback' | 'busy' | 'error' | 'timeout' | 'aborted'

/** Content-free record of a turn (ai_chat_events + ai_usage_daily). */
export interface TurnLog {
    day: string
    convHash: string
    turn: number
    mode: 'llm' | 'canned' | 'fallback'
    intent: string | null
    flags: string[]
    model: string | null
    modelCalls: number
    tools: string[]
    products: number[]
    handoff: HandoffReason | null
    inTokens: number
    cachedTokens: number
    outTokens: number
    costMicroUsd: number
    firstTextMs: number | null
    totalMs: number
    outcome: TurnOutcome
}

const DEFAULT_TIMEOUTS = { routerMs: 700, firstByteMs: 10_000, turnMs: 30_000 }

/** In-isolate circuit breaker: after a 429/3040 from the primary model, use the fallback for 60 s. */
let circuitOpenUntil = 0
export function resetCircuit(): void {
    circuitOpenUntil = 0
}

export async function sha16(text: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** Page line of the turn context. */
export function describePage(page: PageContext, k: Knowledge): string {
    switch (page.type) {
        case 'home':
            return 'anasayfa'
        case 'product': {
            const row = k.bySlug.get(page.slug)
            return row ? `ürün #${row.id} "${row.displayName}"` : 'diğer'
        }
        case 'category': {
            const c = k.categories.find(x => x.slug === page.slug)
            return c ? `kategori "${c.name}"` : 'diğer'
        }
        case 'listing':
            return page.query ? `arama "${page.query.replace(/"/g, '')}"` : 'diğer'
        default:
            return 'diğer'
    }
}

/** Page description for the router state (built from the request alone, so the router can start before the knowledge). */
function routerPage(page: PageContext): string {
    switch (page.type) {
        case 'home': return 'anasayfa'
        case 'product': return `ürün: ${page.slug.replace(/-/g, ' ')}`
        case 'category': return `kategori: ${page.slug.replace(/-/g, ' ')}`
        case 'listing': return page.query ? `arama: ${page.query}` : 'ürün listesi'
        case 'page': return `sayfa: ${page.slug}`
        default: return 'diğer'
    }
}

/** A stream that errors as soon as `signal` aborts (a stuck model body can never hold the turn). */
function abortableBody(src: ReadableStream<Uint8Array>, signal: AbortSignal, onChunk: () => void, onEnd: () => void): ReadableStream<Uint8Array> {
    const reader = src.getReader()
    let ctrlRef: ReadableStreamDefaultController<Uint8Array> | null = null
    let closed = false
    const onAbort = () => {
        if (closed) return
        closed = true
        onEnd()
        try { ctrlRef?.error(new Error('aborted')) } catch { /* already closed */ }
        reader.cancel().catch(() => {})
    }
    return new ReadableStream<Uint8Array>({
        start(controller) {
            ctrlRef = controller
            if (signal.aborted) onAbort()
            else signal.addEventListener('abort', onAbort, { once: true })
        },
        async pull(controller) {
            try {
                const { value, done } = await reader.read()
                if (closed) return
                if (done) {
                    closed = true
                    signal.removeEventListener('abort', onAbort)
                    onEnd()
                    controller.close()
                } else {
                    onChunk()
                    controller.enqueue(value)
                }
            } catch (err) {
                if (!closed) {
                    closed = true
                    signal.removeEventListener('abort', onAbort)
                    onEnd()
                    try { controller.error(err) } catch { /* ignore */ }
                }
            }
        },
        cancel() {
            closed = true
            signal.removeEventListener('abort', onAbort)
            onEnd()
            reader.cancel().catch(() => {})
        },
    })
}

function abortPromise(signal: AbortSignal): Promise<never> {
    return new Promise((_, reject) => {
        if (signal.aborted) reject(new Error('aborted'))
        else signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    })
}

type OpenResult =
    | { ok: true; body: ReadableStream<Uint8Array> }
    | { ok: false; status: number | null; message: string }

// ---------------------------------------------------------------------------------------------
// The turn
// ---------------------------------------------------------------------------------------------

export async function runTurn(req: ChatRequest, deps: TurnDeps, emit: (ev: AssistantEvent) => void, signal?: AbortSignal): Promise<TurnLog> {
    const started = Date.now()
    const timeouts = { ...DEFAULT_TIMEOUTS, ...deps.timeouts }
    const masked = maskPII(sanitize(req.input)).slice(0, 800)
    const flags = new Set<string>()
    /** The validator's flags (price_mismatch, validator_drop, …), merged into the log at the end. */
    let guardFlags: readonly string[] = []
    const log: TurnLog = {
        day: istanbulDay(deps.now()),
        convHash: await sha16(req.conversationId),
        turn: req.context.turn,
        mode: 'llm',
        intent: null,
        flags: [],
        model: null,
        modelCalls: 0,
        tools: [],
        products: [],
        handoff: null,
        inTokens: 0,
        cachedTokens: 0,
        outTokens: 0,
        costMicroUsd: 0,
        firstTextMs: null,
        totalMs: 0,
        outcome: 'ok',
    }
    const turnId = crypto.randomUUID()
    let textSent = false
    const out = (ev: AssistantEvent) => {
        if (ev.t === 'text') {
            textSent = true
            if (log.firstTextMs == null) log.firstTextMs = Date.now() - started
        }
        emit(ev)
    }

    const turnAbort = new AbortController()
    let timedOut = false
    const onParentAbort = () => turnAbort.abort()
    signal?.addEventListener('abort', onParentAbort)
    const turnTimer = setTimeout(() => {
        timedOut = true
        turnAbort.abort()
    }, timeouts.turnMs)

    const knowledgeP = deps.loadKnowledge()
    knowledgeP.catch(() => {})
    let k: Knowledge | null = null
    let state = newToolState({ pageProduct: null, maskedInput: masked, loggedIn: deps.loggedIn })

    const finish = (finish: 'stop' | 'cards' | 'canned' | 'error') => {
        out({ t: 'done', finish, productIds: [...state.productIds], wa: state.waVariant != null })
    }
    const cartSummary = () => (k ? computeCart(req.context.cart, k.byId, k.facts) : null)

    try {
        // ---- FAQ chip: canned answer from the facts, no AI call ----
        if (req.chip) {
            k = await knowledgeP
            state = newToolState({ pageProduct: pageRow(req.context.page, k), maskedInput: masked, loggedIn: deps.loggedIn })
            log.mode = 'canned'
            log.outcome = 'canned'
            out({ t: 'meta', turnId, mode: 'canned', waBase: k.waBase })
            const faq = faqAnswer(req.chip, k.facts, deps.now())
            out({ t: 'text', v: faq.text })
            faq.events.forEach(out)
            if (faq.handoff) whatsappEvents({ k, state }, { reason: faq.handoff, summary: masked, productIds: [], variant: 'compact' })?.forEach(out)
            const chips = buildSuggestions({ kind: 'faq', chip: req.chip }, { remaining: cartSummary()?.remaining ?? null, waShown: state.waVariant != null })
            if (chips.length) out({ t: 'suggestions', chips })
            finish('canned')
            return log
        }

        // ---- Daily budget: WhatsApp mode. Fails CLOSED: when the spend cannot be read (D1 down),
        // the turn cannot be counted either, so it goes to WhatsApp instead of running unmetered ----
        if (await deps.budgetExceeded().catch(() => true)) {
            k = await knowledgeP
            state = newToolState({ pageProduct: pageRow(req.context.page, k), maskedInput: masked, loggedIn: deps.loggedIn })
            log.mode = 'canned'
            log.outcome = 'busy'
            flags.add('budget')
            out({ t: 'meta', turnId, mode: 'canned', waBase: k.waBase })
            out({ t: 'text', v: CANNED.busy })
            whatsappEvents({ k, state }, { reason: 'other', summary: masked, productIds: [], variant: 'full' })?.forEach(out)
            finish('canned')
            return log
        }

        // ---- Router ‖ knowledge ----
        const cartItems = req.context.cart.reduce((n, l) => n + l.qty, 0)
        const routerState = buildRouterState({
            masked,
            history: req.history,
            page: routerPage(req.context.page),
            device: req.context.device,
            cartItems,
            maskText: t => maskPII(sanitize(t)),
        })
        const routeP = routeTurn(deps.ai, deps.models.router, routerState, timeouts.routerMs, turnAbort.signal)
        k = await knowledgeP
        const pageProduct = pageRow(req.context.page, k)
        state = newToolState({ pageProduct, maskedInput: masked, loggedIn: deps.loggedIn })
        out({ t: 'meta', turnId, mode: 'llm', waBase: k.waBase })
        out({ t: 'step', id: 'understand', state: 'active' })
        const route = await routeP
        if (route.flag) flags.add(route.flag)
        log.costMicroUsd += costMicroUsd(deps.models.router, { inTokens: route.inputTokens, cachedTokens: 0, outTokens: 0 })
        const decision: RouteDecision = decide(route.answers, masked.length)
        decision.flags.forEach(f => flags.add(f))
        log.intent = decision.intent
        out({ t: 'step', id: 'understand', state: 'done' })

        const detected = detectDevice(masked)
        const device = detected ?? req.context.device
        if (detected && detected !== req.context.device) out({ t: 'device', v: detected })

        // ---- Router short-circuits (no DeepSeek) ----
        if (decision.canned) {
            log.mode = 'canned'
            log.outcome = decision.canned === 'refusal' ? 'blocked' : 'canned'
            out({ t: 'text', v: CANNED[decision.canned] })
            const chips = buildSuggestions({ kind: 'other' }, { remaining: cartSummary()?.remaining ?? null, waShown: false })
            out({ t: 'suggestions', chips })
            finish('canned')
            return log
        }

        const ctx: ToolContext = { k, getProductDetail: deps.getProductDetail, state }
        const notes = [...decision.notes]
        let toolChoice: 'auto' | 'none' = 'auto'
        if (decision.earlyHandoff) {
            out({ t: 'step', id: 'whatsapp', state: 'active' })
            const evs = whatsappEvents(ctx, { reason: decision.earlyHandoff, summary: masked, productIds: [], variant: 'full' })
            out({ t: 'step', id: 'whatsapp', state: 'done' })
            if (evs && evs.length) {
                evs.forEach(out)
                toolChoice = 'none'
            } else {
                // No WhatsApp number: the model must not say a card was shown
                const i = notes.findIndex(n => n.startsWith('WhatsApp kartı zaten'))
                if (i >= 0) notes.splice(i, 1)
            }
        }

        // ---- Turn context and messages ----
        const query = `${masked} ${device ?? ''}`.trim()
        let candidates = searchCatalog(k.rows, query, { group: decision.group, limit: 6 }).rows
        if (decision.group && candidates.length < 6) {
            for (const r of searchCatalog(k.rows, query, { limit: 6 }).rows) if (!candidates.includes(r)) candidates.push(r)
        }
        if (pageProduct) candidates = [pageProduct, ...candidates.filter(r => r.id !== pageProduct.id)]
        candidates = candidates.slice(0, 6)
        const cart = cartSummary()
        const turnContext = buildTurnContext({
            now: deps.now(),
            facts: k.facts,
            page: describePage(req.context.page, k),
            device,
            cart,
            candidates,
            router: route.answers ? { intent: decision.intent, group: decision.group, buyingStage: decision.buyingStage } : null,
            notes,
        })
        const messages: ChatMessage[] = buildMessages(k.systemMessage, req.history, turnContext, masked)
        const historyUserTexts = req.history.filter(h => h.role === 'user').map(h => maskPII(sanitize(h.text)))
        const allowed = collectAllowed({
            prices: [...k.allowedPrices, ...(cart ? [cart.total, cart.remaining] : [])],
            texts: [k.factsBlock, turnContext, masked, ...historyUserTexts],
            cutoff: k.facts.cutoff,
            campaigns: k.facts.campaigns,
        })
        const guard = createTextGuard(allowed)
        guardFlags = guard.stats.flags
        const convHash = log.convHash

        // ---- Model calls ----
        let useFallback = false
        const fallbackModel = deps.models.fallback && deps.models.fallback.trim() ? deps.models.fallback.trim() : null
        const switchToFallback = (why: string): boolean => {
            if (!fallbackModel || useFallback) return false
            useFallback = true
            flags.add(why)
            flags.add('fallback')
            out({ t: 'step', id: 'fallback', state: 'active' })
            return true
        }

        const openCall = async (model: string, primary: boolean, body: Record<string, unknown>): Promise<OpenResult> => {
            const callAbort = new AbortController()
            const link = () => callAbort.abort()
            turnAbort.signal.addEventListener('abort', link, { once: true })
            let firstByte = false
            const fbTimer = setTimeout(() => {
                if (!firstByte) {
                    flags.add('first_byte_timeout')
                    callAbort.abort()
                }
            }, timeouts.firstByteMs)
            const cleanup = () => {
                clearTimeout(fbTimer)
                turnAbort.signal.removeEventListener('abort', link)
            }
            try {
                const res = await Promise.race([
                    deps.ai.run(model, body, {
                        returnRawResponse: true,
                        signal: callAbort.signal,
                        extraHeaders: { 'x-session-affinity': `onopo-${req.conversationId}` },
                        ...(primary ? { rejectIfBusy: true } : {}),
                        ...(deps.gatewayId ? { gateway: { id: deps.gatewayId, collectLog: false, metadata: { c: convHash } } } : {}),
                    }),
                    abortPromise(callAbort.signal),
                ])
                let raw: ReadableStream<Uint8Array> | null = null
                if (res instanceof ReadableStream) raw = res
                else if (res && typeof (res as Response).status === 'number') {
                    const r = res as Response
                    if (!r.ok || !r.body) {
                        cleanup()
                        // The error body carries the Workers AI code (3040 = out of capacity); it is never logged
                        const detail = r.ok ? '' : await r.text().then(t => t.slice(0, 300)).catch(() => '')
                        return { ok: false, status: r.status, message: detail }
                    }
                    raw = r.body
                }
                if (!raw) {
                    cleanup()
                    return { ok: false, status: null, message: 'no_body' }
                }
                const body2 = abortableBody(raw, callAbort.signal, () => {
                    if (!firstByte) {
                        firstByte = true
                        clearTimeout(fbTimer)
                    }
                }, cleanup)
                return { ok: true, body: body2 }
            } catch (err) {
                cleanup()
                return { ok: false, status: null, message: err instanceof Error ? err.message : String(err) }
            }
        }

        let calls = 0
        let stopTurn = false
        let failed = false
        for (let call = 0; call < 3 && !stopTurn; call++) {
            if (turnAbort.signal.aborted) throw new Error('aborted')
            let model = useFallback && fallbackModel ? fallbackModel : deps.models.chat
            let primary = !useFallback
            if (primary) {
                if (Date.now() < circuitOpenUntil) {
                    if (switchToFallback('circuit_open')) { model = fallbackModel!; primary = false }
                } else if (!(await deps.takeModelSlot().catch(() => true))) {
                    if (switchToFallback('model_throttle')) { model = fallbackModel!; primary = false }
                }
            }

            let callText = ''
            let reasoning = ''
            let usage: Usage | undefined
            const toolCalls: { id: string; name: string; args: string }[] = []
            let attempt = 0
            let done = false
            while (!done) {
                attempt++
                const body: Record<string, unknown> = {
                    messages,
                    tools: TOOLS,
                    tool_choice: toolChoice,
                    parallel_tool_calls: true,
                    ...(primary ? { reasoning_effort: decision.reasoning } : {}),
                    max_completion_tokens: decision.reasoning === 'low' ? 1200 : 600,
                    temperature: 0.4,
                    stream: true,
                    stream_options: { include_usage: true },
                }
                calls++
                log.modelCalls = calls
                log.model = model
                const opened = await openCall(model, primary, body)
                let streamError = false
                if (opened.ok) {
                    let deeperActive = false
                    try {
                        for await (const ev of parseWorkersAiSse(opened.body)) {
                            if (ev.t === 'text') {
                                if (deeperActive) {
                                    out({ t: 'step', id: 'deeper', state: 'done' })
                                    deeperActive = false
                                }
                                callText += ev.v
                                for (const piece of guard.push(ev.v)) out({ t: 'text', v: piece })
                            } else if (ev.t === 'reasoning') {
                                reasoning += ev.v
                                if (!flags.has('deeper')) {
                                    flags.add('deeper')
                                    deeperActive = true
                                    out({ t: 'step', id: 'deeper', state: 'active' })
                                }
                            } else if (ev.t === 'tool') {
                                toolCalls.push(ev)
                            } else if (ev.t === 'usage') {
                                usage = ev.u
                            }
                        }
                    } catch {
                        streamError = true
                    }
                    if (deeperActive) out({ t: 'step', id: 'deeper', state: 'done' })
                }
                if (turnAbort.signal.aborted && (timedOut || signal?.aborted)) throw new Error('aborted')

                // Cost of this call (usage tail, else characters / 3)
                const inEst = Math.ceil(JSON.stringify(body).length / 3)
                const outEst = Math.ceil((callText.length + reasoning.length + toolCalls.reduce((n, t) => n + t.args.length + t.name.length, 0)) / 3)
                const u = {
                    inTokens: usage?.prompt_tokens ?? (opened.ok ? inEst : 0),
                    cachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
                    outTokens: usage?.completion_tokens ?? (opened.ok ? outEst : 0),
                }
                log.inTokens += u.inTokens
                log.cachedTokens += u.cachedTokens
                log.outTokens += u.outTokens
                log.costMicroUsd += costMicroUsd(model, u)

                if (opened.ok && !streamError) {
                    done = true
                    break
                }
                // Failure: 429 / 3040 opens the circuit; one fallback attempt while no text was shown
                const msg = opened.ok ? '' : opened.message
                const status = opened.ok ? null : opened.status
                if (primary && (status === 429 || /\b(429|3040)\b/.test(msg))) circuitOpenUntil = Date.now() + 60_000
                const retryable = status == null || status === 429 || status === 408 || status >= 500 || /\b3040\b/.test(msg)
                guard.discard()
                callText = ''
                reasoning = ''
                toolCalls.length = 0
                usage = undefined
                if (primary && retryable && !textSent && attempt === 1 && switchToFallback('primary_error')) {
                    model = fallbackModel!
                    primary = false
                    continue
                }
                failed = true
                done = true
            }
            if (failed) break

            for (const piece of guard.flush()) out({ t: 'text', v: piece })
            if (toolCalls.length === 0) break

            // ---- Tools ----
            let execs = toolCalls
            if (execs.length > 3) {
                flags.add('tool_overflow')
                execs = execs.slice(0, 3)
            }
            let dataCalled = false
            const executed: typeof toolCalls = []
            const toolMessages: ChatMessage[] = []
            for (const tc of execs) {
                if (!isKnownTool(tc.name)) {
                    flags.add('unknown_tool')
                    stopTurn = true
                    break
                }
                if (DATA_TOOLS.has(tc.name) && call === 2) {
                    flags.add('loop_cap')
                    continue
                }
                log.tools.push(tc.name)
                out({ t: 'step', id: TOOL_STEP[tc.name], state: 'active' })
                let r: ToolResult
                try {
                    r = await runTool(tc.name, tc.args, ctx)
                } catch {
                    flags.add('tool_error')
                    r = { forModel: '<urun_verisi>{"hata":"arac_hatasi"}</urun_verisi>', events: [], steps: [{ t: 'step' as const, id: TOOL_STEP[tc.name], state: 'done' as const }], isData: true, productIds: [] }
                }
                r.steps.forEach(out)
                r.events.forEach(out)
                addToolText(allowed, `${r.forModel}\n${catalogLinesFor(k, r.productIds)}`)
                if (r.isData) dataCalled = true
                executed.push(tc)
                toolMessages.push({ role: 'tool', tool_call_id: tc.id, content: r.forModel })
            }
            if (stopTurn || call === 2 || !dataCalled) break
            messages.push({
                role: 'assistant',
                content: callText,
                tool_calls: executed.map(tc => ({ id: tc.id, type: 'function' as const, function: { name: tc.name, arguments: tc.args } })),
                ...(decision.reasoning === 'low' && reasoning ? { reasoning_content: reasoning } : {}),
            })
            messages.push(...toolMessages)
        }

        if (failed) {
            log.outcome = 'error'
            out({ t: 'text', v: CANNED.busy })
            whatsappEvents(ctx, { reason: 'other', summary: masked, productIds: [], variant: 'full' })?.forEach(out)
            finishLog()
            finish('error')
            return log
        }

        for (const piece of guard.flush()) out({ t: 'text', v: piece })
        let forceCompact = false
        if (!textSent) {
            const first = state.shown[0]
            if (first) out({ t: 'text', v: DEFAULT_TEXT[first] })
            else {
                out({ t: 'text', v: CANNED.unsure })
                forceCompact = true
            }
        }

        // ---- Server-added WhatsApp cards (4.3) ----
        if (decision.serverHandoff && state.waVariant !== 'full') {
            whatsappEvents(ctx, { reason: decision.serverHandoff, summary: masked, productIds: [], variant: 'full' })?.forEach(out)
        }
        if (state.waVariant == null) {
            const recentWa = req.history.filter(h => h.role === 'assistant').slice(-2).some(h => h.wa)
            if (forceCompact || decision.compactHandoff || (state.productIds.length > 0 && !recentWa)) {
                whatsappEvents(ctx, { reason: decision.compactHandoff ?? 'other', summary: masked, productIds: [], variant: 'compact' })?.forEach(out)
            }
        }

        const end: TurnEnd = state.waVariant === 'full'
            ? { kind: 'whatsapp_full' }
            : state.shown.includes('compare')
                ? { kind: 'compare' }
                : state.shown.includes('products')
                    ? { kind: 'products', group: state.productGroup }
                    : { kind: 'other' }
        const chips = buildSuggestions(end, { remaining: cart ? cart.remaining : null, waShown: state.waVariant != null })
        if (chips.length) out({ t: 'suggestions', chips })

        if (useFallback) {
            log.mode = 'fallback'
            log.outcome = 'fallback'
        }
        finishLog()
        finish(state.shown.length ? 'cards' : 'stop')
        return log
    } catch (err) {
        if (timedOut) {
            log.outcome = 'timeout'
            flags.add('timeout')
            out({ t: 'error', code: 'timeout' })
            if (k && state.waVariant == null) whatsappEvents({ k, state }, { reason: 'other', summary: masked, productIds: [], variant: 'compact' })?.forEach(out)
            finishLog()
            finish('error')
            return log
        }
        if (signal?.aborted) {
            log.outcome = 'aborted'
            finishLog()
            return log
        }
        throw err
    } finally {
        clearTimeout(turnTimer)
        signal?.removeEventListener('abort', onParentAbort)
        finishLog()
    }

    function finishLog() {
        for (const f of guardFlags) flags.add(f)
        log.flags = [...flags]
        log.products = [...state.productIds]
        log.handoff = state.handoff
        log.totalMs = Date.now() - started
    }
}

function pageRow(page: PageContext, k: Knowledge): CatalogRow | null {
    return page.type === 'product' ? k.bySlug.get(page.slug) ?? null : null
}
