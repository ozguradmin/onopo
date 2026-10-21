import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Badge.
 *
 * Storefront variants (design spec §9) — 22px tall, radius 6, 12/700:
 *   sale      solid sale-red, white text   → "%41" discount (only when >= 5%)
 *   soldout   solid ink, white text        → "Tükendi"
 *   new       brand-600, white text        → "Yeni"
 *   brand     brand-50 background          → informational
 *   success   success-50 / success text    → "Kargo bedava"
 *   neutral   surface-2 / ink-2 text       → spec chips ("30W", "Type-C"), 11/16 600
 *
 * Legacy variants ("default" | "secondary" | "destructive" | "outline" | "accent") are unchanged
 * (used by the admin panel and older pages).
 */
export type LegacyBadgeVariant = "default" | "secondary" | "destructive" | "outline" | "accent"
export type StoreBadgeVariant = "sale" | "soldout" | "new" | "brand" | "success" | "neutral"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: LegacyBadgeVariant | StoreBadgeVariant
}

const legacyVariants: Record<LegacyBadgeVariant, string> = {
    default:
        "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    secondary:
        "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive:
        "border-transparent bg-red-500 text-white hover:bg-red-500/80",
    outline: "text-foreground",
    accent:
        "border-transparent bg-accent text-accent-foreground hover:bg-accent/80",
}

const storeVariants: Record<StoreBadgeVariant, string> = {
    sale: "h-[22px] px-1.5 text-xs leading-none font-bold bg-sale text-white",
    soldout: "h-[22px] px-1.5 text-xs leading-none font-bold bg-ink text-white",
    new: "h-[22px] px-1.5 text-xs leading-none font-bold bg-brand-600 text-white",
    brand: "h-[22px] px-1.5 text-xs leading-none font-semibold bg-brand-50 text-brand-700",
    success: "h-[22px] px-1.5 text-xs leading-none font-semibold bg-success-50 text-success",
    neutral: "h-[22px] px-1.5 text-[11px] leading-4 font-semibold bg-surface-2 text-ink-2",
}

const isStoreVariant = (v: string): v is StoreBadgeVariant => v in storeVariants

function Badge({ className, variant = "default", ...props }: BadgeProps) {
    if (isStoreVariant(variant)) {
        return (
            <span
                className={cn("inline-flex items-center whitespace-nowrap rounded-chip tabular-nums", storeVariants[variant], className)}
                {...(props as React.HTMLAttributes<HTMLSpanElement>)}
            />
        )
    }

    return (
        <div
            className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                legacyVariants[variant],
                className
            )}
            {...props}
        />
    )
}

export { Badge }
