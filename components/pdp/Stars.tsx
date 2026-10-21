import * as React from 'react'
import { cn } from '@/lib/utils'

const STAR_PATH = 'M10 1.6l2.47 5.2 5.69.67-4.2 3.9 1.11 5.62L10 14.2l-5.07 2.79 1.11-5.62-4.2-3.9 5.69-.67L10 1.6z'

function StarRow({ className }: { className?: string }) {
    return (
        <span className={cn('flex', className)} aria-hidden="true">
            {[0, 1, 2, 3, 4].map(i => (
                <svg key={i} viewBox="0 0 20 20" className="h-[1em] w-[1em] shrink-0" fill="currentColor" focusable="false">
                    <path d={STAR_PATH} />
                </svg>
            ))}
        </span>
    )
}

/**
 * Five stars filled to `value` (0–5, fractions allowed). Decorative: pair it with the number as text.
 * Size follows the font size (`text-base` = 16px stars). Server-friendly.
 */
export function Stars({ value, className }: { value: number; className?: string }) {
    const pct = Math.max(0, Math.min(100, (value / 5) * 100))
    return (
        <span className={cn('relative inline-flex shrink-0 leading-none', className)} aria-hidden="true">
            <StarRow className="text-line-strong" />
            <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
                <StarRow className="text-ink" />
            </span>
        </span>
    )
}

/** "4,8" — one decimal with a Turkish comma. */
export function formatRating(value: number): string {
    return (Math.round(value * 10) / 10).toFixed(1).replace('.', ',')
}

export default Stars
