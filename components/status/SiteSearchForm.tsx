'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Plain search box for the 404 / error pages. Submit goes to /products/?q= with client navigation
 * (router.push); without JavaScript the GET form does the same.
 */
export function SiteSearchForm({ className, autoFocus = false }: { className?: string; autoFocus?: boolean }) {
    const router = useRouter()
    const [q, setQ] = React.useState('')

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const term = q.trim()
        router.push(term ? `/products/?q=${encodeURIComponent(term)}` : '/products/')
    }

    return (
        <form action="/products/" method="get" role="search" onSubmit={onSubmit} className={cn('flex w-full gap-2', className)}>
            <label htmlFor="site-search-q" className="sr-only">
                Ürün ara
            </label>
            <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                    id="site-search-q"
                    name="q"
                    type="search"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    autoFocus={autoFocus}
                    autoComplete="off"
                    enterKeyHint="search"
                    placeholder="Ürün, model veya cihaz ara"
                    className="h-12 w-full rounded-card border border-transparent bg-field pl-11 pr-3 text-[15px] text-ink placeholder:text-subtle transition-[border-color,box-shadow,background-color] duration-150 focus:border-brand-600 focus:bg-white focus:shadow-focus focus:outline-none"
                />
            </div>
            <button
                type="submit"
                className="inline-flex h-12 shrink-0 items-center justify-center rounded-card bg-brand-600 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-700"
            >
                Ara
            </button>
        </form>
    )
}
