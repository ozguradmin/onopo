'use client'

/**
 * Onopo Asistan: the conversation (lazy chat chunk, SPEC §10.8). One hook owns the messages, sends a turn
 * to POST /api/ai/chat/, reads the SSE stream with the contract's decoder and folds each event into the
 * assistant message (chat-reducer.ts). It also keeps the conversation in this tab's sessionStorage, sends
 * the content-free UI beacons and builds the WhatsApp cards the UI adds by itself.
 *
 * Why no chat SDK: the server already sends validated sentences and our own card events, so a fetch, the
 * decoder and a reducer are all the client needs (SPEC D4), and the chat chunk stays around 20 kB.
 *
 * Timers: the server answers within 30 s; the client gives up at 35 s (LIMITS.clientTimeoutMs) and shows
 * the timeout row. "Durdur" aborts the request and keeps the partial text. A stream that ends without
 * `done` is a broken reply ("Bu yanıt yarım kaldı."). Nothing here logs or stores text anywhere else.
 */
import * as React from 'react'
import {
    ASSISTANT_API_PATH,
    ASSISTANT_EVENT_PATH,
    LIMITS,
    createEventDecoder,
    stepLabel,
    type AssistantEvent,
    type CardProduct,
    type ChatRequest,
    type ChipAction,
    type ErrorCode,
    type HandoffReason,
    type UiEventBody,
    type UiEventType,
} from '@/lib/assistant/contract'
import { useCartStore } from '@/store/cart-store'
import { useSiteSettings } from '@/components/layout/store-data'
import { loadSearchIndex } from '@/components/search/search-index'
import { assistantVisible, useAssistantStore, type AssistantSource } from './assistant-store'
import {
    applyEvent,
    assistantMessage,
    lastUserText,
    localCardMessage,
    localWhatsapp,
    mobileWaBase,
    patchStaleCards,
    settleSteps,
    toHistory,
    userMessage,
    type UiErrorCode,
    type UiMessage,
} from './chat-reducer'
import { clearChat, loadChat, saveChat, type StorageLike } from './persist'
import { cartContext, pageContext } from './page-context'

const ERROR_CODES: ReadonlySet<string> = new Set([
    'bad_request', 'forbidden', 'too_long', 'rate_limited', 'conversation_limit',
    'off', 'maintenance', 'busy', 'timeout', 'upstream',
])
/** Errors whose row offers the full WhatsApp card instead of "Tekrar dene" */
const WA_ERRORS: ReadonlySet<UiErrorCode> = new Set(['off', 'maintenance', 'busy'])
const STALE_AFTER_MS = 30 * 60 * 1000
const STEP_ANNOUNCE_MS = 1500

function sessionStore(): StorageLike | null {
    try {
        return window.sessionStorage
    } catch {
        return null
    }
}

function newConversationId(): string {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    } catch {
        // insecure context: fall through
    }
    const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`
}

/** Content-free UI event (no text ever): sendBeacon, or a keepalive fetch where it is missing or refused. */
export function sendUiBeacon(body: UiEventBody): void {
    try {
        const json = JSON.stringify(body)
        if (navigator.sendBeacon?.(ASSISTANT_EVENT_PATH, new Blob([json], { type: 'application/json' }))) return
        fetch(ASSISTANT_EVENT_PATH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: true }).catch(() => { })
    } catch {
        // never let analytics break the chat
    }
}

interface ChatState {
    conversationId: string
    messages: UiMessage[]
    waBase: string | null
}

interface Running {
    ctrl: AbortController
    id: string
    reason: 'stop' | 'timeout' | null
}

export interface AssistantChat {
    messages: UiMessage[]
    streaming: boolean
    /** wa.me base for local WhatsApp cards: last `meta` event, else the store's number; null hides WhatsApp UI */
    waBase: string | null
    offline: boolean
    /** rate limited until this time (ms); send is disabled */
    blockedUntil: number
    /** a product was added to the cart from the chat (shows the cart strip) */
    addedFromChat: boolean
    /** polite status line for screen readers */
    announcement: string
    send: (input: string, chip?: ChipAction) => void
    stop: () => void
    /** "Tekrar dene" / "Devam et": drop that turn and send its message again */
    retry: (assistantId?: string) => void
    newChat: () => void
    insertWhatsapp: (reason: HandoffReason, opts?: { product?: CardProduct | null; summary?: string }) => void
    beacon: (type: UiEventType, extra?: { productId?: number; reason?: HandoffReason; source?: AssistantSource }) => void
    noteAddToCart: (productId: number) => void
    /** messages restored from storage at mount (their WhatsApp cards were already beaconed) */
    restoredIds: ReadonlySet<string>
}

export function useAssistantChat(): AssistantChat {
    const settings = useSiteSettings()
    // Before the first `meta` event (and on error rows, which never get one): the same chain as the server,
    // the Admin › AI Asistan number, else whatsapp_number, else the footer phone; mobile numbers only
    const fallbackWaBase = React.useMemo(
        () => mobileWaBase(settings.ai_whatsapp_number, settings.whatsapp_number, settings.footer_phone),
        [settings.ai_whatsapp_number, settings.whatsapp_number, settings.footer_phone],
    )

    const [restored] = React.useState(() => loadChat(sessionStore()))
    const [chat, setChat] = React.useState<ChatState>(() => ({
        conversationId: restored?.conversationId ?? newConversationId(),
        messages: restored?.messages ?? [],
        waBase: null,
    }))
    const restoredIds = React.useMemo(() => new Set((restored?.messages ?? []).map(m => m.id)), [restored])
    const chatRef = React.useRef(chat)
    const running = React.useRef<Running | null>(null)
    const [streaming, setStreaming] = React.useState(false)
    const [offline, setOffline] = React.useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)
    const [blockedUntil, setBlockedUntil] = React.useState(0)
    const [addedFromChat, setAddedFromChat] = React.useState(false)
    const [announcement, setAnnouncement] = React.useState('')
    const lastStepAnnounce = React.useRef(0)
    const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    const waBase = chat.waBase ?? fallbackWaBase

    /** Every change goes through here: the ref is current at once, so back-to-back actions see each other. */
    const commit = React.useCallback((next: Partial<ChatState>) => {
        chatRef.current = { ...chatRef.current, ...next }
        setChat(chatRef.current)
    }, [])
    const mutate = React.useCallback((fn: (m: UiMessage[]) => UiMessage[]) => commit({ messages: fn(chatRef.current.messages) }), [commit])
    const update = React.useCallback(
        (id: string, fn: (m: UiMessage) => UiMessage) => mutate(list => list.map(m => (m.id === id ? fn(m) : m))),
        [mutate],
    )

    const saveNow = React.useCallback(() => {
        clearTimeout(saveTimer.current)
        const c = chatRef.current
        if (c.messages.length === 0) return
        saveChat(sessionStore(), { conversationId: c.conversationId, device: useAssistantStore.getState().device, messages: c.messages })
    }, [])
    const scheduleSave = React.useCallback(() => {
        clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(saveNow, 500)
    }, [saveNow])

    const beacon = React.useCallback<AssistantChat['beacon']>((type, extra = {}) => {
        sendUiBeacon({ v: 1, conversationId: chatRef.current.conversationId, type, ...extra })
    }, [])

    // ---- mount: restore device, refresh old prices, follow online state, save on pagehide ----------
    React.useEffect(() => {
        if (restored) {
            useAssistantStore.setState({ hasConversation: restored.messages.length > 0, ...(restored.device ? { device: restored.device } : {}) })
            const hasCards = restored.messages.some(m => m.cards.length > 0)
            if (hasCards && Date.now() - restored.updatedAt > STALE_AFTER_MS) {
                loadSearchIndex()
                    .then(items => mutate(list => patchStaleCards(list, items)))
                    .catch(() => { })
            }
        }
        const onOnline = () => setOffline(false)
        const onOffline = () => setOffline(true)
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        window.addEventListener('pagehide', saveNow)
        return () => {
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
            window.removeEventListener('pagehide', saveNow)
            running.current?.ctrl.abort()
            saveNow()
        }
        // once per mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Re-enable sending when a rate limit runs out
    React.useEffect(() => {
        if (blockedUntil <= Date.now()) return
        const t = setTimeout(() => setBlockedUntil(0), blockedUntil - Date.now())
        return () => clearTimeout(t)
    }, [blockedUntil])

    // ---- one turn ---------------------------------------------------------------------------------
    const fail = React.useCallback(
        (id: string, code: UiErrorCode, retryAfter?: number) => {
            update(id, m => {
                const next: UiMessage = {
                    ...m,
                    status: 'error',
                    steps: settleSteps(m.steps),
                    error: retryAfter != null ? { code, retryAfter } : { code },
                }
                const base = chatRef.current.waBase ?? fallbackWaBase
                if (WA_ERRORS.has(code) && !m.whatsapp && base) {
                    next.whatsapp = localWhatsapp({ reason: 'other', summary: lastUserText(chatRef.current.messages), waBase: base })
                    next.wa = true
                }
                return next
            })
            if (code === 'rate_limited') setBlockedUntil(Date.now() + Math.min(600, Math.max(1, retryAfter ?? 10)) * 1000)
        },
        [update, fallbackWaBase],
    )

    const handleEvents = React.useCallback(
        (id: string, events: AssistantEvent[]) => {
            for (const ev of events) {
                if (ev.t === 'meta' && ev.waBase) commit({ waBase: ev.waBase })
                else if (ev.t === 'device') useAssistantStore.setState({ device: ev.v.slice(0, 40) })
                else if (ev.t === 'step' && ev.state === 'active') {
                    const label = stepLabel(ev.id, 'active', ev.n)
                    const now = Date.now()
                    if (label && now - lastStepAnnounce.current >= STEP_ANNOUNCE_MS) {
                        lastStepAnnounce.current = now
                        setAnnouncement(label)
                    }
                }
            }
            update(id, m => events.reduce(applyEvent, m))
        },
        [commit, update],
    )

    const finishTurn = React.useCallback(
        (id: string) => {
            const m = chatRef.current.messages.find(x => x.id === id)
            if (m && m.status !== 'stopped') {
                if (m.productIds.length > 0) setAnnouncement(`Yanıt hazır, ${m.productIds.length} ürün önerildi`)
                else if (m.wa) setAnnouncement('WhatsApp mesajı hazır')
                else if (m.status === 'done') setAnnouncement('Yanıt hazır')
                if (!assistantVisible(useAssistantStore.getState())) useAssistantStore.setState({ unread: true })
            }
            scheduleSave()
        },
        [scheduleSave],
    )

    const run = React.useCallback(
        async (id: string, body: ChatRequest) => {
            const ctrl = new AbortController()
            const r: Running = { ctrl, id, reason: null }
            running.current = r
            setStreaming(true)
            setAnnouncement('Asistan yanıt hazırlıyor')
            const timer = setTimeout(() => {
                r.reason = 'timeout'
                ctrl.abort()
            }, LIMITS.clientTimeoutMs)
            try {
                const res = await fetch(ASSISTANT_API_PATH, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: ctrl.signal,
                })
                if (!res.ok) {
                    const j = (await res.json().catch(() => null)) as { error?: string; retryAfter?: number } | null
                    const code = j?.error && ERROR_CODES.has(j.error) ? (j.error as ErrorCode) : res.status === 429 ? 'rate_limited' : 'upstream'
                    fail(id, code, typeof j?.retryAfter === 'number' ? j.retryAfter : undefined)
                    return
                }
                if (!res.body) {
                    fail(id, 'network')
                    return
                }
                const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
                const decode = createEventDecoder()
                let finished = false
                while (!finished) {
                    const { value, done } = await reader.read()
                    if (done) break
                    const events = decode(value)
                    if (events.length === 0) continue
                    handleEvents(id, events)
                    finished = events.some(e => e.t === 'done')
                }
                if (finished) reader.cancel().catch(() => { })
                else fail(id, 'network')
            } catch {
                if (r.reason === 'stop') {
                    update(id, m => ({ ...m, status: 'stopped', steps: settleSteps(m.steps) }))
                } else if (r.reason === 'timeout') {
                    fail(id, 'timeout')
                } else {
                    fail(id, typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'network')
                }
            } finally {
                clearTimeout(timer)
                if (running.current === r) running.current = null
                setStreaming(false)
                finishTurn(id)
            }
        },
        [fail, finishTurn, handleEvents, update],
    )

    const send = React.useCallback<AssistantChat['send']>(
        (raw, chip) => {
            const input = raw.trim().slice(0, LIMITS.inputMaxChars)
            if (!input || running.current || Date.now() < blockedUntil) return
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                setOffline(true)
                return
            }
            const prev = chatRef.current.messages
            const history = toHistory(prev)
            const turn = prev.filter(m => m.role === 'user').length + 1
            const user = userMessage(input, chip)
            const reply = assistantMessage()
            mutate(list => [...list, user, reply])
            useAssistantStore.setState({ hasConversation: true })
            if (turn > LIMITS.conversationMaxUserTurns) {
                fail(reply.id, 'conversation_limit')
                finishTurn(reply.id)
                return
            }
            const body: ChatRequest = {
                v: 1,
                conversationId: chatRef.current.conversationId,
                input,
                ...(chip ? { chip } : {}),
                history,
                context: {
                    page: pageContext(window.location.pathname, window.location.search),
                    cart: cartContext(useCartStore.getState().items, LIMITS.cartMaxLines),
                    device: useAssistantStore.getState().device,
                    turn,
                },
            }
            void run(reply.id, body)
        },
        [blockedUntil, fail, finishTurn, mutate, run],
    )

    const stop = React.useCallback(() => {
        const r = running.current
        if (!r) return
        r.reason = 'stop'
        r.ctrl.abort()
        beacon('stop')
    }, [beacon])

    const retry = React.useCallback<AssistantChat['retry']>(
        assistantId => {
            if (running.current) return
            const list = chatRef.current.messages
            const i = assistantId ? list.findIndex(m => m.id === assistantId) : list.length - 1
            if (i < 1 || list[i].role !== 'assistant' || list[i - 1].role !== 'user') return
            const user = list[i - 1]
            commit({ messages: [...list.slice(0, i - 1), ...list.slice(i + 1)] })
            send(user.text, user.chip)
        },
        [commit, send],
    )

    const newChat = React.useCallback(() => {
        running.current?.ctrl.abort()
        running.current = null
        clearTimeout(saveTimer.current)
        clearChat(sessionStore())
        commit({ conversationId: newConversationId(), messages: [], waBase: chatRef.current.waBase })
        useAssistantStore.setState({ hasConversation: false })
        setAddedFromChat(false)
        setAnnouncement('')
        beacon('new_chat')
    }, [beacon, commit])

    const insertWhatsapp = React.useCallback<AssistantChat['insertWhatsapp']>(
        (reason, opts = {}) => {
            const base = chatRef.current.waBase ?? fallbackWaBase
            if (!base) return
            const summary = opts.summary ?? lastUserText(chatRef.current.messages)
            mutate(list => [...list, localCardMessage(localWhatsapp({ reason, summary, waBase: base, product: opts.product ?? null }))])
            useAssistantStore.setState({ hasConversation: true })
            scheduleSave()
        },
        [fallbackWaBase, mutate, scheduleSave],
    )

    const noteAddToCart = React.useCallback(
        (productId: number) => {
            setAddedFromChat(true)
            setAnnouncement('Sepete eklendi')
            beacon('add_to_cart', { productId })
        },
        [beacon],
    )

    // A first message handed over by an entry point (search row, PDP chips): send it once the panel can
    const pending = useAssistantStore(s => s.pendingPrompt)
    React.useEffect(() => {
        if (!pending || streaming) return
        useAssistantStore.setState({ pendingPrompt: null })
        send(pending.input, pending.chip)
    }, [pending, streaming, send])

    return {
        messages: chat.messages,
        streaming,
        waBase,
        offline,
        blockedUntil,
        addedFromChat,
        announcement,
        send,
        stop,
        retry,
        newChat,
        insertWhatsapp,
        beacon,
        noteAddToCart,
        restoredIds,
    }
}

// ---- shared with the parts (cards, rows) through context, so they need no prop chains ------------

export interface AssistantUi {
    chat: AssistantChat
    isSheet: boolean
    freeThreshold: number
    /** call after a link from the chat was followed: phones minimise, desktop stays open */
    onNavigate: () => void
}

export const AssistantUiContext = React.createContext<AssistantUi | null>(null)

export function useAssistantUi(): AssistantUi {
    const ui = React.useContext(AssistantUiContext)
    if (!ui) throw new Error('useAssistantUi outside AssistantPanel')
    return ui
}
