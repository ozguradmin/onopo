'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Time a slide stays before the slider moves on by itself. */
const AUTOPLAY_MS = 5000

/**
 * Swipe slider for the campaign banners at the top of the home page (components/home/CampaignBanners).
 * The slides are server-rendered <li> children; this island adds the dots, the desktop arrows and a
 * gentle autoplay. Autoplay never runs with prefers-reduced-motion, while the slider is off screen or
 * the tab is hidden, or while the pointer or focus is on it. A swipe or a control does NOT stop it (owner):
 * it only restarts the 5 s countdown, so the next slide comes a full interval later. The pause button keeps
 * it under the visitor's control (WCAG 2.2.2).
 */
export function CampaignCarousel({ count, label, children }: { count: number; label: string; children: React.ReactNode }) {
    const listRef = React.useRef<HTMLUListElement>(null)
    const [active, setActive] = React.useState(0)
    const [edges, setEdges] = React.useState({ start: true, end: count < 2 })
    const [playing, setPlaying] = React.useState(false)
    const held = React.useRef(false)
    const visible = React.useRef(false)
    const programmatic = React.useRef(false)
    /** When the slide last changed (by autoplay or by the visitor): the countdown runs from here. */
    const lastMove = React.useRef(0)

    const slideAt = (el: HTMLUListElement, i: number) => el.children[i] as HTMLElement | undefined

    const scrollToSlide = React.useCallback((i: number, smooth = true) => {
        const el = listRef.current
        const target = el && slideAt(el, (i + count) % count)
        if (!el || !target) return
        programmatic.current = true
        const offset = target.offsetLeft - (el.firstElementChild as HTMLElement).offsetLeft
        el.scrollTo({ left: offset, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' })
    }, [count])

    // Active dot and arrow state follow the scroll position
    React.useEffect(() => {
        const el = listRef.current
        if (!el) return
        let frame = 0
        let idle: ReturnType<typeof setTimeout> | undefined
        const update = () => {
            const first = el.firstElementChild as HTMLElement | null
            const step = first ? first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0') : el.clientWidth
            const max = el.scrollWidth - el.clientWidth
            setActive(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / Math.max(1, step)))))
            setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft >= max - 4 })
        }
        const onScroll = () => {
            // Any movement (a swipe, a dot, an arrow or autoplay itself) restarts the countdown
            lastMove.current = Date.now()
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(update)
            clearTimeout(idle)
            idle = setTimeout(() => {
                programmatic.current = false
            }, 150)
        }
        // First read on the next frame, not during hydration (a forced layout on phones)
        frame = requestAnimationFrame(update)
        el.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            cancelAnimationFrame(frame)
            clearTimeout(idle)
            el.removeEventListener('scroll', onScroll)
        }
    }, [count])

    // Autoplay: on once mounted (unless reduced motion), off for good after the visitor takes over
    React.useEffect(() => {
        if (count > 1 && !prefersReducedMotion()) setPlaying(true)
    }, [count])

    React.useEffect(() => {
        const el = listRef.current
        if (!el || typeof IntersectionObserver === 'undefined') {
            visible.current = true
            return
        }
        const io = new IntersectionObserver(([entry]) => {
            visible.current = entry.isIntersecting
        }, { threshold: 0.5 })
        io.observe(el)
        return () => io.disconnect()
    }, [])

    React.useEffect(() => {
        if (!playing) return
        lastMove.current = Date.now()
        // A short tick that waits until AUTOPLAY_MS have passed since the last movement
        const id = setInterval(() => {
            const el = listRef.current
            if (!el || held.current || !visible.current || document.hidden) {
                lastMove.current = Date.now()
                return
            }
            if (Date.now() - lastMove.current < AUTOPLAY_MS) return
            lastMove.current = Date.now()
            const max = el.scrollWidth - el.clientWidth
            // At the end: back to the start
            scrollToSlide(el.scrollLeft >= max - 4 ? 0 : active + 1)
        }, 250)
        return () => clearInterval(id)
    }, [playing, active, scrollToSlide])

    /** The visitor moved the slider: keep autoplay on, just restart its countdown. */
    const takeOver = () => {
        lastMove.current = Date.now()
    }
    const hold = (on: boolean) => () => {
        held.current = on
    }

    const arrow = 'absolute top-1/2 z-[1] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-card transition-opacity duration-150 hover:bg-surface lg:inline-flex'

    return (
        <div
            className="relative"
            // Mouse hover pauses; a finger does not (its pointer events would leave it paused after a tap)
            onPointerEnter={e => {
                if (e.pointerType === 'mouse') held.current = true
            }}
            onPointerLeave={hold(false)}
            // Only keyboard focus pauses: a tapped dot keeps focus, which must not stop autoplay for good
            onFocusCapture={e => {
                if ((e.target as HTMLElement).matches?.(':focus-visible')) held.current = true
            }}
            onBlurCapture={hold(false)}
        >
            <ul
                ref={listRef}
                aria-label={label}
                // Inside the gutter, one slide per view: the neighbours are only seen while swiping
                className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain rounded-sheet"
                // A real swipe (not our own smooth scroll) hands control to the visitor
                onTouchStart={takeOver}
                onWheel={e => {
                    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) takeOver()
                }}
            >
                {children}
            </ul>

            {count > 1 && (
                <>
                    <button
                        type="button"
                        className={cn(arrow, 'left-0 -translate-x-1/2', edges.start && 'pointer-events-none opacity-0')}
                        onClick={() => {
                            takeOver()
                            scrollToSlide(active - 1)
                        }}
                        aria-label="Önceki kampanya"
                        tabIndex={edges.start ? -1 : undefined}
                    >
                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        className={cn(arrow, 'right-0 translate-x-1/2', edges.end && 'pointer-events-none opacity-0')}
                        onClick={() => {
                            takeOver()
                            scrollToSlide(active + 1)
                        }}
                        aria-label="Sonraki kampanya"
                        tabIndex={edges.end ? -1 : undefined}
                    >
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </button>

                    <div className="mt-1 flex items-center justify-center">
                        {Array.from({ length: count }, (_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => {
                                    takeOver()
                                    scrollToSlide(i)
                                }}
                                aria-label={`${i + 1}. kampanyaya git`}
                                aria-current={i === active ? 'true' : undefined}
                                className="flex h-7 w-6 items-center justify-center"
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn('h-1.5 rounded-full transition-all duration-200', i === active ? 'w-5 bg-brand-600' : 'w-1.5 bg-line-strong')}
                                />
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setPlaying(p => !p)}
                            aria-label={playing ? 'Kampanyaları durdur' : 'Kampanyaları oynat'}
                            className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:text-ink"
                        >
                            {playing ? <Pause className="h-3 w-3" aria-hidden="true" /> : <Play className="h-3 w-3" aria-hidden="true" />}
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}

export default CampaignCarousel
