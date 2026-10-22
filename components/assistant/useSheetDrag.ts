'use client'

/**
 * Drag the phone sheet down to close it (sheet-drag.ts has the numbers). The sheet follows the finger when it
 * is dragged by the handle or the header, and when the transcript is pulled down while it is scrolled to the
 * very top. No transition while dragging; on release it slides out (then minimises) or springs back.
 *
 * The frame and the backdrop are moved through their inline style, not React state: a re-render per pointer
 * move would make the drag stutter on slower phones. The inline styles are removed once the sheet is back in
 * place or hidden, so the panel's own slide-in classes keep working. Reduced motion: the sheet still follows
 * the finger (direct manipulation), but closes and returns without animation.
 *
 * Handle and header use pointer events (touch-action: none on them); the transcript uses touch events with a
 * non-passive touchmove, because a scrolling list would otherwise cancel the pointer stream.
 */
import * as React from 'react'
import { backdropOpacity, dragIntent, dragOffset, releaseVelocity, shouldClose, type DragSample } from './sheet-drag'

const CLOSE_MS = 220
const RETURN_MS = 300
const EASE = 'cubic-bezier(.2, .8, .2, 1)'

function reducedMotion(): boolean {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
        return false
    }
}

interface Gesture {
    x: number
    y: number
    lastY: number
    dragging: boolean
    /** decided it is not ours (sideways, or a scroll) */
    ignored: boolean
    samples: DragSample[]
}

export interface SheetDragOptions {
    enabled: boolean
    visible: boolean
    frameRef: React.RefObject<HTMLElement | null>
    backdropRef: React.RefObject<HTMLElement | null>
    scrollRef: React.RefObject<HTMLElement | null>
    onClose: () => void
}

export interface SheetDragHandlers {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => void
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => void
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void
    onClickCapture: (e: React.MouseEvent<HTMLElement>) => void
}

export function useSheetDrag({ enabled, visible, frameRef, backdropRef, scrollRef, onClose }: SheetDragOptions): {
    handle: SheetDragHandlers
    header: SheetDragHandlers
} {
    const gesture = React.useRef<Gesture | null>(null)
    const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const suppressClick = React.useRef(false)
    /** sheet height, measured once when a drag starts (no layout read per pointer move) */
    const sheetHeight = React.useRef(0)
    const onCloseRef = React.useRef(onClose)
    onCloseRef.current = onClose

    const clearStyles = React.useCallback(() => {
        clearTimeout(timer.current)
        const el = frameRef.current
        if (el) {
            el.style.removeProperty('transform')
            el.style.removeProperty('transition')
            el.style.removeProperty('will-change')
        }
        const bd = backdropRef.current
        if (bd) {
            bd.style.removeProperty('opacity')
            bd.style.removeProperty('transition')
        }
    }, [frameRef, backdropRef])

    // Hidden (minimised, closed) or no longer a sheet: drop whatever a drag left behind
    React.useEffect(() => {
        if (!visible || !enabled) {
            gesture.current = null
            clearStyles()
        }
    }, [visible, enabled, clearStyles])
    React.useEffect(() => () => clearTimeout(timer.current), [])

    const height = () => frameRef.current?.getBoundingClientRect().height ?? 0

    const moveTo = React.useCallback((dy: number) => {
        const el = frameRef.current
        if (!el) return
        const offset = dragOffset(dy)
        el.style.transform = `translateY(${offset}px)`
        const bd = backdropRef.current
        if (bd) bd.style.opacity = String(backdropOpacity(offset, sheetHeight.current))
    }, [frameRef, backdropRef])

    const beginDrag = React.useCallback(() => {
        clearTimeout(timer.current)
        const el = frameRef.current
        if (!el) return
        sheetHeight.current = el.getBoundingClientRect().height
        el.style.transition = 'none'
        el.style.willChange = 'transform'
        const bd = backdropRef.current
        if (bd) bd.style.transition = 'none'
    }, [frameRef, backdropRef])

    const animate = React.useCallback((toY: number, ms: number, then: () => void) => {
        const el = frameRef.current
        const bd = backdropRef.current
        if (!el || reducedMotion()) {
            then()
            return
        }
        el.style.transition = `transform ${ms}ms ${EASE}`
        el.style.transform = `translateY(${toY}px)`
        if (bd) {
            bd.style.transition = `opacity ${ms}ms ${EASE}`
            bd.style.opacity = toY > 0 ? '0' : '1'
        }
        clearTimeout(timer.current)
        timer.current = setTimeout(then, ms + 20)
    }, [frameRef, backdropRef])

    /** Slide out, then minimise; the effect above clears the styles once the panel is hidden. */
    const closeAnimated = React.useCallback(() => {
        const h = height()
        animate(h, CLOSE_MS, () => onCloseRef.current())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [animate])

    const springBack = React.useCallback(() => animate(0, RETURN_MS, clearStyles), [animate, clearStyles])

    const release = React.useCallback((g: Gesture) => {
        const samples = [...g.samples, { y: g.lastY, t: performance.now() }]
        const dy = g.lastY - g.y
        if (shouldClose({ dy, height: height(), velocity: releaseVelocity(samples) })) closeAnimated()
        else springBack()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [closeAnimated, springBack])

    const track = (g: Gesture, y: number) => {
        g.lastY = y
        g.samples.push({ y, t: performance.now() })
        if (g.samples.length > 12) g.samples.shift()
        moveTo(y - g.y)
    }

    // ---- handle and header: pointer events ----
    const make = (tapCloses: boolean): SheetDragHandlers => ({
        onPointerDown: e => {
            if (!enabled || (e.pointerType === 'mouse' && e.button !== 0)) return
            // The ⋯ menu lives inside the header: presses there are the menu's
            if ((e.target as Element).closest?.('[role="menu"]')) return
            suppressClick.current = false
            gesture.current = { x: e.clientX, y: e.clientY, lastY: e.clientY, dragging: false, ignored: false, samples: [] }
        },
        onPointerMove: e => {
            const g = gesture.current
            if (!g || g.ignored) return
            if (!g.dragging) {
                const intent = dragIntent(e.clientX - g.x, e.clientY - g.y)
                if (intent == null) return
                if (intent === 'other') {
                    g.ignored = true
                    return
                }
                g.dragging = true
                try {
                    e.currentTarget.setPointerCapture(e.pointerId)
                } catch {
                    // pointer already gone
                }
                beginDrag()
            }
            track(g, e.clientY)
        },
        onPointerUp: e => {
            const g = gesture.current
            gesture.current = null
            if (!g) return
            if (g.dragging) {
                suppressClick.current = true
                g.lastY = e.clientY
                release(g)
            } else if (tapCloses && !g.ignored) {
                closeAnimated()
            }
        },
        onPointerCancel: () => {
            const g = gesture.current
            gesture.current = null
            if (g?.dragging) springBack()
        },
        // A drag that ended over a header button must not press it
        onClickCapture: e => {
            if (!suppressClick.current) return
            suppressClick.current = false
            e.preventDefault()
            e.stopPropagation()
        },
    })

    // ---- transcript: a downward pull while it is at the very top ----
    React.useEffect(() => {
        const list = scrollRef.current
        if (!enabled || !visible || !list) return
        let g: Gesture | null = null
        const onStart = (e: TouchEvent) => {
            if (e.touches.length !== 1 || list.scrollTop > 0) {
                g = null
                return
            }
            const t = e.touches[0]
            g = { x: t.clientX, y: t.clientY, lastY: t.clientY, dragging: false, ignored: false, samples: [] }
        }
        const onMove = (e: TouchEvent) => {
            if (!g || g.ignored) return
            if (e.touches.length !== 1) {
                if (g.dragging) springBack()
                g = null
                return
            }
            const t = e.touches[0]
            if (!g.dragging) {
                const intent = dragIntent(t.clientX - g.x, t.clientY - g.y, true)
                if (intent == null) return
                if (intent === 'other' || list.scrollTop > 0) {
                    g.ignored = true
                    return
                }
                g.dragging = true
                beginDrag()
            }
            if (e.cancelable) e.preventDefault()
            track(g, t.clientY)
        }
        const onEnd = () => {
            const cur = g
            g = null
            if (cur?.dragging) release(cur)
        }
        const onCancel = () => {
            const cur = g
            g = null
            if (cur?.dragging) springBack()
        }
        list.addEventListener('touchstart', onStart, { passive: true })
        list.addEventListener('touchmove', onMove, { passive: false })
        list.addEventListener('touchend', onEnd)
        list.addEventListener('touchcancel', onCancel)
        return () => {
            list.removeEventListener('touchstart', onStart)
            list.removeEventListener('touchmove', onMove)
            list.removeEventListener('touchend', onEnd)
            list.removeEventListener('touchcancel', onCancel)
        }
        // track/moveTo read refs only
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, visible, scrollRef, beginDrag, release, springBack])

    return { handle: make(true), header: make(false) }
}
