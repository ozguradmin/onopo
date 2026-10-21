'use client'

/**
 * Compact catalogue index for instant search (docs/FRONTEND.md §3): GET /api/products/?index=1,
 * loaded once on the first focus of a search box and kept in memory (and in sessionStorage for
 * 10 minutes, so client-side navigations and reloads in the same tab do not fetch it again).
 * The cart drawer reuses it for its "kargo bedava için tamamla" suggestions.
 */
import * as React from 'react'

export interface SearchIndexItem {
    id: number
    name: string
    slug: string
    category: string
    product_code: string | null
    /** RAW price (display with roundPrice / <Price>) */
    price: number
    original_price: number | null
    stock: number
    image: string | null
    free_shipping: boolean
}

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface IndexState {
    status: Status
    items: SearchIndexItem[] | null
}

const STORAGE_KEY = 'onopo-search-index-v1'
const TTL_MS = 10 * 60 * 1000

let state: IndexState = { status: 'idle', items: null }
let inflight: Promise<SearchIndexItem[]> | null = null
const listeners = new Set<() => void>()

function setState(next: IndexState) {
    state = next
    listeners.forEach(l => l())
}

function isItem(x: any): x is SearchIndexItem {
    return x && typeof x === 'object' && typeof x.name === 'string' && typeof x.slug === 'string' && x.id != null
}

function readSession(): SearchIndexItem[] | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed.at !== 'number' || Date.now() - parsed.at > TTL_MS || !Array.isArray(parsed.items)) return null
        return parsed.items.filter(isItem)
    } catch {
        return null
    }
}

function writeSession(items: SearchIndexItem[]) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), items }))
    } catch {
        // storage full or blocked: memory only
    }
}

/** Start loading the index (deduplicated). Resolves with the items; never rejects twice in a row silently. */
export function loadSearchIndex(): Promise<SearchIndexItem[]> {
    if (state.status === 'ready' && state.items) return Promise.resolve(state.items)
    if (inflight) return inflight
    const cached = typeof window !== 'undefined' ? readSession() : null
    if (cached && cached.length > 0) {
        setState({ status: 'ready', items: cached })
        return Promise.resolve(cached)
    }
    setState({ status: 'loading', items: state.items })
    inflight = fetch('/api/products/?index=1', { headers: { Accept: 'application/json' } })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return res.json()
        })
        .then((data: unknown) => {
            const items = Array.isArray(data) ? data.filter(isItem).map(normalize) : []
            if (items.length === 0) throw new Error('empty index')
            writeSession(items)
            setState({ status: 'ready', items })
            return items
        })
        .catch(err => {
            setState({ status: 'error', items: null })
            throw err
        })
        .finally(() => {
            inflight = null
        })
    return inflight
}

function normalize(x: any): SearchIndexItem {
    return {
        id: Number(x.id),
        name: String(x.name),
        slug: String(x.slug),
        category: x.category ? String(x.category) : '',
        product_code: x.product_code ? String(x.product_code) : null,
        price: Number(x.price) || 0,
        original_price: x.original_price == null ? null : Number(x.original_price),
        stock: Number(x.stock) || 0,
        image: x.image ? String(x.image) : null,
        free_shipping: !!x.free_shipping,
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

const SERVER_STATE: IndexState = { status: 'idle', items: null }

/** Current index state; call `load()` (e.g. on focus) to fetch it. */
export function useSearchIndex(): IndexState & { load: () => void } {
    const snapshot = React.useSyncExternalStore(subscribe, () => state, () => SERVER_STATE)
    const load = React.useCallback(() => {
        loadSearchIndex().catch(() => { })
    }, [])
    return { ...snapshot, load }
}
