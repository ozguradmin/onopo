import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Placeholder block (surface-2 with a shimmer that is off under prefers-reduced-motion).
 * Use only for in-page async parts and route-level loading.tsx; never as a full-page spinner.
 */
export function Skeleton({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
    return <div aria-hidden="true" className={cn('skeleton rounded-thumb', className)} {...rest} />
}

/** Same geometry as ProductCard, so swapping in the real card does not shift the layout. */
export function ProductCardSkeleton({ className }: { className?: string }) {
    return (
        <div aria-hidden="true" className={cn('flex flex-col overflow-hidden rounded-card border border-line bg-white', className)}>
            <div className="skeleton aspect-square w-full rounded-none" />
            <div className="flex flex-col gap-2 p-2.5 lg:p-3">
                <div className="skeleton h-3 w-16 rounded-chip" />
                <div className="skeleton h-4 w-full rounded-chip" />
                <div className="skeleton h-4 w-2/3 rounded-chip" />
                <div className="skeleton mt-1 h-5 w-24 rounded-chip" />
            </div>
        </div>
    )
}

/** A grid of card skeletons (listing: 8, carousel rows: 4). */
export function ProductGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
    return (
        <div className={cn('product-grid', className)} role="status" aria-label="Ürünler yükleniyor">
            {Array.from({ length: count }, (_, i) => (
                <ProductCardSkeleton key={i} />
            ))}
        </div>
    )
}

export default Skeleton
