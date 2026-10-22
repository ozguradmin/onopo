'use client'

/**
 * Shipping, payment, returns and support facts (SPEC §10.7). The rows are written by the server from the
 * store settings (canned texts of SPEC §9.6), so they always match what checkout and the CMS pages say.
 */
import * as React from 'react'
import Link from 'next/link'
import { Clock, CreditCard, MessageCircle, RotateCcw, ShieldCheck, Truck, type LucideIcon } from 'lucide-react'
import type { InfoRow } from '@/lib/assistant/contract'
import { useAssistantUi } from '../useAssistantChat'

const ICONS: Record<InfoRow['icon'], LucideIcon> = {
    truck: Truck,
    clock: Clock,
    card: CreditCard,
    return: RotateCcw,
    shield: ShieldCheck,
    chat: MessageCircle,
}

export function StoreInfoCard({ rows, href }: { rows: InfoRow[]; href: string | null }) {
    const { onNavigate } = useAssistantUi()
    if (rows.length === 0) return null
    return (
        <div className="space-y-2 rounded-card bg-surface p-3">
            <ul className="space-y-2">
                {rows.map((row, i) => {
                    const Icon = ICONS[row.icon] ?? MessageCircle
                    return (
                        <li key={i} className="flex items-start gap-2.5 text-[14px] leading-5 text-ink-2">
                            <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.75} />
                            <span>{row.text}</span>
                        </li>
                    )
                })}
            </ul>
            {href && (
                <Link href={href} prefetch={false} onClick={onNavigate} className="inline-flex min-h-9 items-center text-[13px] font-semibold text-brand-600 hover:text-brand-700">
                    Teslimat ve iade koşulları
                </Link>
            )}
        </div>
    )
}
