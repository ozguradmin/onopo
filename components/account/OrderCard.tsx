import * as React from 'react'
import Link from 'next/link'
import { CheckCircle2, Clock, ExternalLink, FileText, MapPin, MessageSquareText, Package, Truck, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { formatDateTR, formatTL } from '@/lib/format'
import { originalImageUrl, productImageUrl } from '@/lib/images'
import type { AccountOrder } from '@/lib/account'

type Tone = 'warning' | 'brand' | 'success' | 'danger' | 'neutral'

/** Order statuses (orders.status). Labels match the BirFatura status names the owner sees. */
const STATUS: Record<string, { label: string; tone: Tone; Icon: typeof Clock }> = {
    pending: { label: 'Beklemede', tone: 'warning', Icon: Clock },
    approved: { label: 'Onaylandı', tone: 'brand', Icon: CheckCircle2 },
    processing: { label: 'Hazırlanıyor', tone: 'brand', Icon: Package },
    shipped: { label: 'Kargoya verildi', tone: 'brand', Icon: Truck },
    completed: { label: 'Tamamlandı', tone: 'success', Icon: CheckCircle2 },
    delivered: { label: 'Teslim edildi', tone: 'success', Icon: CheckCircle2 },
    cancelled: { label: 'İptal edildi', tone: 'danger', Icon: XCircle },
}

const TONE_CLASSES: Record<Tone, string> = {
    warning: 'bg-warning-50 text-warning',
    brand: 'bg-brand-50 text-brand-700',
    success: 'bg-success-50 text-success',
    danger: 'bg-sale-50 text-danger',
    neutral: 'bg-surface-2 text-ink-2',
}

const PROGRESS = ['Onaylandı', 'Hazırlanıyor', 'Kargoda', 'Teslim edildi'] as const
const PROGRESS_INDEX: Record<string, number> = { approved: 0, processing: 1, shipped: 2, completed: 3, delivered: 3 }

function trackingLink(order: AccountOrder): string | null {
    if (order.trackingUrl) return order.trackingUrl
    if (!order.trackingNumber) return null
    // Orders without a carrier name were shipped with Aras (the only carrier before BirFatura sent one)
    if (!order.shippingCompany || /aras/i.test(order.shippingCompany)) {
        return `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${encodeURIComponent(order.trackingNumber)}`
    }
    return null
}

export interface OrderCardProduct {
    slug: string
    image: string | null
}

export function OrderCard({ order, products }: { order: AccountOrder; products: Map<number, OrderCardProduct> }) {
    const status = STATUS[order.status] ?? { label: order.status || 'Beklemede', tone: 'neutral' as Tone, Icon: Clock }
    const progress = PROGRESS_INDEX[order.status]
    const itemCount = order.lines.reduce((n, l) => n + l.quantity, 0)
    const itemsTotal = order.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
    const track = trackingLink(order)
    const titleId = `order-${order.id}`
    const place = [order.district, order.city].filter(Boolean).join(' / ')

    return (
        <article aria-labelledby={titleId} className="overflow-hidden rounded-sheet border border-line bg-white shadow-card">
            <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                    <h2 id={titleId} className="text-base font-bold text-ink">
                        Sipariş <span className="tabular">#{order.id}</span>
                    </h2>
                    <p className="mt-0.5 text-[13px] text-muted">
                        {formatDateTR(order.createdAt)}
                        {itemCount > 0 && <> · {itemCount} ürün</>}
                        {' · '}
                        <span className="font-semibold text-ink-2 tabular">{formatTL(order.totalAmount)}</span>
                    </p>
                </div>
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold', TONE_CLASSES[status.tone])}>
                    <status.Icon className="h-4 w-4" aria-hidden="true" />
                    {status.label}
                </span>
            </header>

            {progress !== undefined && (
                <div className="border-b border-line px-4 py-3.5 sm:px-5">
                    <ol className="grid grid-cols-4 gap-1.5" aria-label="Sipariş durumu">
                        {PROGRESS.map((label, i) => (
                            <li key={label} className="min-w-0" aria-current={i === progress ? 'step' : undefined}>
                                <span className={cn('block h-1.5 rounded-full', i <= progress ? (progress === 3 ? 'bg-success' : 'bg-brand-500') : 'bg-line')} aria-hidden="true" />
                                <span className={cn('mt-1.5 block truncate text-[11px] font-semibold leading-4 sm:text-xs', i <= progress ? 'text-ink-2' : 'text-subtle')}>
                                    {label}
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            {order.status === 'cancelled' && order.paymentStatus === 'failed' && (
                <p className="border-b border-line bg-sale-50/50 px-4 py-2.5 text-[13px] text-danger sm:px-5">Ödeme tamamlanmadığı için sipariş iptal edildi.</p>
            )}

            {order.lines.length > 0 && (
                <ul className="divide-y divide-line px-4 sm:px-5">
                    {order.lines.map((line, i) => {
                        const product = line.productId ? products.get(line.productId) : undefined
                        const href = product ? `/${product.slug}/` : null
                        const thumb = (
                            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-thumb border border-line bg-white p-1">
                                {product?.image ? (
                                    <FallbackImage
                                        src={productImageUrl(product.image, 200)}
                                        fallbackSrc={originalImageUrl(product.image)}
                                        alt=""
                                        width={56}
                                        height={56}
                                        loading="lazy"
                                        className="h-full w-full object-contain"
                                    />
                                ) : (
                                    <Package className="h-6 w-6 text-subtle" aria-hidden="true" />
                                )}
                            </span>
                        )
                        return (
                            <li key={`${line.productId}-${i}`} className="flex items-center gap-3 py-3">
                                {href ? (
                                    <Link href={href} prefetch={false} tabIndex={-1} aria-hidden="true">
                                        {thumb}
                                    </Link>
                                ) : (
                                    thumb
                                )}
                                <div className="min-w-0 flex-1">
                                    {href ? (
                                        <Link href={href} prefetch={false} className="line-clamp-2 text-sm font-medium leading-5 text-ink hover:text-brand-600 hover:underline">
                                            {line.name}
                                        </Link>
                                    ) : (
                                        <p className="line-clamp-2 text-sm font-medium leading-5 text-ink">{line.name}</p>
                                    )}
                                    <p className="mt-0.5 text-[13px] text-muted tabular">
                                        {line.quantity} adet × {formatTL(line.unitPrice)}
                                    </p>
                                </div>
                                <p className="shrink-0 text-sm font-bold text-ink tabular">{formatTL(line.unitPrice * line.quantity)}</p>
                            </li>
                        )
                    })}
                </ul>
            )}

            <div className="grid gap-4 border-t border-line bg-surface/60 px-4 py-4 sm:grid-cols-2 sm:px-5">
                <div className="space-y-3 text-[13px] leading-5 text-ink-2">
                    {place && (
                        <p className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                            <span>
                                <span className="text-muted">Teslimat: </span>
                                {order.fullName && <>{order.fullName}, </>}
                                {place}
                            </span>
                        </p>
                    )}
                    {order.trackingNumber && (
                        <p className="flex items-start gap-2">
                            <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                            <span>
                                <span className="text-muted">Kargo takip{order.shippingCompany ? ` (${order.shippingCompany})` : ''}: </span>
                                {track ? (
                                    <a href={track} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700 hover:underline">
                                        <span className="tabular">{order.trackingNumber}</span>
                                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                        <span className="sr-only">(yeni sekmede açılır)</span>
                                    </a>
                                ) : (
                                    <span className="font-semibold tabular">{order.trackingNumber}</span>
                                )}
                            </span>
                        </p>
                    )}
                    {order.invoiceUrl && (
                        <p className="flex items-start gap-2">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                            <a href={order.invoiceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700 hover:underline">
                                {order.invoiceNo ? `Fatura ${order.invoiceNo}` : 'Faturayı görüntüle'}
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                <span className="sr-only">(yeni sekmede açılır)</span>
                            </a>
                        </p>
                    )}
                    {order.note && (
                        <p className="flex items-start gap-2">
                            <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                            <span>
                                <span className="text-muted">Notun: </span>
                                {order.note}
                            </span>
                        </p>
                    )}
                </div>
                <dl className="space-y-1.5 text-[13px] sm:justify-self-end sm:text-right">
                    {order.lines.length > 0 && (
                        <div className="flex justify-between gap-6 sm:justify-end">
                            <dt className="text-muted">Ara toplam</dt>
                            <dd className="text-ink-2 tabular">{formatTL(itemsTotal)}</dd>
                        </div>
                    )}
                    {order.shippingCost !== null && (
                        <div className="flex justify-between gap-6 sm:justify-end">
                            <dt className="text-muted">Kargo</dt>
                            <dd className={cn('tabular', order.shippingCost === 0 ? 'font-semibold text-success' : 'text-ink-2')}>
                                {order.shippingCost === 0 ? 'Bedava' : formatTL(order.shippingCost)}
                            </dd>
                        </div>
                    )}
                    <div className="flex justify-between gap-6 pt-1 text-[15px] sm:justify-end">
                        <dt className="font-semibold text-ink">Toplam</dt>
                        <dd className="font-extrabold text-ink tabular">{formatTL(order.totalAmount)}</dd>
                    </div>
                </dl>
            </div>
        </article>
    )
}
