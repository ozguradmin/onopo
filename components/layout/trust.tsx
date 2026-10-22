'use client'

/**
 * Trust badges (spec §15). Every claim is backed by data: the free-shipping rule from
 * shipping_settings, the installment count from the payment settings (getMaxInstallments), the return
 * window from the CMS shipping page (ShellFacts) and the phone/e-mail from site_settings.
 * Never "vade farksız": PayTR installment rates carry commission.
 */
import * as React from 'react'
import { CreditCard, Headset, Lock, RotateCcw, ShieldCheck, Truck, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShellFacts, useStoreData } from '@/components/layout/store-data'
import { formatAmountShort, telHref, whatsappHref } from '@/components/layout/nav-data'

export interface TrustItem {
    key: string
    icon: LucideIcon
    title: string
    text: string
    /** The text is a link (the support line: WhatsApp when the store has a mobile number, else the phone). */
    href?: string | null
}

/** Short announcement-bar messages (or the admin override site_settings.topbar_messages). */
export function useAnnouncements(): { key: string; icon: LucideIcon | null; text: string }[] {
    const { settings, shipping, maxInstallments } = useStoreData()
    const { returnDays } = useShellFacts()
    if (settings.topbar_messages && settings.topbar_messages.length > 0) {
        return settings.topbar_messages.slice(0, 4).map((text, i) => ({ key: `m${i}`, icon: null, text }))
    }
    const list: { key: string; icon: LucideIcon | null; text: string }[] = []
    if (shipping.freeShippingThreshold > 0) {
        list.push({ key: 'ship', icon: Truck, text: `${formatAmountShort(shipping.freeShippingThreshold)} üzeri kargo bedava` })
    } else if (shipping.shippingCost === 0) {
        list.push({ key: 'ship', icon: Truck, text: 'Tüm siparişlerde kargo bedava' })
    }
    if (maxInstallments) list.push({ key: 'inst', icon: CreditCard, text: `Kredi kartına ${maxInstallments} taksit` })
    list.push({ key: 'ret', icon: RotateCcw, text: `${returnDays} gün kolay iade` })
    return list
}

/** The four pre-footer badges: fast shipping, secure payment, returns, support. */
export function useTrustItems(): TrustItem[] {
    const { settings, shipping, maxInstallments } = useStoreData()
    const { returnDays } = useShellFacts()
    const shipText =
        shipping.freeShippingThreshold > 0
            ? `${formatAmountShort(shipping.freeShippingThreshold)} ve üzeri siparişlerde kargo bedava`
            : shipping.shippingCost === 0
                ? 'Tüm siparişlerde kargo bedava'
                : `Kargo ücreti ${formatAmountShort(shipping.shippingCost)}`
    const contact = settings.footer_phone || settings.footer_email
    const wa = whatsappHref(settings.whatsapp_number)
    const helpHref = wa ?? (settings.footer_phone ? telHref(settings.footer_phone) : settings.footer_email ? `mailto:${settings.footer_email}` : null)
    return [
        { key: 'ship', icon: Truck, title: 'Hızlı kargo', text: shipText },
        {
            key: 'pay',
            icon: ShieldCheck,
            title: 'Güvenli ödeme',
            text: maxInstallments ? `256-bit SSL, PayTR altyapısı, ${maxInstallments} taksit` : '256-bit SSL ile PayTR altyapısı',
        },
        { key: 'ret', icon: RotateCcw, title: `${returnDays} gün kolay iade`, text: `Teslimattan sonra ${returnDays} gün içinde iade hakkı` },
        {
            key: 'help',
            icon: Headset,
            title: 'Müşteri desteği',
            text: wa ? "WhatsApp'tan yazın" : contact ? `Sorularınız için ${contact}` : 'Sipariş ve ürün sorularınız için',
            href: helpHref,
        },
    ]
}

/** Pre-footer band: 4 badges in a row on desktop, 2×2 on phones. */
export function TrustBand({ className }: { className?: string }) {
    const items = useTrustItems()
    return (
        <section aria-label="Alışveriş güvenceleri" className={cn('border-t border-line bg-surface', className)}>
            <ul className="container-store grid grid-cols-2 gap-x-4 gap-y-5 py-6 lg:grid-cols-4 lg:gap-8 lg:py-8">
                {items.map(({ key, icon: Icon, title, text, href }) => (
                    <li key={key} className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 lg:h-11 lg:w-11" aria-hidden="true">
                            <Icon className="h-5 w-5" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold leading-5 text-ink">{title}</span>
                            {href ? (
                                <a
                                    href={href}
                                    {...(href.startsWith('https://') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                    className="mt-0.5 block break-words text-[13px] font-semibold leading-5 text-brand-600 underline-offset-2 hover:underline"
                                >
                                    {text}
                                </a>
                            ) : (
                                <span className="mt-0.5 block break-words text-[13px] leading-5 text-muted">{text}</span>
                            )}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    )
}

/** Accepted cards as plain text marks (no brand artwork) + PayTR. */
export function PaymentMarks({ tone = 'light', className }: { tone?: 'light' | 'dark'; className?: string }) {
    const box =
        tone === 'dark'
            ? 'border-white/20 text-white/85'
            : 'border-line text-ink-2 bg-white'
    return (
        <ul aria-label="Ödeme yöntemleri" className={cn('flex flex-wrap items-center gap-1.5', className)}>
            <li className={cn('inline-flex h-7 items-center rounded-chip border px-2 text-[11px] font-extrabold italic tracking-wide', box)}>VISA</li>
            <li className={cn('inline-flex h-7 items-center gap-1 rounded-chip border px-2 text-[11px] font-bold', box)}>
                <svg viewBox="0 0 20 12" className="h-3 w-5" aria-hidden="true">
                    <circle cx="7" cy="6" r="5" fill="currentColor" opacity=".55" />
                    <circle cx="13" cy="6" r="5" fill="currentColor" opacity=".3" />
                </svg>
                Mastercard
            </li>
            <li className={cn('inline-flex h-7 items-center rounded-chip border px-2 text-[11px] font-extrabold tracking-wider', box)}>TROY</li>
            <li className={cn('inline-flex h-7 items-center gap-1 rounded-chip border px-2 text-[11px] font-bold', box)}>
                <Lock className="h-3 w-3" aria-hidden="true" strokeWidth={2.5} />
                PayTR
            </li>
        </ul>
    )
}
