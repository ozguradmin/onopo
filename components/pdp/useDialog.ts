'use client'

import * as React from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'

/**
 * Modal dialog behaviour for overlays (lightbox, installment table): Escape closes, Tab stays inside
 * the panel (focus trap), the page behind does not scroll, focus moves into the dialog on open and
 * back to the element that opened it on close.
 */
export function useDialog(open: boolean, onClose: () => void) {
    const panelRef = React.useRef<HTMLDivElement>(null)
    const onCloseRef = React.useRef(onClose)
    React.useEffect(() => {
        onCloseRef.current = onClose
    }, [onClose])

    React.useEffect(() => {
        if (!open) return
        const opener = document.activeElement as HTMLElement | null
        const root = document.documentElement
        const prevOverflow = root.style.overflow
        root.style.overflow = 'hidden'

        const panel = panelRef.current
        const first = panel?.querySelector<HTMLElement>('[data-autofocus]') || panel?.querySelector<HTMLElement>(FOCUSABLE)
        ;(first || panel)?.focus({ preventScroll: true })

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                onCloseRef.current()
                return
            }
            if (e.key !== 'Tab' || !panel) return
            const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null || el === document.activeElement)
            if (!items.length) {
                e.preventDefault()
                return
            }
            const firstEl = items[0]
            const lastEl = items[items.length - 1]
            if (e.shiftKey && (document.activeElement === firstEl || !panel.contains(document.activeElement))) {
                e.preventDefault()
                lastEl.focus()
            } else if (!e.shiftKey && (document.activeElement === lastEl || !panel.contains(document.activeElement))) {
                e.preventDefault()
                firstEl.focus()
            }
        }
        document.addEventListener('keydown', onKey, true)
        return () => {
            document.removeEventListener('keydown', onKey, true)
            root.style.overflow = prevOverflow
            if (opener && document.contains(opener)) opener.focus({ preventScroll: true })
        }
    }, [open])

    return panelRef
}
