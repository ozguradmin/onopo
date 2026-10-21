'use client'

/**
 * Client islands of the status pages (404, route error, maintenance).
 *
 * Why client components: Next renders the root app/not-found.tsx tree into the RSC payload of EVERY
 * page (it is the fallback of the root not-found boundary). Server markup there would be shipped
 * with every page, and a server-rendered data-onopo-nocache marker would appear (as JSON) in every
 * page's HTML. Client components only leave a module reference in the payload, so the marker and
 * the category list exist in the HTML only when the 404 page is really shown.
 */
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Home, Search, SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonClasses } from '@/components/ui/button'
import { formatCount } from '@/lib/format'
import { useCategories } from '@/components/layout/store-data'

/**
 * Edge-cache contract: responses whose HTML contains this element are never stored by the worker
 * (error states, 404s, maintenance).
 */
export function NoCacheMarker() {
    return <div hidden data-onopo-nocache="" />
}

/**
 * Plain search box. Submit goes to /products/?q= with client navigation (router.push); without
 * JavaScript the GET form does the same.
 */
export function SiteSearchForm({ className }: { className?: string }) {
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

/** Categories that have products (server-loaded store data, no fetch), largest first. */
export function PopularCategories({ limit = 6 }: { limit?: number }) {
    const categories = useCategories()
    const top = React.useMemo(
        () => [...categories].filter(c => c.product_count > 0).sort((a, b) => b.product_count - a.product_count).slice(0, limit),
        [categories, limit],
    )
    if (!top.length) return null
    return (
        <section aria-labelledby="nf-categories" className="container-store pb-14 pt-10 lg:pb-20 lg:pt-14">
            <h2 id="nf-categories" className="type-h2 text-ink">
                Popüler kategoriler
            </h2>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {top.map(c => (
                    <li key={c.id}>
                        <Link
                            href={c.href}
                            className="group flex min-h-16 items-center justify-between gap-3 rounded-card border border-line bg-white px-4 py-3 transition-colors hover:border-ink"
                        >
                            <span className="min-w-0">
                                <span className="block truncate text-[15px] font-semibold text-ink">{c.name}</span>
                                <span className="block text-[13px] text-muted">{formatCount(c.product_count)}</span>
                            </span>
                            <ArrowRight className="h-5 w-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    )
}

const POPULAR_SEARCHES = ['Type-C kablo', 'Şarj aleti', 'iPhone', 'Powerbank', 'Araç şarj', 'Ekran koruyucu']

/** The whole 404 view (see the note at the top of this file for why it is a client component). */
export function NotFoundView() {
    return (
        <div className="bg-canvas">
            <NoCacheMarker />
            <section className="bg-surface">
                <div className="container-store py-10 text-center lg:py-16">
                    <div className="mx-auto max-w-2xl">
                        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-brand-600 shadow-card" aria-hidden="true">
                            <SearchX className="h-8 w-8" />
                        </span>
                        <p className="type-micro mt-5 text-brand-600">Hata 404</p>
                        <h1 className="type-h1 mt-2 text-ink">Aradığın sayfayı bulamadık</h1>
                        <p className="mx-auto mt-3 max-w-lg text-[15px] leading-6 text-muted">
                            Bağlantı eskimiş ya da sayfa kaldırılmış olabilir. Aradığın ürünü hemen bulalım:
                        </p>

                        <SiteSearchForm className="mx-auto mt-6 max-w-xl" />

                        <div className="mt-4">
                            <p className="sr-only">Popüler aramalar</p>
                            <ul className="flex flex-wrap justify-center gap-2">
                                {POPULAR_SEARCHES.map(term => (
                                    <li key={term}>
                                        <Link
                                            href={`/products/?q=${encodeURIComponent(term)}`}
                                            prefetch={false}
                                            rel="nofollow"
                                            className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-ink hover:text-ink"
                                        >
                                            {term}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                            <Link href="/" className={buttonClasses({ variant: 'brand', size: '48' })}>
                                <Home className="h-[18px] w-[18px]" aria-hidden="true" /> Ana sayfaya dön
                            </Link>
                            <Link href="/products/" className={buttonClasses({ variant: 'outline-ink', size: '48' })}>
                                Tüm ürünler <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
            <PopularCategories />
        </div>
    )
}
