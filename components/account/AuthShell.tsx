'use client'

import * as React from 'react'
import { Heart, MapPin, Package } from 'lucide-react'

/**
 * What membership itself gives. Shipping, payment security and returns are left out on purpose: the top
 * bar and the pre-footer band already say them on every page (owner: the same sentences 2-3 times).
 */
function useBenefits() {
    return [
        { Icon: Package, text: 'Siparişlerini ve kargo durumunu tek yerden takip et' },
        { Icon: Heart, text: 'Beğendiğin ürünleri favorilerine kaydet' },
        { Icon: MapPin, text: 'Adresin kayıtlı kalsın, ödemeyi hızlıca tamamla' },
    ]
}

/**
 * Frame of the login / register / 2FA screens: one card with the form on the left and a dark brand
 * panel with real membership benefits on the right (desktop); mobile shows the form card only, with
 * the benefits listed under it.
 */
export function AuthShell({
    icon,
    title,
    subtitle,
    children,
    panelTitle = 'Üyelikle alışveriş daha kolay',
}: {
    icon: React.ReactNode
    title: string
    subtitle?: React.ReactNode
    children: React.ReactNode
    panelTitle?: string
}) {
    const benefits = useBenefits()
    return (
        <div className="min-h-[60vh] bg-surface py-6 sm:py-10 lg:py-16">
            <div className="container-store">
                <div className="mx-auto grid max-w-[1040px] overflow-hidden rounded-sheet border border-line bg-white shadow-raised lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                    <div className="px-5 py-7 sm:px-10 sm:py-10 lg:px-14 lg:py-14">
                        <div className="mx-auto w-full max-w-[400px]">
                            <span className="flex h-12 w-12 items-center justify-center rounded-card bg-brand-50 text-brand-600 [&_svg]:h-6 [&_svg]:w-6" aria-hidden="true">
                                {icon}
                            </span>
                            <h1 className="type-h1 mt-5 text-ink">{title}</h1>
                            {subtitle && <p className="mt-2 text-[15px] leading-6 text-muted">{subtitle}</p>}
                            <div className="mt-7">{children}</div>
                        </div>
                    </div>

                    <div className="relative hidden overflow-hidden bg-ink p-14 text-white lg:flex lg:flex-col lg:justify-center">
                        <div
                            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-40 blur-3xl"
                            style={{ background: 'radial-gradient(circle, var(--color-brand-500) 0%, transparent 70%)' }}
                            aria-hidden="true"
                        />
                        <div className="relative">
                            <p className="type-micro text-brand-100">Onopo üyeliği</p>
                            <h2 className="mt-3 text-[28px] font-extrabold leading-9 tracking-[-0.01em]">{panelTitle}</h2>
                            <ul className="mt-8 space-y-4">
                                {benefits.map(({ Icon, text }) => (
                                    <li key={text} className="flex items-start gap-3.5 text-[15px] leading-6 text-white/85">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-white/10 text-brand-100" aria-hidden="true">
                                            <Icon className="h-[18px] w-[18px]" />
                                        </span>
                                        <span className="pt-1.5">{text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                <ul className="mx-auto mt-6 grid max-w-[1040px] gap-2.5 px-1 text-[13px] leading-5 text-muted sm:grid-cols-2 lg:hidden">
                    {benefits.slice(0, 4).map(({ Icon, text }) => (
                        <li key={text} className="flex items-center gap-2.5">
                            <Icon className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                            {text}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}
