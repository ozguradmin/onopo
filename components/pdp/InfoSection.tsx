'use client'

/**
 * One block of product information below the fold. Phones and tablets: an accordion row (the first one
 * starts open). Desktop (lg): a plain section, always expanded. The content is server-rendered and
 * always in the HTML (collapsed rows only hide it with CSS), so crawlers read all of it.
 *
 * Exactly one <h2> per section in the DOM, with the title text once. Only its inner control changes by
 * breakpoint: a toggle button below lg, plain text from lg. The server HTML (and the first client render)
 * always has the button, styled at lg to look exactly like the heading text (no chevron, no padding, no
 * pointer events), so the swap to plain text after hydration on desktop moves nothing.
 */
import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const DESKTOP_QUERY = '(min-width: 1024px)'

function subscribeDesktop(onChange: () => void) {
    const mql = window.matchMedia(DESKTOP_QUERY)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
}
const desktopSnapshot = () => window.matchMedia(DESKTOP_QUERY).matches
const serverSnapshot = () => false

export function InfoSection({
    id,
    title,
    defaultOpen = false,
    children,
    className,
}: {
    id: string
    title: string
    defaultOpen?: boolean
    children: React.ReactNode
    className?: string
}) {
    const [open, setOpen] = React.useState(defaultOpen)
    const desktop = React.useSyncExternalStore(subscribeDesktop, desktopSnapshot, serverSnapshot)
    const panelId = `${id}-icerik`
    const headingId = `${id}-baslik`
    return (
        <section id={id} className={cn('scroll-mt-28 border-b border-line lg:border-0', className)} aria-labelledby={headingId}>
            <h2 id={headingId} className="text-base font-semibold text-ink lg:type-h2 lg:mb-4">
                {desktop ? (
                    title
                ) : (
                    <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => setOpen(o => !o)}
                        className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left lg:pointer-events-none lg:block lg:min-h-0 lg:py-0"
                    >
                        {title}
                        <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted transition-transform duration-200 lg:hidden', open && 'rotate-180')} aria-hidden="true" />
                    </button>
                )}
            </h2>
            <div id={panelId} className={cn('pb-5 lg:block lg:pb-0', !open && 'max-lg:hidden')}>
                {children}
            </div>
        </section>
    )
}

export default InfoSection
