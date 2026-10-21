import * as React from 'react'
import { cn } from '@/lib/utils'

type ContainerProps<T extends React.ElementType> = {
    as?: T
    className?: string
    children?: React.ReactNode
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>

/**
 * Page-width wrapper: max 1280px, centred, gutters 16 / 24 (md) / 32 (lg).
 * Same as the `container-store` utility class. Server-friendly.
 *
 *   <Container as="section" className="section-y">…</Container>
 */
export function Container<T extends React.ElementType = 'div'>({ as, className, children, ...rest }: ContainerProps<T>) {
    const Tag = (as || 'div') as React.ElementType
    return (
        <Tag className={cn('container-store', className)} {...rest}>
            {children}
        </Tag>
    )
}

/**
 * A vertical page section with the standard rhythm (32px mobile / 56px desktop) and a container inside.
 * `tone="surface"` gives the alternating grey background used between home sections.
 */
export function Section({
    className,
    containerClassName,
    tone = 'canvas',
    children,
    ...rest
}: React.HTMLAttributes<HTMLElement> & { containerClassName?: string; tone?: 'canvas' | 'surface' }) {
    return (
        <section className={cn('section-y', tone === 'surface' ? 'bg-surface' : 'bg-canvas', className)} {...rest}>
            <div className={cn('container-store', containerClassName)}>{children}</div>
        </section>
    )
}

export default Container
