'use client'

/**
 * The product grid with "Daha fazla göster" and crawlable page links (spec §10).
 *
 * The server renders the cards of ONE page (?page=N) and passes them in as ready-made nodes. "Daha
 * fazla göster" asks the server for the next page with one client navigation (router.replace, no
 * scroll jump) and APPENDS its cards, so the visitor keeps their place; the URL follows (?page=N+1),
 * so a reload or a shared link still works. Numbered page links stay plain <a href="?page=N">.
 * Loaded pages are remembered for the session, so coming back from a product restores the whole list.
 */
import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RESULTS_ID, useListing } from './ListingProvider'
import { filterSignature, isNarrowed } from './listing-state'

export interface GridItem {
    key: string
    node: React.ReactNode
    /** Spans the whole row (e.g. the "Tükenen ürünler" divider). */
    wide?: boolean
}

interface Chunk {
    page: number
    items: GridItem[]
}

/** Pages loaded per listing (basePath + filters), kept while the tab lives (client navigation only). */
const loadedPages = new Map<string, Chunk[]>()

function formatCount(n: number): string {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function pageList(current: number, last: number): (number | 'gap')[] {
    const set = new Set([1, last, current - 1, current, current + 1].filter(n => n >= 1 && n <= last))
    if (current <= 3) [2, 3, 4].forEach(n => n <= last && set.add(n))
    if (current >= last - 2) [last - 1, last - 2, last - 3].forEach(n => n >= 1 && set.add(n))
    const sorted = [...set].sort((a, b) => a - b)
    const out: (number | 'gap')[] = []
    sorted.forEach((n, i) => {
        if (i > 0 && n - sorted[i - 1] > 1) out.push('gap')
        out.push(n)
    })
    return out
}

export interface ResultsGridProps {
    items: GridItem[]
    page: number
    totalPages: number
    total: number
    pageSize: number
}

export function ResultsGrid({ items, page, totalPages, total, pageSize }: ResultsGridProps) {
    const { basePath, committed, pending, go } = useListing()
    const memoryKey = basePath + filterSignature(committed)

    const [chunks, setChunks] = React.useState<Chunk[]>(() => {
        const saved = loadedPages.get(memoryKey)
        if (saved && saved.length > 1 && saved[saved.length - 1].page === page) return [...saved.slice(0, -1), { page, items }]
        return [{ page, items }]
    })
    const [seen, setSeen] = React.useState({ memoryKey, page, items })
    const [appendTo, setAppendTo] = React.useState<number | null>(null)

    // New server result: append (after "Daha fazla göster"), refresh the last page, or start over
    if (seen.items !== items || seen.page !== page || seen.memoryKey !== memoryKey) {
        const sameList = seen.memoryKey === memoryKey
        const last = chunks[chunks.length - 1]
        let next: Chunk[]
        if (sameList && last.page === page) next = [...chunks.slice(0, -1), { page, items }]
        else if (sameList && appendTo === page && last.page === page - 1) next = [...chunks, { page, items }]
        else next = [{ page, items }]
        setChunks(next)
        setSeen({ memoryKey, page, items })
        setAppendTo(null)
    }

    React.useEffect(() => {
        loadedPages.delete(memoryKey)
        loadedPages.set(memoryKey, chunks)
        // Keep the 20 most recent listings
        while (loadedPages.size > 20) loadedPages.delete(loadedPages.keys().next().value as string)
    }, [memoryKey, chunks])

    // Flatten, dropping duplicates (the catalogue may change between two pages)
    const seenKeys = new Set<string>()
    const flat: GridItem[] = []
    for (const c of chunks) {
        for (const it of c.items) {
            if (seenKeys.has(it.key)) continue
            seenKeys.add(it.key)
            flat.push(it)
        }
    }

    const firstPage = chunks[0].page
    const lastPage = chunks[chunks.length - 1].page
    const shown = Math.min(total, (lastPage - firstPage + 1) * pageSize)
    const shownUntil = Math.min(total, lastPage * pageSize)
    const hasMore = lastPage < totalPages
    const loadingMore = pending === 'more'
    const dim = pending === 'filter' || pending === 'search'
    const nofollow = isNarrowed(committed) || committed.sort !== 'recommended' ? 'nofollow' : undefined
    const pageHref = (n: number) => `${basePath}${filterSignature(committed)}${n > 1 ? `${filterSignature(committed) ? '&' : '?'}page=${n}` : ''}`

    const loadMore = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        if (loadingMore || !hasMore) return
        setAppendTo(lastPage + 1)
        go({ ...committed, page: lastPage + 1 }, { kind: 'more' })
    }

    return (
        <div id={RESULTS_ID} className="scroll-mt-32">
            <p className="sr-only" aria-live="polite">
                {pending && pending !== 'more' ? 'Sonuçlar güncelleniyor' : `${formatCount(total)} ürün listeleniyor`}
            </p>

            {firstPage > 1 && (
                <div className="mb-4 flex justify-center">
                    <Link
                        href={pageHref(firstPage - 1)}
                        prefetch={false}
                        rel={nofollow}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-white px-4 text-sm font-semibold text-ink transition-colors hover:border-ink"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Önceki ürünleri göster
                    </Link>
                </div>
            )}

            <ul
                aria-busy={dim || loadingMore || undefined}
                className={cn('product-grid lg:grid-cols-3 xl:grid-cols-4 xl:gap-x-5', 'transition-opacity duration-150', dim && 'opacity-50')}
            >
                {flat.map(it => (
                    <li key={it.key} className={cn(it.wide && 'col-span-full')}>
                        {it.node}
                    </li>
                ))}
            </ul>

            {(hasMore || totalPages > 1) && (
                <nav aria-label="Sayfalar" className="mt-10 flex flex-col items-center gap-5">
                    <div className="flex w-full max-w-xs flex-col items-center gap-2">
                        <p className="text-sm text-muted">
                            <span className="tabular-nums font-semibold text-ink">{formatCount(shownUntil)}</span> / <span className="tabular-nums">{formatCount(total)}</span> ürün gösteriliyor
                        </p>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
                            <div className="h-full rounded-full bg-brand-500 transition-[width] duration-300" style={{ width: `${Math.round((shownUntil / Math.max(1, total)) * 100)}%` }} />
                        </div>
                    </div>

                    {hasMore && (
                        <a
                            href={pageHref(lastPage + 1)}
                            rel={nofollow}
                            onClick={loadMore}
                            aria-disabled={loadingMore || undefined}
                            className={cn(
                                'inline-flex h-12 min-w-60 items-center justify-center gap-2 rounded-card border border-ink bg-white px-6 text-[15px] font-semibold text-ink transition-colors duration-150 hover:bg-ink hover:text-white',
                                loadingMore && 'pointer-events-none opacity-70',
                            )}
                        >
                            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            Daha fazla göster
                            <span className="sr-only">
                                {' '}
                                ({formatCount(shown)} / {formatCount(total)})
                            </span>
                        </a>
                    )}

                    {totalPages > 1 && (
                        <ol className="flex flex-wrap items-center justify-center gap-1">
                            <li>
                                {page > 1 ? (
                                    <Link href={pageHref(page - 1)} prefetch={false} rel={nofollow} aria-label="Önceki sayfa" className="inline-flex h-11 w-11 items-center justify-center rounded-full lg:h-10 lg:w-10 text-ink-2 transition-colors hover:bg-surface hover:text-ink">
                                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                    </Link>
                                ) : (
                                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full lg:h-10 lg:w-10 text-subtle" aria-hidden="true">
                                        <ChevronLeft className="h-5 w-5" />
                                    </span>
                                )}
                            </li>
                            {pageList(page, totalPages).map((n, i) =>
                                n === 'gap' ? (
                                    <li key={`gap-${i}`} className="px-1 text-muted" aria-hidden="true">
                                        …
                                    </li>
                                ) : (
                                    <li key={n}>
                                        {n >= firstPage && n <= lastPage ? (
                                            <Link
                                                href={pageHref(n)}
                                                prefetch={false}
                                                rel={nofollow}
                                                aria-current={n === page ? 'page' : undefined}
                                                aria-label={`Sayfa ${n}`}
                                                className={cn(
                                                    'inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 lg:h-10 lg:min-w-10 text-sm font-semibold tabular-nums',
                                                    n === page ? 'bg-ink text-white' : 'bg-surface-2 text-ink',
                                                )}
                                            >
                                                {n}
                                            </Link>
                                        ) : (
                                            <Link
                                                href={pageHref(n)}
                                                prefetch={false}
                                                rel={nofollow}
                                                aria-label={`Sayfa ${n}`}
                                                className="inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 lg:h-10 lg:min-w-10 text-sm font-semibold tabular-nums text-ink-2 transition-colors hover:bg-surface hover:text-ink"
                                            >
                                                {n}
                                            </Link>
                                        )}
                                    </li>
                                ),
                            )}
                            <li>
                                {page < totalPages ? (
                                    <Link href={pageHref(page + 1)} prefetch={false} rel={nofollow} aria-label="Sonraki sayfa" className="inline-flex h-11 w-11 items-center justify-center rounded-full lg:h-10 lg:w-10 text-ink-2 transition-colors hover:bg-surface hover:text-ink">
                                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                    </Link>
                                ) : (
                                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full lg:h-10 lg:w-10 text-subtle" aria-hidden="true">
                                        <ChevronRight className="h-5 w-5" />
                                    </span>
                                )}
                            </li>
                        </ol>
                    )}
                </nav>
            )}
        </div>
    )
}

export default ResultsGrid
