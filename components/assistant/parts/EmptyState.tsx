'use client'

/**
 * First screen of a new chat (SPEC §10.5): a greeting without a bubble, up to 4 starter chips that fit the
 * page, the cart and the time of day (starters.ts), a quiet WhatsApp alternative and one muted line that
 * says this is an AI and opens the Aydınlatma Metni (w7: it replaced the notice box and the composer footer).
 */
import * as React from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { itemsTotal } from '@/lib/pricing'
import { useShippingSettings } from '@/components/layout/store-data'
import { useCartStore } from '@/store/cart-store'
import type { Suggestion } from '@/lib/assistant/contract'
import { pageContext } from '../page-context'
import { starters } from '../starters'
import { useAssistantUi } from '../useAssistantChat'

export function EmptyState({ onChip, onNotice }: { onChip: (s: Suggestion) => void; onNotice: () => void }) {
    const { chat } = useAssistantUi()
    const pathname = usePathname() || '/'
    const items = useCartStore(s => s.items)
    const { freeShippingThreshold } = useShippingSettings()
    const chips = React.useMemo(
        () => starters({
            page: pageContext(pathname, typeof window !== 'undefined' ? window.location.search : ''),
            cartTotal: itemsTotal(items),
            cartHasFreeShipping: items.some(i => i.free_shipping),
            freeThreshold: freeShippingThreshold,
            now: new Date(),
        }),
        [pathname, items, freeShippingThreshold],
    )

    return (
        <div className="space-y-4">
            <p className="text-[15px] leading-[23px] text-ink">
                Merhaba, ben <strong className="font-semibold">Onopo Asistan</strong>. Telefonuna uygun şarj aletini, kabloyu ya da ekran
                koruyucuyu bulmana, ürünleri karşılaştırmana ve sipariş vermene yardım ederim.
            </p>
            <ChipRow chips={chips} onChip={onChip} size="starter" />
            {chat.waBase && (
                <p className="text-[13px] leading-5 text-muted">
                    İstersen{' '}
                    <button
                        type="button"
                        onClick={() => chat.insertWhatsapp('human', { summary: '' })}
                        className="font-semibold text-whatsapp underline underline-offset-2 hover:text-ink"
                    >
                        WhatsApp&apos;tan
                    </button>{' '}
                    da yazabilirsin.
                </p>
            )}
            <p className="pt-2 text-xs leading-4 text-muted">
                Yapay zekâ asistanı ·{' '}
                <button type="button" onClick={onNotice} className="underline underline-offset-2 hover:text-ink">
                    Aydınlatma Metni için tıkla
                </button>
            </p>
        </div>
    )
}

/**
 * Starter and follow-up chips: one sideways-scrolling row in the phone sheet, wrapped lines in the desktop
 * panel. A `chip: 'whatsapp'` chip opens a local WhatsApp card; the others send their label (and `chip`).
 */
export function ChipRow({ chips, onChip, size }: { chips: Suggestion[]; onChip: (s: Suggestion) => void; size: 'starter' | 'follow' }) {
    const { isSheet } = useAssistantUi()
    if (chips.length === 0) return null
    return (
        <div className={cn('flex gap-2', isSheet ? '-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]' : 'flex-wrap')}>
            {chips.map(c => (
                <button
                    key={c.label}
                    type="button"
                    onClick={() => onChip(c)}
                    className={cn(
                        'shrink-0 rounded-full border border-line bg-white px-3.5 text-sm font-semibold text-ink-2 transition-colors hover:border-brand-600 hover:text-brand-700 active:bg-brand-50',
                        size === 'starter' ? 'h-10' : 'h-9',
                    )}
                >
                    {c.label}
                </button>
            ))}
        </div>
    )
}
