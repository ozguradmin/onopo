import * as React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SectionHeaderProps {
    title: React.ReactNode
    description?: React.ReactNode
    /** "Tümünü gör →" target. */
    href?: string
    linkLabel?: string
    /** Heading level; pages have exactly one h1, sections use h2 (default). */
    as?: 'h1' | 'h2' | 'h3'
    /** id for the heading (use with aria-labelledby on the <section>). */
    id?: string
    className?: string
}

/**
 * Section title row: heading (h2 = 18→24/700) with an optional muted description and a "Tümünü gör"
 * link on the right, on the heading's (first) baseline. The link box is only as tall as its text so
 * the baselines can meet; a pseudo-element gives it the 44px hit area. Server-friendly.
 */
export function SectionHeader({ title, description, href, linkLabel = 'Tümünü gör', as = 'h2', id, className }: SectionHeaderProps) {
    const Heading = as
    return (
        <div className={cn('mb-4 flex items-baseline justify-between gap-4 lg:mb-6', className)}>
            <div className="min-w-0">
                <Heading id={id} className={cn(as === 'h1' ? 'type-h1' : as === 'h3' ? 'type-h3' : 'type-h2', 'text-ink')}>
                    {title}
                </Heading>
                {description && <p className="mt-1 text-sm leading-5 text-muted">{description}</p>}
            </div>
            {href && (
                <Link
                    href={href}
                    prefetch={false}
                    className="relative inline-flex shrink-0 items-center gap-1 rounded-thumb text-sm font-semibold text-brand-600 underline-offset-4 before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] hover:text-brand-700 hover:underline"
                >
                    {linkLabel}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
            )}
        </div>
    )
}

export default SectionHeader
