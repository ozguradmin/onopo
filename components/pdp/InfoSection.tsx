'use client'

/**
 * One block of product information below the fold. Phones: an accordion row (the first one starts
 * open). Desktop (lg): a plain section with an H2, always expanded. The content is server-rendered
 * and always in the HTML (collapsed rows only hide it with CSS), so crawlers read all of it.
 */
import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

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
    const panelId = `${id}-icerik`
    const buttonId = `${id}-baslik`
    return (
        <section id={id} className={cn('scroll-mt-28 border-b border-line lg:border-0', className)} aria-labelledby={buttonId}>
            <h2 className="lg:hidden">
                <button
                    id={buttonId}
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpen(o => !o)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left text-base font-semibold text-ink"
                >
                    {title}
                    <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
                </button>
            </h2>
            <h2 className="type-h2 mb-4 hidden text-ink lg:block">{title}</h2>
            <div id={panelId} className={cn('pb-5 lg:block lg:pb-0', !open && 'max-lg:hidden')}>
                {children}
            </div>
        </section>
    )
}

export default InfoSection
