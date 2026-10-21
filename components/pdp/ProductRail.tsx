'use client'

/**
 * Horizontal product row (scroll-snap, swipe on touch) with previous/next buttons from md.
 * No auto-scrolling. The cards are server-rendered children; this island only scrolls.
 */
import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProductRail({ children, label, className }: { children: React.ReactNode; label: string; className?: string }) {
    const ref = React.useRef<HTMLUListElement>(null)
    const [edges, setEdges] = React.useState({ start: true, end: false })

    const update = React.useCallback(() => {
        const el = ref.current
        if (!el) return
        setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 })
    }, [])

    React.useEffect(() => {
        const el = ref.current
        if (!el) return
        update()
        let frame = 0
        const onScroll = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(update)
        }
        el.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onScroll)
        return () => {
            cancelAnimationFrame(frame)
            el.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onScroll)
        }
    }, [update])

    const scroll = (dir: 1 | -1) => {
        const el = ref.current
        if (!el) return
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: reduce ? 'auto' : 'smooth' })
    }

    const btn = 'absolute top-[38%] z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-ink shadow-raised transition-opacity duration-150 hover:border-line-strong md:inline-flex disabled:pointer-events-none disabled:opacity-0'

    return (
        <div className={cn('relative', className)}>
            <ul
                ref={ref}
                aria-label={label}
                className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:scroll-px-0 md:gap-4 md:px-0 lg:gap-6"
            >
                {children}
            </ul>
            <button type="button" onClick={() => scroll(-1)} disabled={edges.start} aria-label="Önceki ürünler" className={cn(btn, '-left-3 lg:-left-5')}>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => scroll(1)} disabled={edges.end} aria-label="Sonraki ürünler" className={cn(btn, '-right-3 lg:-right-5')}>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
        </div>
    )
}

/** One slot of the rail: 2.3 cards visible on phones, 3 on tablets, 4 on desktop. */
export function ProductRailItem({ children }: { children: React.ReactNode }) {
    return (
        <li className="w-[42%] shrink-0 snap-start sm:w-[30%] md:w-[calc((100%-2*16px)/3)] lg:w-[calc((100%-3*24px)/4)]">
            {children}
        </li>
    )
}

export default ProductRail
