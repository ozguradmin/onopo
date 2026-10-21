'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface RailScrollerProps {
    /** Section header (server-rendered), shown left of the desktop prev/next buttons. */
    header?: React.ReactNode
    /** Accessible name of the list (e.g. the section title). */
    label: string
    /** The <li> items (server-rendered children). */
    children: React.ReactNode
    className?: string
    listClassName?: string
    /**
     * Known on the server from the item count: every item fits at lg / at xl, so the prev/next
     * buttons are not rendered there at all (no space reserved, no shift after hydration).
     */
    fitsLg?: boolean
    fitsXl?: boolean
}

function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Horizontal scroll-snap rail (spec §8): swipe on touch, prev/next buttons from lg up, keyboard
 * scrolling through the focusable items, never auto-scrolls. The items are server-rendered children,
 * so this island only adds the two buttons and their enabled state.
 */
export function RailScroller({ header, label, children, className, listClassName, fitsLg = false, fitsXl = false }: RailScrollerProps) {
    const listRef = React.useRef<HTMLUListElement>(null)
    const listId = React.useId()
    // SSR state: at the start, assume more content to the right (buttons keep their space either way)
    const [edges, setEdges] = React.useState({ start: true, end: false, overflow: true })

    const update = React.useCallback(() => {
        const el = listRef.current
        if (!el) return
        const max = el.scrollWidth - el.clientWidth
        const next = { start: el.scrollLeft <= 4, end: el.scrollLeft >= max - 4, overflow: max > 4 }
        setEdges(prev => (prev.start === next.start && prev.end === next.end && prev.overflow === next.overflow ? prev : next))
    }, [])

    React.useEffect(() => {
        const el = listRef.current
        if (!el) return
        let frame = 0
        const onScroll = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(update)
        }
        update()
        el.addEventListener('scroll', onScroll, { passive: true })
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onScroll) : null
        ro?.observe(el)
        return () => {
            cancelAnimationFrame(frame)
            el.removeEventListener('scroll', onScroll)
            ro?.disconnect()
        }
    }, [update])

    const scrollPage = (dir: -1 | 1) => {
        const el = listRef.current
        if (!el) return
        // One "page" minus a little, so the snap lands on the next unseen card
        el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.9, 160), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    }

    const buttonClass =
        'inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors duration-150 hover:border-ink disabled:cursor-default disabled:opacity-40 disabled:hover:border-line'

    return (
        <div className={className}>
            {(header || edges.overflow) && (
                <div className="flex items-end gap-4">
                    <div className="min-w-0 flex-1">{header}</div>
                    <div
                        className={cn(
                            'mb-4 hidden shrink-0 gap-2 lg:mb-6',
                            fitsLg ? 'lg:hidden' : 'lg:flex',
                            fitsXl ? 'xl:hidden' : 'xl:flex',
                            !edges.overflow && 'invisible',
                        )}
                    >
                        <button
                            type="button"
                            className={buttonClass}
                            onClick={() => scrollPage(-1)}
                            disabled={edges.start}
                            aria-controls={listId}
                            aria-label={`${label}: önceki`}
                        >
                            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className={buttonClass}
                            onClick={() => scrollPage(1)}
                            disabled={edges.end}
                            aria-controls={listId}
                            aria-label={`${label}: sonraki`}
                        >
                            <ChevronRight className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            )}
            <ul
                ref={listRef}
                id={listId}
                aria-label={label}
                className={cn(
                    // Bleed to the screen edge on small screens (cards scroll under the gutter), keep the
                    // first card aligned with the gutter; on desktop a small inset keeps hover shadows visible.
                    'no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 py-2 md:-mx-6 md:gap-4 md:scroll-px-6 md:px-6 lg:-mx-3 lg:gap-6 lg:scroll-px-3 lg:px-3',
                    '-my-2',
                    listClassName,
                )}
            >
                {children}
            </ul>
        </div>
    )
}

export default RailScroller
