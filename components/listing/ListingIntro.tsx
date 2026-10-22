'use client'

/**
 * The "N ürün · …" line under the listing H1. Phones (< lg) show one line with a "devamı" toggle when
 * the text is longer than that, so the first product row starts higher; desktop shows it all. The text
 * itself is server-rendered (children), so it is in the HTML either way.
 */
import * as React from 'react'
import { cn } from '@/lib/utils'

export function ListingIntro({ expandable, className, children }: { expandable: boolean; className?: string; children: React.ReactNode }) {
    const ref = React.useRef<HTMLParagraphElement>(null)
    const id = React.useId()
    const [open, setOpen] = React.useState(false)
    // Rendered on the server as "may overflow" (a real intro is longer than a phone line); corrected
    // after measuring, e.g. on a wide tablet where it fits
    const [overflows, setOverflows] = React.useState(true)

    React.useEffect(() => {
        const p = ref.current
        if (!expandable || !p || open) return
        const measure = () => setOverflows(p.scrollHeight > p.clientHeight + 1)
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(p)
        return () => ro.disconnect()
    }, [expandable, open])

    if (!expandable) return <p className={className}>{children}</p>

    return (
        <div className={cn('flex flex-wrap items-baseline gap-x-2', className)}>
            <p ref={ref} id={id} className={cn('min-w-0 flex-1', open ? 'basis-full' : 'line-clamp-1 lg:line-clamp-none')}>
                {children}
            </p>
            {(overflows || open) && (
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={id}
                    onClick={() => setOpen(o => !o)}
                    className="relative shrink-0 font-semibold text-brand-600 before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-[''] hover:text-brand-700 lg:hidden"
                >
                    {open ? 'daha az' : 'devamı'}
                </button>
            )}
        </div>
    )
}

export default ListingIntro
