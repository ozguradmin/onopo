'use client'

/**
 * The visitor's cart in the chat (contract v2 `cart`, "sepetimde neler var"): a compact list with a quantity
 * stepper and "Kaldır" per line, the count and total, the way to free shipping, and "Ödemeye geç" /
 * "Sepete git". The lines are read LIVE from the cart store (the server's lines only add the product link and
 * photo), so a change made here, in the drawer or in another tab shows at once, here and in the cart strip.
 *
 * Also the receipt row of a `cart_ops` ("<note> · Geri al"): the assistant already changed the cart; "Geri al"
 * puts the earlier lines back.
 */
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Minus, Plus, Undo2 } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { displayPrice, formatTL } from '@/lib/format'
import { originalImageUrl, productImageUrl } from '@/lib/images'
import { itemsTotal } from '@/lib/pricing'
import { productPath } from '@/lib/seo'
import { useCartStore, type CartItem } from '@/store/cart-store'
import type { CardProduct } from '@/lib/assistant/contract'
import { useAssistantStore } from '../assistant-store'
import { freeShippingState, MAX_LINE_QTY, productIdOf } from '../cart-ops'
import type { CartEvent, CartReceipt } from '../chat-reducer'
import { useAssistantUi } from '../useAssistantChat'

const SHOW_LINES = 8

/** − qty + for one cart line; at 1, "−" removes the line. */
export function QtyStepper({ qty, name, onChange, className }: { qty: number; name: string; onChange: (qty: number) => void; className?: string }) {
    const btn = 'flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface hover:text-ink disabled:opacity-40'
    return (
        <div className={`inline-flex shrink-0 items-center rounded-full border border-line bg-white ${className ?? ''}`}>
            <button type="button" aria-label={qty <= 1 ? `${name}: sepetten çıkar` : `${name}: bir azalt`} onClick={() => onChange(qty - 1)} className={btn}>
                <Minus aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <span aria-live="polite" className="min-w-5 text-center text-[13px] font-bold tabular-nums text-ink">{qty}</span>
            <button type="button" aria-label={`${name}: bir artır`} onClick={() => onChange(qty + 1)} disabled={qty >= MAX_LINE_QTY} className={btn}>
                <Plus aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
        </div>
    )
}

function CartRow({ item, info }: { item: CartItem; info: CardProduct | undefined }) {
    const { chat, onNavigate } = useAssistantUi()
    const pid = productIdOf(item.id)
    const href = info?.href ?? (item.slug ? productPath(item.slug) : null)
    const image = item.image || info?.image || null
    const qty = Math.max(1, Number(item.quantity) || 1)
    const change = (next: number) => {
        useCartStore.getState().updateQuantity(item.id, Math.min(MAX_LINE_QTY, next))
        chat.noteCartChange(pid)
    }
    const remove = () => {
        useCartStore.getState().removeItem(item.id)
        chat.noteCartChange(pid)
    }
    const follow = () => {
        if (pid) chat.beacon('card_click', { productId: pid })
        onNavigate()
    }
    const thumb = (
        <FallbackImage
            src={productImageUrl(image, 200)}
            fallbackSrc={originalImageUrl(image)}
            alt=""
            width={48}
            height={48}
            className="h-full w-full object-contain p-[6%]"
        />
    )
    return (
        <li className="flex items-center gap-2.5 py-2.5">
            {href ? (
                <Link href={href} prefetch={false} onClick={follow} tabIndex={-1} aria-hidden="true" className="h-12 w-12 shrink-0 overflow-hidden rounded-thumb border border-line bg-white">
                    {thumb}
                </Link>
            ) : (
                <span aria-hidden="true" className="h-12 w-12 shrink-0 overflow-hidden rounded-thumb border border-line bg-white">{thumb}</span>
            )}
            <div className="min-w-0 flex-1">
                {href ? (
                    <Link href={href} prefetch={false} onClick={follow} title={item.name} className="line-clamp-2 text-[13px] font-semibold leading-[18px] text-ink hover:text-brand-700">
                        {item.name}
                    </Link>
                ) : (
                    <p className="line-clamp-2 text-[13px] font-semibold leading-[18px] text-ink">{item.name}</p>
                )}
                <p className="mt-0.5 flex items-center gap-2 text-[12px] leading-4 text-ink-2">
                    <span className="tabular-nums">{formatTL(displayPrice(item.price))}</span>
                    <button type="button" onClick={remove} aria-label={`${item.name}: sepetten kaldır`} className="min-h-6 font-semibold text-muted underline-offset-2 hover:text-sale hover:underline">
                        Kaldır
                    </button>
                </p>
            </div>
            <QtyStepper qty={qty} name={item.name} onChange={change} />
        </li>
    )
}

export function CartCard({ card }: { card: CartEvent }) {
    const router = useRouter()
    const { freeThreshold } = useAssistantUi()
    const items = useCartStore(s => s.items)
    const info = React.useMemo(() => new Map(card.lines.map(l => [l.product.id, l.product])), [card.lines])
    const [all, setAll] = React.useState(false)

    const pieces = items.reduce((n, i) => n + (Number(i.quantity) || 0), 0)
    if (items.length === 0 || pieces === 0) {
        return <p className="rounded-card border border-line bg-white px-3 py-3 text-[13px] leading-5 text-muted">Sepetin şu an boş.</p>
    }

    const threshold = freeThreshold > 0 ? freeThreshold : card.threshold
    const total = itemsTotal(items)
    const ship = freeShippingState(total, threshold, items.some(i => i.free_shipping))
    const shown = all ? items : items.slice(0, SHOW_LINES)
    const go = (fn: () => void) => () => {
        useAssistantStore.getState().minimize()
        fn()
    }

    return (
        <section aria-label="Sepetin" className="rounded-card border border-line bg-white">
            <div className="flex items-baseline justify-between gap-2 px-3 pt-3">
                <h3 className="text-[14px] font-bold leading-5 text-ink">Sepetin</h3>
                <p className="text-[12px] leading-4 text-muted">
                    {items.length} ürün{pieces !== items.length ? ` · ${pieces} adet` : ''}
                </p>
            </div>
            <ul className="divide-y divide-line px-3">
                {shown.map(item => (
                    <CartRow key={String(item.id)} item={item} info={info.get(productIdOf(item.id))} />
                ))}
            </ul>
            {items.length > shown.length && (
                <button type="button" onClick={() => setAll(true)} className="mx-3 min-h-9 text-[13px] font-semibold text-brand-600 hover:text-brand-700">
                    {items.length - shown.length} ürün daha göster
                </button>
            )}
            <div className="border-t border-line px-3 pb-3 pt-2.5">
                <p className="flex items-center justify-between text-[13px] leading-5 text-ink-2">
                    <span>Ara toplam</span>
                    <strong className="font-bold tabular-nums text-ink">{formatTL(total)}</strong>
                </p>
                {(ship.free || threshold > 0) && (
                    <>
                        <p className={ship.free ? 'mt-1 flex items-center gap-1 text-[12px] font-semibold leading-4 text-success' : 'mt-1 text-[12px] leading-4 text-muted'}>
                            {ship.free ? (
                                <>
                                    <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} /> Kargo bedava
                                </>
                            ) : (
                                <>
                                    Kargo bedavaya <strong className="font-bold tabular-nums text-ink">{formatTL(ship.left)}</strong> kaldı
                                </>
                            )}
                        </p>
                        <div aria-hidden="true" className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-line">
                            <div className={ship.free ? 'h-full bg-success' : 'h-full bg-brand-600'} style={{ width: `${ship.progress}%` }} />
                        </div>
                    </>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={go(() => router.push('/odeme/'))} className={buttonClasses({ variant: 'brand', size: '40' })}>
                        Ödemeye geç
                    </button>
                    <button type="button" onClick={go(() => useCartStore.getState().openCart())} className={buttonClasses({ variant: 'outline-ink', size: '40' })}>
                        Sepete git
                    </button>
                </div>
            </div>
        </section>
    )
}

/** "<note> · Geri al" under a turn in which the assistant changed the cart. */
export function CartReceiptRow({ receipt, messageId, index }: { receipt: CartReceipt; messageId: string; index: number }) {
    const { chat } = useAssistantUi()
    if (receipt.state === 'pending') return null
    if (receipt.state === 'none') {
        return <p className="text-[13px] leading-5 text-muted">Sepetinde bir değişiklik olmadı.</p>
    }
    const note = receipt.note || 'Sepetin güncellendi'
    return (
        <p className="flex flex-wrap items-center gap-x-1.5 rounded-card bg-surface px-3 py-2 text-[13px] leading-5 text-ink-2">
            {receipt.state === 'undone' ? (
                <span className="text-muted">
                    <span className="line-through">{note}</span> · Geri alındı
                </span>
            ) : (
                <>
                    <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={3} />
                    <span>{note}</span>
                    <span aria-hidden="true" className="text-muted">·</span>
                    <button
                        type="button"
                        onClick={() => chat.undoCart(messageId, index)}
                        className="inline-flex min-h-8 items-center gap-1 font-semibold text-brand-600 hover:text-brand-700"
                    >
                        <Undo2 aria-hidden="true" className="h-3.5 w-3.5" /> Geri al
                    </button>
                </>
            )}
        </p>
    )
}
