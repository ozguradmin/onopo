'use client'

/**
 * The cart above the composer once something was added from the chat (SPEC §10.7): count, items total and
 * the way to free shipping, read live from the cart store, so it updates in place (never a stack of
 * confirmations). Totals use lib/pricing, the same rounding the order API charges.
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { useShippingSettings } from '@/components/layout/store-data'
import { formatTL } from '@/lib/format'
import { itemsTotal } from '@/lib/pricing'
import { useCartStore } from '@/store/cart-store'
import { useAssistantStore } from '../assistant-store'

export function CartStrip() {
    const router = useRouter()
    const items = useCartStore(s => s.items)
    const { freeShippingThreshold } = useShippingSettings()
    const count = items.reduce((n, i) => n + (Number(i.quantity) || 0), 0)
    if (count === 0) return null

    const total = itemsTotal(items)
    const free = items.some(i => i.free_shipping) || (freeShippingThreshold > 0 && total >= freeShippingThreshold)
    const left = Math.max(0, Math.round((freeShippingThreshold - total) * 100) / 100)
    const progress = free || freeShippingThreshold <= 0 ? 100 : Math.min(100, Math.round((total / freeShippingThreshold) * 100))

    return (
        <div className="border-t border-line bg-white px-3 pb-2 pt-2.5">
            <div className="flex items-center justify-between gap-2 text-[13px] leading-5 text-ink-2">
                <p>
                    Sepetinde <strong className="font-bold text-ink">{count} ürün</strong> · <span className="tabular-nums">{formatTL(total)}</span>
                </p>
                <p className={free ? 'flex items-center gap-1 font-semibold text-success' : 'text-muted'}>
                    {free ? (
                        <>
                            <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} /> Kargo bedava
                        </>
                    ) : (
                        <>
                            Kargo bedavaya <strong className="font-bold tabular-nums text-ink">{formatTL(left)}</strong> kaldı
                        </>
                    )}
                </p>
            </div>
            <div aria-hidden="true" className="mt-1.5 h-[1.5px] w-full overflow-hidden rounded-full bg-line">
                <div className={free ? 'h-full bg-success' : 'h-full bg-brand-600'} style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => {
                        useAssistantStore.getState().minimize()
                        router.push('/odeme/')
                    }}
                    className={buttonClasses({ variant: 'brand', size: '40' })}
                >
                    Ödemeye geç
                </button>
                <button
                    type="button"
                    onClick={() => {
                        useAssistantStore.getState().minimize()
                        useCartStore.getState().openCart()
                    }}
                    className={buttonClasses({ variant: 'outline-ink', size: '40' })}
                >
                    Sepete git
                </button>
            </div>
        </div>
    )
}
