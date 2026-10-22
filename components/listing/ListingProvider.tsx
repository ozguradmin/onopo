'use client'

/**
 * Client state for one listing page. The URL is the only source of truth: every change is a single
 * client-side navigation (router.replace in a transition, never a reload), and the server renders the
 * result. While a navigation is in flight the controls show the requested state (optimistic), so quick
 * taps build on each other instead of on the stale page.
 *
 * The listing's own sticky parts (mobile toolbar, desktop sidebar) sit under the store header through
 * `--header-offset`, which the header sets on <html> from its open/collapsed state (Header.tsx).
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { filterSignature, listingHref, type ListingState } from './listing-state'

export type PendingKind = 'filter' | 'search' | 'more' | null

interface NavigateOptions {
    /** filter (default): dim the grid · search: typing, no scroll · more: "Daha fazla göster" append */
    kind?: Exclude<PendingKind, null>
    /** Bring the top of the results into view after the update (filters and sort; never while typing). */
    scrollToResults?: boolean
}

interface ListingContextValue {
    basePath: string
    /** The state the controls should show (requested state while a navigation is pending). */
    state: ListingState
    /** The state the server rendered. */
    committed: ListingState
    pending: PendingKind
    /** Navigate to a full state. */
    go: (next: ListingState, opts?: NavigateOptions) => void
    /** Merge a change into the latest requested state; resets the page to 1. */
    update: (patch: Partial<ListingState>, opts?: NavigateOptions) => void
    href: (next: ListingState) => string
}

const ListingContext = React.createContext<ListingContextValue | null>(null)

export function useListing(): ListingContextValue {
    const ctx = React.useContext(ListingContext)
    if (!ctx) throw new Error('useListing must be used inside <ListingProvider>')
    return ctx
}

const RESULTS_ID = 'listing-results'

export function ListingProvider({ basePath, state, children }: { basePath: string; state: ListingState; children: React.ReactNode }) {
    const router = useRouter()
    const [isPending, startTransition] = React.useTransition()
    const [optimistic, setOptimistic] = React.useState<ListingState | null>(null)
    const [kind, setKind] = React.useState<PendingKind>(null)
    const latest = React.useRef(state)
    const scrollAfter = React.useRef(false)
    const committedKey = filterSignature(state) + '#' + state.page

    // A navigation finished (ours or someone else's, e.g. the header search): the server state wins
    React.useEffect(() => {
        if (isPending) return
        latest.current = state
        setOptimistic(null)
        setKind(null)
        if (scrollAfter.current) {
            scrollAfter.current = false
            const el = document.getElementById(RESULTS_ID)
            if (el) {
                // Scrolling up re-opens a collapsed header: leave room for its full (layout) height
                const offset = document.querySelector<HTMLElement>('header[data-site-header]')?.offsetHeight ?? 0
                const top = el.getBoundingClientRect().top - offset - 64
                if (top < 0) window.scrollBy({ top, behavior: 'auto' })
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPending, committedKey])

    const go = React.useCallback(
        (next: ListingState, opts: NavigateOptions = {}) => {
            const url = listingHref(basePath, next)
            const current = listingHref(basePath, latest.current)
            if (url === current) return
            latest.current = next
            setOptimistic(next)
            setKind(opts.kind ?? 'filter')
            if (opts.scrollToResults) scrollAfter.current = true
            startTransition(() => {
                router.replace(url, { scroll: false })
            })
        },
        [basePath, router],
    )

    const update = React.useCallback(
        (patch: Partial<ListingState>, opts?: NavigateOptions) => go({ ...latest.current, page: 1, ...patch }, opts),
        [go],
    )

    const href = React.useCallback((next: ListingState) => listingHref(basePath, next), [basePath])

    const value = React.useMemo<ListingContextValue>(
        () => ({
            basePath,
            state: optimistic ?? state,
            committed: state,
            pending: isPending ? kind ?? 'filter' : null,
            go,
            update,
            href,
        }),
        [basePath, optimistic, state, isPending, kind, go, update, href],
    )

    return (
        <ListingContext.Provider value={value}>
            <div data-listing-root="">
                {children}
            </div>
        </ListingContext.Provider>
    )
}

export { RESULTS_ID }
