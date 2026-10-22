'use client'

/**
 * Onopo Asistan panel (lazy chat chunk, SPEC §10.4): a modal sheet on phones, a 400 px non-modal panel on
 * desktop. AssistantRoot mounts it on the first open and keeps it mounted, so a reply keeps streaming and
 * the conversation stays while the panel is minimised or closed; only the frame is hidden then.
 *
 * Phone sheet: a fixed div (not <dialog>, so the cart drawer at 60 and toasts at 70 still sit above it),
 * scroll lock, focus trap, Escape / backdrop tap / swipe down on the handle minimise, and the phone keyboard
 * is followed through visualViewport (--kb) so it never covers the composer. Desktop: no backdrop, no trap;
 * focus goes to the composer on open, Escape closes and focus returns to the launcher.
 *
 * Header (kept calm on purpose, the owner found the first version cluttered): title with a small
 * "Yapay zekâ" tag, a WhatsApp button (only when a wa.me base is known), the ⋯ menu (Yeni sohbet, Telefon
 * modelini değiştir, Aydınlatma Metni) and close. The KVKK notice is no longer a box above the chat nor a
 * line under the composer: the empty chat has one muted line "Yapay zekâ asistanı · Aydınlatma Metni için
 * tıkla", and the notice itself opens in a small sheet inside the panel (role="dialog", focus moves into it
 * and back, Escape closes it first).
 */
import * as React from 'react'
import Link from 'next/link'
import { MoreHorizontal, Smartphone, WifiOff, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Suggestion } from '@/lib/assistant/contract'
import { useScrollLock, useFocusTrap, useEscape } from '@/components/layout/overlay-hooks'
import { useShippingSettings } from '@/components/layout/store-data'
import { useAssistantStore } from './assistant-store'
import { AssistantIcon, WhatsAppGlyph } from './icons'
import { AssistantUiContext, useAssistantChat, type AssistantUi } from './useAssistantChat'
import { useStickToBottom } from './useStickToBottom'
import { MessageList } from './parts/MessageList'
import { EmptyState } from './parts/EmptyState'
import { Composer } from './parts/Composer'
import { CartStrip } from './parts/CartStrip'

const PHONE_QUERY = '(max-width: 767px)'
const SWIPE_CLOSE_PX = 80

function subscribePhone(cb: () => void) {
    const mq = window.matchMedia(PHONE_QUERY)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
}

/** True under 768 px: the panel is the phone sheet. */
function usePhone(): boolean {
    return React.useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE_QUERY).matches, () => false)
}

export default function AssistantPanel() {
    const open = useAssistantStore(s => s.open)
    const minimized = useAssistantStore(s => s.minimized)
    const device = useAssistantStore(s => s.device)
    const openCount = useAssistantStore(s => s.openCount)
    const visible = open && !minimized
    const isSheet = usePhone()
    const chat = useAssistantChat()
    const { freeShippingThreshold } = useShippingSettings()

    const frameRef = React.useRef<HTMLDivElement>(null)
    const composerRef = React.useRef<HTMLTextAreaElement>(null)
    const { scrollRef, contentRef, away, scrollToBottom } = useStickToBottom()
    const [draft, setDraft] = React.useState('')
    const [menuOpen, setMenuOpen] = React.useState(false)
    const [noticeOpen, setNoticeOpen] = React.useState(false)
    const [entered, setEntered] = React.useState(false)

    // The bottom nav slides away under the sheet (MobileNav reads open && !minimized && isSheet)
    React.useEffect(() => {
        useAssistantStore.setState({ isSheet })
    }, [isSheet])

    // One 'open' beacon per open, with where it came from
    React.useEffect(() => {
        if (openCount > 0) chat.beacon('open', { source: useAssistantStore.getState().source })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openCount])

    // Slide in (the frame mounts translated, then moves to 0 in the next frame)
    React.useEffect(() => {
        if (!visible) {
            setEntered(false)
            setMenuOpen(false)
            setNoticeOpen(false)
            return
        }
        // Two frames: the first one lays the frame out (it was display: none), the second starts the slide
        let raf = requestAnimationFrame(() => {
            raf = requestAnimationFrame(() => setEntered(true))
        })
        return () => cancelAnimationFrame(raf)
    }, [visible])

    const minimize = React.useCallback(() => useAssistantStore.getState().minimize(), [])
    const closeDesktop = React.useCallback(() => {
        useAssistantStore.getState().close()
        // Back to the launcher, which is shown again in this same update
        requestAnimationFrame(() => document.querySelector<HTMLElement>('button[aria-controls="onopo-assistant"]')?.focus())
    }, [])
    const dismiss = isSheet ? minimize : closeDesktop

    useScrollLock(visible && isSheet)
    useFocusTrap(frameRef, visible && isSheet, composerRef, { restore: true })
    useEscape(visible, () => (noticeOpen ? closeNotice() : menuOpen ? setMenuOpen(false) : dismiss()))

    // Desktop: focus goes to the composer on open (the phone sheet's focus trap does it there)
    React.useEffect(() => {
        if (!visible || isSheet) return
        const raf = requestAnimationFrame(() => composerRef.current?.focus({ preventScroll: true }))
        return () => cancelAnimationFrame(raf)
    }, [visible, isSheet])

    // Phone keyboard: keep the sheet above it (--kb = the part of the layout viewport it covers)
    React.useEffect(() => {
        const vv = window.visualViewport
        const el = frameRef.current
        if (!visible || !isSheet || !vv || !el) return
        const update = () => {
            const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
            el.style.setProperty('--kb', `${kb}px`)
        }
        update()
        vv.addEventListener('resize', update)
        vv.addEventListener('scroll', update)
        return () => {
            vv.removeEventListener('resize', update)
            vv.removeEventListener('scroll', update)
            el.style.removeProperty('--kb')
        }
    }, [visible, isSheet])

    // A message just sent: follow the reply again
    const lastId = chat.messages[chat.messages.length - 1]?.id
    React.useEffect(() => {
        if (lastId) scrollToBottom(false)
    }, [lastId, scrollToBottom])

    const onNavigate = React.useCallback(() => {
        if (isSheet) minimize()
    }, [isSheet, minimize])

    const ui: AssistantUi = React.useMemo(
        () => ({ chat, isSheet, freeThreshold: freeShippingThreshold, onNavigate }),
        [chat, isSheet, freeShippingThreshold, onNavigate],
    )

    const send = (input: string, chip?: Suggestion['chip']) => {
        if (chip === 'whatsapp') {
            chat.insertWhatsapp('other')
            return
        }
        chat.send(input, chip)
    }
    const onChip = (s: Suggestion) => send(s.label, s.chip)
    const onSend = () => {
        const text = draft.trim()
        if (!text) return
        send(text)
        setDraft('')
    }

    const changeDevice = () => {
        setMenuOpen(false)
        useAssistantStore.setState({ device: null })
        setDraft('Telefonum: ')
        requestAnimationFrame(() => {
            const el = composerRef.current
            if (!el) return
            el.focus()
            el.setSelectionRange(el.value.length, el.value.length)
        })
    }

    const openNotice = () => {
        setMenuOpen(false)
        setNoticeOpen(true)
    }
    function closeNotice() {
        setNoticeOpen(false)
        // Focus goes back where the visitor was: the composer (the menu that opened it is closed now)
        requestAnimationFrame(() => composerRef.current?.focus({ preventScroll: true }))
    }

    // blockedUntil goes back to 0 when a rate-limit wait is over (useAssistantChat)
    const blocked = chat.offline || chat.blockedUntil > 0
    const empty = chat.messages.length === 0

    return (
        <AssistantUiContext.Provider value={ui}>
            {visible && isSheet && <div aria-hidden="true" onClick={minimize} className="fixed inset-0 z-assistant bg-ink/40" />}
            <div
                ref={frameRef}
                id="onopo-assistant"
                role="dialog"
                aria-modal={isSheet}
                aria-labelledby="assistant-title"
                hidden={!visible}
                tabIndex={-1}
                className={cn(
                    'fixed z-assistant flex-col bg-white outline-none',
                    visible ? 'flex' : 'hidden',
                    isSheet
                        ? 'inset-x-0 bottom-0 h-[calc(100dvh-8px-var(--kb,0px))] rounded-t-sheet transition-transform duration-250 ease-sheet motion-reduce:transition-opacity'
                        : 'bottom-6 right-6 h-[min(680px,calc(100dvh-48px))] w-[400px] overflow-hidden rounded-sheet border border-line shadow-overlay 2xl:w-[420px]',
                    isSheet && !entered && 'translate-y-full motion-reduce:translate-y-0 motion-reduce:opacity-0',
                )}
            >
                {isSheet && <DragHandle onClose={minimize} />}

                {/* ---- header ---- */}
                <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line/70 pl-4 pr-1.5">
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                        <AssistantIcon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <h2 id="assistant-title" className="truncate text-[15px] font-bold leading-5 text-ink">Onopo Asistan</h2>
                        <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold leading-4 text-muted">Yapay zekâ</span>
                    </div>
                    {chat.waBase && (
                        <button
                            type="button"
                            aria-label="WhatsApp'tan yaz"
                            onClick={() => chat.insertWhatsapp('human')}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-whatsapp hover:bg-surface"
                        >
                            <WhatsAppGlyph className="h-5 w-5" />
                        </button>
                    )}
                    <div className="relative">
                        <button
                            type="button"
                            aria-label="Sohbet menüsü"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            onClick={() => setMenuOpen(v => !v)}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface"
                        >
                            <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
                        </button>
                        {menuOpen && <HeaderMenu onClose={() => setMenuOpen(false)} onNewChat={chat.newChat} onChangeDevice={changeDevice} onNotice={openNotice} />}
                    </div>
                    <button
                        type="button"
                        aria-label={isSheet ? 'Sohbeti küçült' : 'Sohbeti kapat'}
                        onClick={dismiss}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface"
                    >
                        <X aria-hidden="true" className="h-5 w-5" />
                    </button>
                </div>

                {chat.offline && (
                    <p role="status" className="flex shrink-0 items-center gap-2 border-b border-line bg-warning-50 px-4 py-2 text-[13px] leading-5 text-warning">
                        <WifiOff aria-hidden="true" className="h-4 w-4 shrink-0" />
                        İnternet bağlantın yok. Bağlanınca tekrar deneyebilirsin.
                    </p>
                )}

                {device && (
                    <div className="shrink-0 px-4 pt-2">
                        <button
                            type="button"
                            onClick={changeDevice}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] text-ink-2 hover:text-ink"
                        >
                            <Smartphone aria-hidden="true" className="h-3.5 w-3.5" />
                            <span className="font-semibold">{device}</span>
                            <span className="text-muted">· değiştir</span>
                        </button>
                    </div>
                )}

                {/* ---- transcript ---- */}
                <div className="relative min-h-0 flex-1">
                    <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain">
                        <div ref={contentRef} className="px-4 py-4">
                            {empty ? <EmptyState onChip={onChip} onNotice={openNotice} /> : <MessageList onChip={onChip} />}
                        </div>
                    </div>
                    {away && (
                        <button
                            type="button"
                            onClick={() => scrollToBottom()}
                            className="absolute bottom-3 left-1/2 h-9 -translate-x-1/2 rounded-full bg-ink px-3.5 text-[13px] font-semibold text-white shadow-raised"
                        >
                            ↓ Yeni yanıt
                        </button>
                    )}
                </div>

                {chat.addedFromChat && <CartStrip />}
                <Composer
                    value={draft}
                    onChange={setDraft}
                    onSend={onSend}
                    onStop={chat.stop}
                    streaming={chat.streaming}
                    disabled={blocked}
                    textareaRef={composerRef}
                />
                <p role="status" className="sr-only">{chat.announcement}</p>
                {noticeOpen && <NoticeSheet onClose={closeNotice} onLink={onNavigate} />}
            </div>
        </AssistantUiContext.Provider>
    )
}

/** 36 × 4 bar in a 12 px zone: a tap or a swipe down of more than 80 px minimises the sheet. */
function DragHandle({ onClose }: { onClose: () => void }) {
    const start = React.useRef<number | null>(null)
    const [dy, setDy] = React.useState(0)
    return (
        <div
            aria-hidden="true"
            onPointerDown={e => {
                start.current = e.clientY
                e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={e => {
                if (start.current != null) setDy(Math.max(0, e.clientY - start.current))
            }}
            onPointerUp={e => {
                const moved = start.current != null ? e.clientY - start.current : 0
                start.current = null
                setDy(0)
                if (moved > SWIPE_CLOSE_PX || Math.abs(moved) < 6) onClose()
            }}
            onPointerCancel={() => {
                start.current = null
                setDy(0)
            }}
            style={dy ? { transform: `translateY(${dy}px)` } : undefined}
            className="flex h-3 shrink-0 cursor-grab touch-none items-center justify-center pt-1.5"
        >
            <span className="h-1 w-9 rounded-full bg-line-strong" />
        </div>
    )
}

function HeaderMenu({ onClose, onNewChat, onChangeDevice, onNotice }: { onClose: () => void; onNewChat: () => void; onChangeDevice: () => void; onNotice: () => void }) {
    const ref = React.useRef<HTMLDivElement>(null)

    // A tap anywhere else closes it
    React.useEffect(() => {
        const onDown = (e: PointerEvent) => {
            if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose()
        }
        document.addEventListener('pointerdown', onDown)
        const raf = requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus())
        return () => {
            document.removeEventListener('pointerdown', onDown)
            cancelAnimationFrame(raf)
        }
    }, [onClose])

    const item = 'flex min-h-11 w-full items-center px-3.5 text-left text-sm font-semibold text-ink-2 hover:bg-surface focus:bg-surface focus:outline-none'
    return (
        <div ref={ref} role="menu" aria-label="Sohbet menüsü" className="absolute right-0 top-full z-10 mt-1 w-56 overflow-hidden rounded-card border border-line bg-white py-1 shadow-overlay">
            <button
                type="button"
                role="menuitem"
                onClick={() => {
                    onClose()
                    onNewChat()
                }}
                className={item}
            >
                Yeni sohbet
            </button>
            <button type="button" role="menuitem" onClick={onChangeDevice} className={item}>
                Telefon modelini değiştir
            </button>
            <button type="button" role="menuitem" onClick={onNotice} className={item}>
                Aydınlatma Metni
            </button>
        </div>
    )
}

/**
 * The KVKK notice (SPEC §9.5, w7 revision: transcripts are kept masked for up to 12 months) in a small
 * sheet over the panel. Opened from the empty chat's line or the ⋯ menu; the panel stays underneath.
 * Focus moves to "Tamam" and is kept inside while it is open; Escape (AssistantPanel) or "Tamam" closes it.
 */
function NoticeSheet({ onClose, onLink }: { onClose: () => void; onLink: () => void }) {
    const ref = React.useRef<HTMLDivElement>(null)
    const okRef = React.useRef<HTMLButtonElement>(null)

    React.useEffect(() => {
        const raf = requestAnimationFrame(() => okRef.current?.focus({ preventScroll: true }))
        return () => cancelAnimationFrame(raf)
    }, [])

    // Tab stays inside the sheet (the link and the button)
    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key !== 'Tab' || !ref.current) return
        const items = Array.from(ref.current.querySelectorAll<HTMLElement>('a[href], button'))
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
        }
    }

    return (
        <div className="absolute inset-0 z-20 flex items-end rounded-[inherit] bg-ink/30 sm:items-center sm:justify-center sm:p-4" onClick={onClose}>
            <div
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-labelledby="assistant-notice-title"
                onClick={e => e.stopPropagation()}
                onKeyDown={onKeyDown}
                className="w-full rounded-t-sheet bg-white px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-5 shadow-overlay sm:rounded-sheet sm:pb-5"
            >
                <h3 id="assistant-notice-title" className="text-[15px] font-bold leading-5 text-ink">Aydınlatma Metni</h3>
                <div className="mt-2.5 space-y-2 text-[13px] leading-5 text-ink-2">
                    <p>Onopo Asistan bir yapay zekâdır; yanıtlar otomatik üretilir ve hata içerebilir. Geçerli fiyat ve koşullar ürün sayfasında ve ödeme adımında gösterilir.</p>
                    <p>Lütfen ad, telefon, adres, T.C. kimlik ya da kart bilgisi yazma; sipariş ve kişisel işlemler için WhatsApp&apos;tan bize ulaş.</p>
                    <p>Hizmeti geliştirmek için sohbetler, kişisel bilgiler gizlenerek en çok 12 ay saklanır. Sohbetinin silinmesini istersen WhatsApp&apos;tan bize yazman yeterli.</p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                    <Link href="/policy/" prefetch={false} onClick={onLink} className="text-[13px] font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700">
                        Gizlilik politikası
                    </Link>
                    <button
                        ref={okRef}
                        type="button"
                        onClick={onClose}
                        className="h-10 rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-ink-2"
                    >
                        Tamam
                    </button>
                </div>
            </div>
        </div>
    )
}
