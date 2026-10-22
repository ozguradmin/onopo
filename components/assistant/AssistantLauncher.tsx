'use client'

/**
 * Onopo Asistan launcher (SPEC §10.3, redesigned in w7 because the owner did not like the plain round icon),
 * part of the shell: a 52 px brand-blue circle with a crisp chat-bubble-and-sparkle glyph on phones, an
 * "Asistana sor" pill with the same glyph on desktop; a soft blue shadow and one short entrance (no constant
 * animation; none under reduced motion). Rendered only after hydration and an idle callback (AssistantRoot), so it changes nothing in
 * the server HTML, LCP or CLS, and it makes no request: the chat chunk starts loading on pointerdown, hover
 * or focus (preloadAssistant) and the panel mounts on the first tap.
 *
 * It gets out of the way (fades, pointer-events none, inert) while a toast is up (CSS, app/globals.css),
 * the cart, menu or search is open, the panel is open, a text field outside the panel has focus (the phone
 * keyboard is up) and while the visitor scrolls down; it comes back on scroll up or 600 ms after scrolling
 * stops. Its bottom offset (above the bottom nav or the PDP buy bar) also lives in app/globals.css.
 *
 * The one nudge of v1: on a product page after 25 s without an add to cart, a small bubble offers help with
 * compatibility. At most once per session and 3 times per 7 days, never after 2 closes in 30 days and never
 * once the chat was used. It is aria-hidden (no live announcement); the launcher stays the accessible entry.
 */
import * as React from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCartStore } from '@/store/cart-store'
import { useShellUI } from '@/components/layout/shell-ui'
import { useAssistantStore } from './assistant-store'
import { preloadAssistant } from './preload'

/** Rounded speech bubble filling the 24 px grid (2.5…21.5 × 3…21), tail at the bottom left. */
const BUBBLE = 'M6.5 3h11a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-5.6l-4.25 3.2c-.53.4-1.29.02-1.29-.64V18H6.5a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z'
/** Big four-point sparkle in the bubble's centre, and a small one up right: "AI" at a glance. */
const SPARKLE = 'M11.2 5.6c.5 2.75 1.95 4.2 4.7 4.7-2.75.5-4.2 1.95-4.7 4.7-.5-2.75-1.95-4.2-4.7-4.7 2.75-.5 4.2-1.95 4.7-4.7Z'
const SPARKLE_SMALL = 'M17.1 5.2c.2 1.05.75 1.6 1.8 1.8-1.05.2-1.6.75-1.8 1.8-.2-1.05-.75-1.6-1.8-1.8 1.05-.2 1.6-.75 1.8-1.8Z'

/**
 * Chat bubble with a four-point sparkle, drawn on a 24 px grid. "line" (panel header, on a light chip): the
 * bubble outlined and the sparkle filled in currentColor. "solid" (launcher, on brand blue): a white bubble
 * with the sparkle cut out in brand blue. Also used by the panel through icons.tsx.
 */
export function AssistantIcon({ className, variant = 'line' }: { className?: string; variant?: 'line' | 'solid' }) {
    if (variant === 'solid') {
        return (
            <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
                <path d={BUBBLE} fill="currentColor" />
                <path d={SPARKLE} className="fill-brand-600" />
                <path d={SPARKLE_SMALL} className="fill-brand-500" />
            </svg>
        )
    }
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" focusable="false">
            <path d={BUBBLE} stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
            <path d={SPARKLE} fill="currentColor" />
            <path d={SPARKLE_SMALL} fill="currentColor" />
        </svg>
    )
}

const INTRO_KEY = 'onopo:assistant:intro'
const NUDGE_KEY = 'onopo:assistant:nudge'
const NUDGE_SESSION_KEY = 'onopo:assistant:nudged'
const DAY = 24 * 60 * 60 * 1000

/**
 * A product page ("/<slug>/"): the same rule as page-context.ts isProductPath, repeated here so the shell does
 * not carry the whole page-context module (it is only needed once the chat chunk loads).
 */
const PRODUCT_PATH = /^\/(?!(?:admin|api|categories|kategori|login|maintenance|odeme|orders|page|product|products|profile|register|siparis-basarili|siparis-hata|help|policy|shipping|terms)\/?$)[a-z0-9-]{1,120}\/?$/

function isTextField(el: EventTarget | null): boolean {
    if (!(el instanceof HTMLElement)) return false
    if (el instanceof HTMLTextAreaElement || el.isContentEditable) return true
    return el instanceof HTMLInputElement && /^(text|search|email|tel|number|password|url)$/.test(el.type)
}

function reducedMotion(): boolean {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
        return false
    }
}

export function AssistantLauncher() {
    const path = usePathname() || '/'
    const visible = useAssistantStore(s => s.open && !s.minimized)
    const unread = useAssistantStore(s => s.unread)
    const hasConversation = useAssistantStore(s => s.hasConversation)
    const used = useAssistantStore(s => s.openCount > 0 || s.hasConversation)
    const openAssistant = useAssistantStore(s => s.openAssistant)
    const cartOpen = useCartStore(s => s.isOpen)
    const menuOpen = useShellUI(s => s.menuOpen)
    const searchOpen = useShellUI(s => s.searchOpen)
    const [scrolling, setScrolling] = React.useState(false)
    const [typing, setTyping] = React.useState(false)
    const [intro, setIntro] = React.useState(false)

    // Scrolling down hides it (it would cover the cards' round quick-add buttons); up or a pause brings it back
    React.useEffect(() => {
        let last = window.scrollY
        let raf = 0
        let timer: ReturnType<typeof setTimeout> | undefined
        const onScroll = () => {
            if (raf) return
            raf = requestAnimationFrame(() => {
                raf = 0
                const y = window.scrollY
                if (y > last + 4) setScrolling(true)
                else if (y < last - 4) setScrolling(false)
                last = y
                clearTimeout(timer)
                timer = setTimeout(() => setScrolling(false), 600)
            })
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            window.removeEventListener('scroll', onScroll)
            cancelAnimationFrame(raf)
            clearTimeout(timer)
        }
    }, [])

    // A text field outside the panel has focus: the phone keyboard is up
    React.useEffect(() => {
        const check = () => {
            const el = document.activeElement
            setTyping(isTextField(el) && !(el as HTMLElement).closest('#onopo-assistant'))
        }
        const onFocusOut = () => setTimeout(check, 0)
        document.addEventListener('focusin', check)
        document.addEventListener('focusout', onFocusOut)
        return () => {
            document.removeEventListener('focusin', check)
            document.removeEventListener('focusout', onFocusOut)
        }
    }, [])

    // First visit on this device: the circle reads "Asistan" for 4 s
    React.useEffect(() => {
        try {
            if (localStorage.getItem(INTRO_KEY) || reducedMotion()) return
            localStorage.setItem(INTRO_KEY, '1')
        } catch {
            return
        }
        setIntro(true)
        const t = setTimeout(() => setIntro(false), 4000)
        return () => clearTimeout(t)
    }, [])

    const hidden = visible || cartOpen || menuOpen || searchOpen || scrolling || typing
    const nudge = useNudge(path, used)
    const label = hasConversation ? 'Sohbete devam et' : 'Asistana sor'

    return (
        <div
            data-assistant-launcher=""
            inert={hidden}
            className={cn(
                'fixed right-3 z-launcher transition-[opacity,scale] duration-200 ease-sheet md:right-6',
                hidden && 'pointer-events-none scale-90 opacity-0',
            )}
        >
            {nudge.show && !hidden && (
                <div
                    aria-hidden="true"
                    onClick={() => {
                        nudge.hide()
                        openAssistant({ source: 'nudge' })
                    }}
                    onPointerDown={preloadAssistant}
                    className="absolute bottom-full right-0 mb-2 flex w-max max-w-[240px] cursor-pointer items-start gap-1 rounded-card border border-line bg-white py-2.5 pl-3 pr-1 text-[13px] leading-5 text-ink-2 shadow-overlay"
                >
                    <span className="py-0.5">Bu ürün telefonuna uyar mı? Sor, hemen söyleyeyim.</span>
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={e => {
                            e.stopPropagation()
                            nudge.dismiss()
                        }}
                        className="-my-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}
            <button
                type="button"
                aria-label={unread ? "Onopo Asistan'ı aç, 1 yeni yanıt" : "Onopo Asistan'ı aç"}
                aria-haspopup="dialog"
                aria-expanded={visible}
                aria-controls="onopo-assistant"
                onClick={() => {
                    nudge.hide()
                    openAssistant({ source: 'launcher' })
                }}
                onPointerDown={preloadAssistant}
                onPointerEnter={preloadAssistant}
                onFocus={preloadAssistant}
                className={cn(
                    'animate-ai-launcher-in relative flex h-14 items-center justify-center gap-2 rounded-full text-white',
                    // Brand gradient with a soft top highlight, a thin white rim and a blue glow underneath
                    'bg-[radial-gradient(120%_90%_at_30%_15%,rgb(255_255_255/0.28),transparent_55%),linear-gradient(140deg,#14A6DB_0%,#0090C8_45%,#00658F_100%)]',
                    'shadow-[0_10px_26px_-6px_rgb(0_119_168/0.6),0_2px_6px_rgb(11_18_32/0.14)] ring-2 ring-white',
                    'transition-[scale,filter] duration-150 hover:brightness-110 active:scale-[0.96] motion-reduce:transition-none',
                    'md:h-[52px] md:w-auto md:pl-3 md:pr-5',
                    intro ? 'pl-3 pr-5' : 'w-14',
                )}
            >
                <AssistantIcon variant="solid" className="h-[30px] w-[30px] shrink-0 drop-shadow-[0_1px_1px_rgb(0_60_90/0.35)] md:h-7 md:w-7" />
                <span className={intro ? 'text-[15px] font-semibold md:hidden' : 'hidden'}>Asistan</span>
                <span className="hidden text-[15px] font-semibold tracking-[-0.01em] md:inline">{label}</span>
                {unread && <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-sale ring-2 ring-white" />}
            </button>
        </div>
    )
}

interface NudgeLog {
    shown: number[]
    closes: number[]
}

function readNudgeLog(): NudgeLog {
    try {
        const v = JSON.parse(localStorage.getItem(NUDGE_KEY) || '{}')
        return { shown: Array.isArray(v.shown) ? v.shown : [], closes: Array.isArray(v.closes) ? v.closes : [] }
    } catch {
        return { shown: [], closes: [] }
    }
}

function writeNudgeLog(log: NudgeLog) {
    try {
        localStorage.setItem(NUDGE_KEY, JSON.stringify(log))
    } catch {
        // storage blocked: the session flag still limits it
    }
}

function cartCount(): number {
    return useCartStore.getState().items.reduce((n, i) => n + (Number(i.quantity) || 0), 0)
}

/**
 * The PDP nudge: 25 s on a product page with no add to cart. The 10 s "not at the start of a session" rule
 * is implied (the timer starts with the page). Storage errors mean no nudge.
 */
function useNudge(path: string, used: boolean) {
    const [show, setShow] = React.useState(false)

    React.useEffect(() => {
        setShow(false)
        if (used || !PRODUCT_PATH.test(path)) return
        const before = cartCount()
        const t = setTimeout(() => {
            const now = Date.now()
            if (cartCount() > before) return
            try {
                if (sessionStorage.getItem(NUDGE_SESSION_KEY)) return
                sessionStorage.setItem(NUDGE_SESSION_KEY, '1')
            } catch {
                return
            }
            const log = readNudgeLog()
            const shown = log.shown.filter(x => now - x < 7 * DAY)
            const closes = log.closes.filter(x => now - x < 30 * DAY)
            if (shown.length >= 3 || closes.length >= 2) return
            writeNudgeLog({ shown: [...shown, now], closes })
            setShow(true)
        }, 25_000)
        return () => clearTimeout(t)
    }, [path, used])

    React.useEffect(() => {
        if (!show) return
        const t = setTimeout(() => setShow(false), 8000)
        return () => clearTimeout(t)
    }, [show])

    return {
        show: show && !used,
        hide: () => setShow(false),
        dismiss: () => {
            setShow(false)
            const log = readNudgeLog()
            writeNudgeLog({ shown: log.shown, closes: [...log.closes.filter(x => Date.now() - x < 30 * DAY), Date.now()] })
        },
    }
}
