import * as React from "react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

/**
 * Button.
 *
 * Storefront (design spec) variants — use these in new code:
 *   brand        solid brand-600, white text      → primary CTAs (Sepete Ekle, Ödemeye geç)
 *   ink          solid ink, white text            → strong secondary
 *   outline-ink  ink outline, fills ink on hover  → "Hemen Al", card "Sepete Ekle"
 *   subtle       surface-2 background             → quiet actions (Temizle)
 *   white        white background, ink text       → on images / dark bands (hero)
 *   whatsapp     outline, WhatsApp-green text     → "WhatsApp ile sipariş"
 *   plain        no background                    → icon buttons, text actions
 * Storefront sizes are the rendered height in px: "32" | "40" | "44" | "48" | "52"; add `iconOnly`
 * for a square icon button (always give it an aria-label).
 *
 * Legacy variants ("primary" | "secondary" | "accent" | "outline" | "ghost" | "link") and sizes
 * ("default" | "sm" | "lg" | "icon") are unchanged because the admin panel and older pages use them.
 *
 * For links styled as buttons use `buttonClasses({...})` on a <Link>.
 */
export type LegacyButtonVariant = "primary" | "secondary" | "accent" | "outline" | "ghost" | "link"
export type StoreButtonVariant = "brand" | "ink" | "outline-ink" | "subtle" | "white" | "whatsapp" | "plain"
export type LegacyButtonSize = "default" | "sm" | "lg" | "icon"
export type StoreButtonSize = "32" | "40" | "44" | "48" | "52"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: LegacyButtonVariant | StoreButtonVariant
    size?: LegacyButtonSize | StoreButtonSize
    /** Square button (width = height, no horizontal padding). Store sizes only. */
    iconOnly?: boolean
    fullWidth?: boolean
    isLoading?: boolean
}

const legacyVariants: Record<LegacyButtonVariant, string> = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-md shadow-secondary/20",
    accent: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/20",
    outline: "border border-slate-200 bg-transparent hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-50",
    ghost: "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50",
    link: "text-primary underline-offset-4 hover:underline",
}

const legacySizes: Record<LegacyButtonSize, string> = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
}

const storeVariants: Record<StoreButtonVariant, string> = {
    brand: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700",
    ink: "bg-ink text-white hover:bg-ink-2",
    "outline-ink": "border border-ink bg-white text-ink hover:bg-ink hover:text-white",
    subtle: "bg-surface-2 text-ink hover:bg-line",
    white: "bg-white text-ink hover:bg-surface",
    whatsapp: "border border-line-strong bg-white text-whatsapp hover:border-whatsapp hover:bg-success-50",
    plain: "bg-transparent text-ink hover:bg-surface-2",
}

const storeSizes: Record<StoreButtonSize, { box: string; square: string }> = {
    "32": { box: "h-8 px-3 text-[13px] leading-4 rounded-thumb", square: "h-8 w-8 rounded-thumb" },
    "40": { box: "h-10 px-4 text-sm leading-5 rounded-card", square: "h-10 w-10 rounded-card" },
    "44": { box: "h-11 px-4 text-sm leading-5 rounded-card", square: "h-11 w-11 rounded-card" },
    "48": { box: "h-12 px-5 text-[15px] leading-5 rounded-card", square: "h-12 w-12 rounded-card" },
    "52": { box: "h-[52px] px-6 text-[15px] leading-5 rounded-card", square: "h-[52px] w-[52px] rounded-card" },
}

const LEGACY_BASE = "inline-flex items-center justify-center rounded-xl text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95"
const STORE_BASE = "inline-flex shrink-0 items-center justify-center gap-2 font-semibold whitespace-nowrap select-none transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0"

const isStoreVariant = (v: string): v is StoreButtonVariant => v in storeVariants
const isStoreSize = (s: string): s is StoreButtonSize => s in storeSizes

/** Class string for a button look; use on <Link>/<a> to get a button-styled link. */
export function buttonClasses({
    variant = "primary",
    size,
    iconOnly = false,
    fullWidth = false,
    className,
}: Pick<ButtonProps, "variant" | "size" | "iconOnly" | "fullWidth" | "className"> = {}): string {
    if (isStoreVariant(variant) || (size && isStoreSize(size))) {
        const s: StoreButtonSize = size && isStoreSize(size) ? size : "48"
        const v = isStoreVariant(variant) ? storeVariants[variant] : legacyVariants[variant as LegacyButtonVariant]
        return cn(STORE_BASE, iconOnly ? storeSizes[s].square : storeSizes[s].box, v, fullWidth && "w-full", className)
    }
    const legacySize = (size as LegacyButtonSize) || "default"
    return cn(LEGACY_BASE, legacyVariants[variant as LegacyButtonVariant], legacySizes[legacySize], fullWidth && "w-full", className)
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size, iconOnly, fullWidth, isLoading, children, ...props }, ref) => {
        return (
            <button
                className={buttonClasses({ variant, size, iconOnly, fullWidth, className })}
                ref={ref}
                disabled={isLoading || props.disabled}
                aria-busy={isLoading || undefined}
                {...props}
            >
                {isLoading && <Loader2 className={cn(!isStoreVariant(variant) && "mr-2", "h-4 w-4 animate-spin")} aria-hidden="true" />}
                {children}
            </button>
        )
    }
)
Button.displayName = "Button"

export { Button }
