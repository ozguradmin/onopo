'use client'

/**
 * Category and page links (SPEC §10.7): whole-row links with the category's own icon, its product count and
 * the lowest current price, all from the server. The model only chose keys from the server's list.
 */
import * as React from 'react'
import Link from 'next/link'
import { ChevronRight, LayoutGrid } from 'lucide-react'
import { CategoryIcon } from '@/components/layout/CategoryIcon'
import { formatTL } from '@/lib/format'
import type { LinkItem } from '@/lib/assistant/contract'
import { useAssistantUi } from '../useAssistantChat'

function subtitle(item: LinkItem): string | null {
    const parts: string[] = []
    if (item.count != null) parts.push(`${item.count} ürün`)
    if (item.fromPrice != null) parts.push(`${formatTL(item.fromPrice)}'den başlayan fiyatlarla`)
    return parts.length ? parts.join(' · ') : null
}

export function LinkCards({ items }: { items: LinkItem[] }) {
    const { onNavigate } = useAssistantUi()
    if (items.length === 0) return null
    return (
        <ul className="space-y-2">
            {items.map(item => {
                const sub = subtitle(item)
                return (
                    <li key={item.href}>
                        <Link
                            href={item.href}
                            prefetch={false}
                            onClick={onNavigate}
                            className="flex items-center gap-3 rounded-card border border-line bg-white p-3 hover:border-brand-600"
                        >
                            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-thumb bg-brand-50 text-brand-600">
                                {item.icon ? <CategoryIcon name={item.icon} /> : <LayoutGrid className="h-5 w-5" strokeWidth={1.75} />}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-semibold leading-5 text-ink">{item.title}</span>
                                {sub && <span className="block truncate text-[13px] leading-5 text-muted">{sub}</span>}
                            </span>
                            <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
                        </Link>
                    </li>
                )
            })}
        </ul>
    )
}
