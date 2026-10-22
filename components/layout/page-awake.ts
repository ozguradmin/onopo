/**
 * When the store's moving parts (the home campaign slider, the top bar's rotating messages) may start: at the
 * visitor's first scroll, tap, click or key, or AUTOSTART_DELAY_MS after the page has loaded and is visible,
 * whichever comes first. Owner: on a phone that only opened the page, the banners must still slide by
 * themselves. The short still start keeps the first paint calm (a page that moves while it loads keeps
 * Speed Index counting), the timer makes sure nobody has to touch the page to see the slides.
 *
 * Plain module (no React), so scripts/page-awake.test.mjs can drive it with a fake window and document.
 */

/** Events that count as the visitor's first interaction (window listeners, passive). */
export const INTERACTION_EVENTS = ['pointerdown', 'scroll', 'keydown', 'touchstart', 'wheel'] as const

/** Without an interaction, the moving parts start this long after the page has loaded and is visible. */
export const AUTOSTART_DELAY_MS = 6000

type Listener = () => void

export interface PageAwakeEnv {
    win: {
        addEventListener(type: string, listener: Listener, options?: AddEventListenerOptions): void
        removeEventListener(type: string, listener: Listener): void
        setTimeout(handler: () => void, ms: number): unknown
        clearTimeout(id: unknown): void
    }
    doc: {
        readyState: string
        visibilityState: string
        addEventListener(type: string, listener: Listener): void
        removeEventListener(type: string, listener: Listener): void
    }
}

function browserEnv(): PageAwakeEnv | null {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null
    return {
        win: {
            addEventListener: (type, listener, options) => window.addEventListener(type, listener, options),
            removeEventListener: (type, listener) => window.removeEventListener(type, listener),
            setTimeout: (handler, ms) => window.setTimeout(handler, ms),
            clearTimeout: id => window.clearTimeout(id as number),
        },
        doc: document,
    }
}

/**
 * Calls `callback` once: at the first interaction, or `delayMs` after the page has loaded while it is visible
 * (a tab that is hidden before then waits; the countdown starts again when it is shown). Returns a cleanup
 * that removes every listener and timer without calling it.
 */
export function onPageAwake(callback: () => void, delayMs: number = AUTOSTART_DELAY_MS, env: PageAwakeEnv | null = browserEnv()): () => void {
    if (!env) return () => { }
    const { win, doc } = env
    let done = false
    let timer: unknown = null

    const disarm = () => {
        if (timer !== null) win.clearTimeout(timer)
        timer = null
    }
    const cleanup = () => {
        disarm()
        INTERACTION_EVENTS.forEach(e => win.removeEventListener(e, fire))
        win.removeEventListener('load', sync)
        doc.removeEventListener('visibilitychange', sync)
    }
    function fire() {
        if (done) return
        done = true
        cleanup()
        callback()
    }
    // Arm the countdown while the page has loaded and is visible; a hidden tab stops it
    function sync() {
        if (done) return
        const ready = doc.readyState === 'complete' && doc.visibilityState === 'visible'
        if (ready && timer === null) timer = win.setTimeout(fire, delayMs)
        else if (!ready) disarm()
    }

    INTERACTION_EVENTS.forEach(e => win.addEventListener(e, fire, { passive: true }))
    win.addEventListener('load', sync, { once: true })
    doc.addEventListener('visibilitychange', sync)
    sync()
    return cleanup
}
