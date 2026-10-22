'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionHeader, type SectionHeaderProps } from '@/components/ui/SectionHeader'

export interface RailScrollerProps {
    /**
     * Section header. The desktop prev/next buttons go into its actions slot, next to "Tümünü gör",
     * so link and buttons line up on the heading's line. Without a heading they sit over the list's ends.
     */
    heading?: Omit<SectionHeaderProps, 'actions'>
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
export function RailScroller({ heading, label, children, className, listClassName, fitsLg = false, fitsXl = false }: RailScrollerProps) {
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
        'h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors duration-150 hover:border-ink disabled:cursor-default disabled:opacity-40 disabled:hover:border-line'
    // Desktop only, and only when the items can overflow at that width (known on the server)
    const shown = (display: 'flex' | 'inline-flex') =>
        cn(
            'hidden',
            fitsLg ? 'lg:hidden' : display === 'flex' ? 'lg:flex' : 'lg:inline-flex',
            fitsXl ? 'xl:hidden' : display === 'flex' ? 'xl:flex' : 'xl:inline-flex',
            !edges.overflow && 'invisible',
        )

    const prev = (className?: string) => (
        <button
            type="button"
            className={cn(buttonClass, className)}
            onClick={() => scrollPage(-1)}
            disabled={edges.start}
            aria-controls={listId}
            aria-label={`${label}: önceki`}
        >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
    )
    const next = (className?: string) => (
        <button
            type="button"
            className={cn(buttonClass, className)}
            onClick={() => scrollPage(1)}
            disabled={edges.end}
            aria-controls={listId}
            aria-label={`${label}: sonraki`}
        >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
    )

    // With a heading: the buttons sit next to "Tümünü gör", centred on its line without making the
    // header row taller. Without one (a compact strip): over the list's two ends, vertically centred,
    // so they take no room of their own; a button at its end is hidden instead of greyed out.
    const overlay = 'absolute top-1/2 z-[1] -translate-y-1/2 shadow-card disabled:invisible'
    return (
        <div className={cn(!heading && 'relative', className)}>
            {heading && (
                <SectionHeader
                    {...heading}
                    actions={
                        <div className={cn(shown('flex'), 'shrink-0 gap-2', heading.href && '-my-2.5')}>
                            {prev('inline-flex')}
                            {next('inline-flex')}
                        </div>
                    }
                />
            )}
            {!heading && prev(cn(shown('inline-flex'), overlay, 'left-0 -translate-x-1/2'))}
            {!heading && next(cn(shown('inline-flex'), overlay, 'right-0 translate-x-1/2'))}
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
