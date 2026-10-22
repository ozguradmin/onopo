'use client'

/**
 * Onopo Asistan: keeps the transcript scrolled to the newest reply while it grows, and stops following as
 * soon as the visitor scrolls up to read (SPEC §10.6). Then `away` turns true when more content arrives, and
 * the panel shows the "↓ Yeni yanıt" pill. Our own ~40 lines instead of use-stick-to-bottom (no new
 * dependency, and the chat chunk stays small).
 */
import * as React from 'react'

const NEAR_BOTTOM_PX = 48

export function useStickToBottom() {
    const scrollRef = React.useRef<HTMLDivElement>(null)
    const contentRef = React.useRef<HTMLDivElement>(null)
    const stick = React.useRef(true)
    const [away, setAway] = React.useState(false)

    React.useEffect(() => {
        const el = scrollRef.current
        const content = contentRef.current
        if (!el || !content) return
        // Only a scroll UP by the visitor stops following. Content growing under us, a smooth scroll still
        // on its way down, or the panel getting shorter (the cart strip appears) never does.
        let last = el.scrollTop
        const onScroll = () => {
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
            if (atBottom) {
                stick.current = true
                setAway(false)
            } else if (el.scrollTop < last - 2) {
                stick.current = false
            }
            last = el.scrollTop
        }
        const follow = () => {
            if (stick.current) el.scrollTop = el.scrollHeight
            else setAway(true)
        }
        el.addEventListener('scroll', onScroll, { passive: true })
        const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(follow) : null
        ro?.observe(content)
        // The scroller itself shrinks when the cart strip or the keyboard appears: keep the newest reply in view
        ro?.observe(el)
        follow()
        return () => {
            el.removeEventListener('scroll', onScroll)
            ro?.disconnect()
        }
    }, [])

    /** Jump to the newest message and follow again (the pill, and every message the visitor sends). */
    const scrollToBottom = React.useCallback((smooth = true) => {
        const el = scrollRef.current
        stick.current = true
        setAway(false)
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    }, [])

    return { scrollRef, contentRef, away, scrollToBottom }
}
