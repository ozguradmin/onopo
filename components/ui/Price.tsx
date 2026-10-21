import * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { discountPercent, displayPrice, formatTL, MIN_DISCOUNT_BADGE_PERCENT } from '@/lib/format'

export interface PriceProps {
    /** Unit price. Raw DB price by default (rounded to the .99 display price here). */
    price: number
    /** Previous price (raw by default). Shown struck through only when it is higher than the price. */
    originalPrice?: number | null
    /** Set when `price`/`originalPrice` are already display prices (e.g. Product.display_price) or sums. */
    rounded?: boolean
    /** sm: 14/700 · card: 16/800 (default) · lg: product page 28→32/800 */
    size?: 'sm' | 'card' | 'lg'
    /** Red "%41" badge next to the price (only when the discount is >= 5%). */
    showDiscountBadge?: boolean
    /** "180,00 ₺ kazancın" line in success green. */
    showSaving?: boolean
    className?: string
}

const SIZES = {
    sm: { price: 'text-sm leading-5 font-bold tabular-nums', old: 'text-xs leading-4' },
    card: { price: 'type-price', old: 'text-[13px] leading-4' },
    lg: { price: 'type-price-lg', old: 'text-base leading-5' },
} as const

/**
 * Price block with Turkish formatting ("1.234,99 ₺"), optional strikethrough, discount badge and
 * saving line. Server-friendly (no hooks). The shown unit price is roundPrice(price), the same value
 * the order API charges.
 */
export function Price({ price, originalPrice, rounded = false, size = 'card', showDiscountBadge = false, showSaving = false, className }: PriceProps) {
    const current = rounded ? price : displayPrice(price)
    const oldRaw = originalPrice != null && originalPrice > 0 ? (rounded ? originalPrice : displayPrice(originalPrice)) : null
    const old = oldRaw != null && oldRaw > current ? oldRaw : null
    const pct = old != null ? discountPercent(current, old) : 0
    const s = SIZES[size]

    return (
        <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)} data-price="">
            <span className={cn(s.price, 'text-ink')}>
                {old != null && <span className="sr-only">İndirimli fiyat: </span>}
                {formatTL(current)}
            </span>
            {old != null && (
                <del className={cn(s.old, 'text-muted tabular-nums decoration-1')}>
                    <span className="sr-only">Eski fiyat: </span>
                    {formatTL(old)}
                </del>
            )}
            {showDiscountBadge && pct >= MIN_DISCOUNT_BADGE_PERCENT && (
                <Badge variant="sale" className="self-center">%{pct}</Badge>
            )}
            {showSaving && old != null && (
                <span className="basis-full text-[13px] leading-5 font-semibold text-success tabular-nums">
                    {formatTL(Math.round((old - current) * 100) / 100)} kazancın
                </span>
            )}
        </div>
    )
}

export default Price
