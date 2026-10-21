import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { buttonClasses } from '@/components/ui/button'

export interface EmptyStateProps {
    /** A lucide icon element, e.g. <SearchX />. Rendered 28px in a surface circle. */
    icon?: React.ReactNode
    title: React.ReactNode
    description?: React.ReactNode
    /** Primary action as a link… */
    action?: { label: string; href: string }
    /** …or any custom node (e.g. a client button). */
    children?: React.ReactNode
    className?: string
}

/**
 * One icon, one sentence, one primary action (spec §16): empty search, empty cart, no favourites,
 * no orders, filters without a match. Server-friendly.
 */
export function EmptyState({ icon, title, description, action, children, className }: EmptyStateProps) {
    return (
        <div className={cn('mx-auto flex max-w-md flex-col items-center px-4 py-12 text-center', className)}>
            {icon && (
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface text-muted [&_svg]:h-7 [&_svg]:w-7" aria-hidden="true">
                    {icon}
                </div>
            )}
            <p className="type-h3 text-ink">{title}</p>
            {description && <p className="mt-1.5 text-sm leading-6 text-muted">{description}</p>}
            {(action || children) && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    {action && (
                        <Link href={action.href} className={buttonClasses({ variant: 'brand', size: '44' })}>
                            {action.label}
                        </Link>
                    )}
                    {children}
                </div>
            )}
        </div>
    )
}

export default EmptyState
