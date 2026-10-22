'use client'

/**
 * Small helpers for the shell's overlays (cart drawer, menu drawer, search sheet):
 *   useScrollLock(active)       body scroll lock with a counter (nested overlays), no layout jump
 *   useFocusTrap(ref, active)   Tab stays inside, initial focus, focus returns to the trigger (rules in
 *                               focus-rules.ts: never into a hidden element, never away from one the visitor chose)
 *   useEscape(active, onEscape)
 */
import * as React from 'react'
import { focusRestoreTarget, mustDropFocus, shouldTakeInitialFocus } from './focus-rules'

let lockCount = 0
let savedPaddingRight = ''

function lock() {
    lockCount += 1
    if (lockCount > 1) return
    const html = document.documentElement
    const scrollbar = window.innerWidth - html.clientWidth
    savedPaddingRight = document.body.style.paddingRight
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
}

function unlock() {
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount > 0) return
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
    document.body.style.paddingRight = savedPaddingRight
}

export function useScrollLock(active: boolean) {
    React.useEffect(() => {
        if (!active) return
        lock()
        return unlock
    }, [active])
}

const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusables(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => !el.closest('[inert]') && el.getClientRects().length > 0,
    )
}

/**
 * While `active`, keeps keyboard focus inside `ref`. On activation it focuses `initialFocus` (or the
 * container itself), unless the visitor has meanwhile focused something outside. On deactivation focus left in
 * the layer is dropped (a field of a sheet that is now hidden must not keep the phone keyboard), then it returns
 * to the element that had it before, when that is still on screen and the visitor has not moved on.
 */
export function useFocusTrap(
    ref: React.RefObject<HTMLElement | null>,
    active: boolean,
    initialFocus?: React.RefObject<HTMLElement | null>,
    options: { restore?: boolean } = {},
) {
    const restore = options.restore !== false
    React.useEffect(() => {
        if (!active) return
        const root = ref.current
        if (!root) return
        const previous = document.activeElement as HTMLElement | null
        const target = initialFocus?.current ?? root
        // Focus after the panel became visible (visibility switches in the same frame)
        const raf = requestAnimationFrame(() => {
            if (shouldTakeInitialFocus(root, document.activeElement, previous, document.body)) target.focus({ preventScroll: true })
        })

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return
            const items = focusables(root)
            if (items.length === 0) {
                e.preventDefault()
                root.focus()
                return
            }
            const first = items[0]
            const last = items[items.length - 1]
            const current = document.activeElement
            if (e.shiftKey && (current === first || current === root || !root.contains(current))) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && (current === last || !root.contains(current))) {
                e.preventDefault()
                first.focus()
            }
        }
        document.addEventListener('keydown', onKeyDown)
        return () => {
            cancelAnimationFrame(raf)
            document.removeEventListener('keydown', onKeyDown)
            const current = document.activeElement as HTMLElement | null
            if (mustDropFocus(root, current, document.body)) current?.blur()
            if (!restore) return
            const back = focusRestoreTarget(root, previous, current, document.body)
            if (back && typeof back.focus === 'function') back.focus({ preventScroll: true })
        }
        // initialFocus is a ref object (stable)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, ref, restore])
}

export function useEscape(active: boolean, onEscape: () => void) {
    const cb = React.useRef(onEscape)
    React.useEffect(() => {
        cb.current = onEscape
    })
    React.useEffect(() => {
        if (!active) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                cb.current()
            }
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [active])
}

/** false on the server and during hydration, true after mount. */
export function useHydrated(): boolean {
    return React.useSyncExternalStore(
        noopSubscribe,
        () => true,
        () => false,
    )
}

function noopSubscribe() {
    return () => { }
}
