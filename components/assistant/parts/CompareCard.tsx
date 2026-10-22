'use client'

/**
 * Side-by-side comparison (SPEC §10.7). The rows (Fiyat, Güç, Bağlantı, Uzunluk, Kargo, Garanti, Stok) are
 * built by the server from D1 and product names, never by the model; "—" means the data does not say. On
 * phones three columns scroll sideways under a sticky label column.
 */
import * as React from 'react'
import Link from 'next/link'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { Price } from '@/components/ui/Price'
import { originalImageUrl, productImageUrl } from '@/lib/images'
import type { AssistantEvent } from '@/lib/assistant/contract'
import { useAssistantUi } from '../useAssistantChat'
import { AddButton } from './ProductCards'

type CompareEvent = Extract<AssistantEvent, { t: 'compare' }>

const CELL = 'border-t border-line px-2.5 py-2 text-[13px] leading-5 align-top'
const LABEL = 'sticky left-0 z-[1] w-[88px] min-w-[88px] bg-white text-left font-semibold text-muted'

export function CompareCard({ card }: { card: CompareEvent }) {
    const { chat, onNavigate } = useAssistantUi()
    if (card.products.length === 0) return null
    return (
        <div className="overflow-x-auto rounded-card border border-line">
            <table className="w-full border-collapse">
                <caption className="sr-only">Karşılaştırma</caption>
                <thead>
                    <tr>
                        <th scope="col" className={`${LABEL} px-2.5 py-2`}>
                            <span className="sr-only">Özellik</span>
                        </th>
                        {card.products.map(p => (
                            <th key={p.id} scope="col" className="min-w-[128px] px-2.5 py-2 text-left align-top font-normal">
                                <Link
                                    href={p.href}
                                    prefetch={false}
                                    onClick={() => {
                                        chat.beacon('card_click', { productId: p.id })
                                        onNavigate()
                                    }}
                                    className="flex flex-col gap-1.5"
                                >
                                    <FallbackImage
                                        src={productImageUrl(p.image, 200)}
                                        fallbackSrc={originalImageUrl(p.image)}
                                        alt=""
                                        width={56}
                                        height={56}
                                        loading="lazy"
                                        className="h-14 w-14 rounded-thumb border border-line bg-white object-contain p-1"
                                    />
                                    <span className="line-clamp-2 text-[13px] font-semibold leading-[18px] text-ink">{p.name}</span>
                                </Link>
                                <Price price={p.price} originalPrice={p.originalPrice} size="sm" className="mt-1" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {card.rows.map(row => (
                        <tr key={row.label}>
                            <th scope="row" className={`${LABEL} ${CELL}`}>{row.label}</th>
                            {card.products.map((p, i) => (
                                <td key={p.id} className={`${CELL} text-ink-2`}>{row.values[i] ?? '—'}</td>
                            ))}
                        </tr>
                    ))}
                    <tr>
                        <td className={`${LABEL} ${CELL}`} />
                        {card.products.map(p => (
                            <td key={p.id} className={CELL}>
                                <AddButton p={p} size="40" />
                            </td>
                        ))}
                    </tr>
                </tbody>
            </table>
        </div>
    )
}
