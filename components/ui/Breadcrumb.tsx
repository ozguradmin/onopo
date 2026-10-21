import * as React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { JsonLd } from '@/components/ui/JsonLd'

export interface BreadcrumbItem {
    label: string
    /** Omit for the current page (last item). Use trailing-slash paths ("/products/"). */
    href?: string
}

const SITE_ORIGIN = (process.env.NEXT_PUBLIC_BASE_URL || 'https://onopostore.com').replace(/\/$/, '')

/**
 * schema.org BreadcrumbList for the same items (absolute URLs). Use it directly when the JSON-LD
 * must live elsewhere (e.g. merged into a page's own JSON-LD graph).
 */
export function breadcrumbJsonLd(items: BreadcrumbItem[], origin: string = SITE_ORIGIN) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.label,
            ...(item.href ? { item: item.href.startsWith('http') ? item.href : origin + item.href } : {}),
        })),
    }
}

/**
 * Visible breadcrumb (13px muted, one horizontally scrollable line on mobile) plus, with `jsonLd`,
 * the matching BreadcrumbList structured data. Server-friendly.
 *
 *   <Breadcrumb jsonLd items={[{ label: 'Anasayfa', href: '/' }, { label: 'Kablolar', href: '/products/?category=…' }, { label: product.name }]} />
 */
export function Breadcrumb({ items, jsonLd = false, className }: { items: BreadcrumbItem[]; jsonLd?: boolean; className?: string }) {
    if (!items.length) return null
    return (
        <>
            <nav aria-label="Sayfa konumu" className={cn('no-scrollbar overflow-x-auto', className)}>
                <ol className="flex items-center gap-1 whitespace-nowrap text-[13px] leading-5 text-muted">
                    {items.map((item, i) => {
                        const last = i === items.length - 1
                        return (
                            <li key={`${i}-${item.label}`} className="flex min-w-0 items-center gap-1">
                                {item.href && !last ? (
                                    <Link href={item.href} prefetch={false} className="rounded-sm underline-offset-2 hover:text-ink hover:underline">
                                        {item.label}
                                    </Link>
                                ) : (
                                    <span aria-current={last ? 'page' : undefined} className={cn(last && 'max-w-[60vw] truncate text-ink-2 md:max-w-[480px]')}>
                                        {item.label}
                                    </span>
                                )}
                                {!last && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />}
                            </li>
                        )
                    })}
                </ol>
            </nav>
            {jsonLd && <JsonLd data={breadcrumbJsonLd(items)} />}
        </>
    )
}

export default Breadcrumb
