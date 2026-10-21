import * as React from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Card network marks shown next to the pay button (decorative; the text says the same). */
export function PaymentMarks({ className }: { className?: string }) {
    const chip = 'h-6 w-9 shrink-0 rounded-[4px] border border-line bg-white'
    return (
        <div className={cn('flex items-center gap-1.5', className)} aria-hidden="true">
            <svg viewBox="0 0 36 24" className={chip}>
                <text x="18" y="15.5" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="9.5" fontWeight="900" fontStyle="italic" fill="#1A1F71" letterSpacing="-.2">
                    VISA
                </text>
            </svg>
            <svg viewBox="0 0 36 24" className={chip}>
                <circle cx="14.5" cy="12" r="6" fill="#EB001B" />
                <circle cx="21.5" cy="12" r="6" fill="#F79E1B" />
                <path d="M18 7.2a6 6 0 0 1 0 9.6a6 6 0 0 1 0-9.6z" fill="#FF5F00" />
            </svg>
            <svg viewBox="0 0 36 24" className={chip}>
                <text x="18" y="15.5" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="9" fontWeight="700" fill="#0B1220" letterSpacing=".2">
                    troy
                </text>
            </svg>
            <span className="inline-flex h-6 items-center rounded-[4px] border border-line bg-white px-1.5 text-[10px] font-bold leading-none text-ink-2">
                3D Secure
            </span>
        </div>
    )
}

/**
 * Security note under the pay button: card details are entered on PayTR's page, never stored by us.
 * `provider` is the active payment provider name shown to the customer.
 */
export function TrustNote({ provider = 'PayTR', className }: { provider?: string; className?: string }) {
    return (
        <div className={cn('rounded-card border border-line bg-surface px-3.5 py-3', className)}>
            <p className="flex items-start gap-2 text-[13px] leading-5 text-ink-2">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                <span>
                    Kart bilgilerini <strong className="font-semibold text-ink">{provider} güvencesiyle</strong>, 256-bit SSL ile şifrelenen
                    ödeme ekranında ve 3D Secure doğrulamasıyla girersin. Kart bilgilerin sitemizde saklanmaz.
                </span>
            </p>
            <PaymentMarks className="mt-2.5 pl-6" />
        </div>
    )
}
