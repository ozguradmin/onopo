'use client'

/** "Son aramalar": up to 6 recent queries in localStorage (every access wrapped in try/catch). */
import * as React from 'react'
import { foldTr } from '@/lib/search'

const KEY = 'onopo-recent-searches'
const MAX = 6
const EMPTY: string[] = []

let cacheRaw: string | null = null
let cacheValue: string[] = EMPTY
const listeners = new Set<() => void>()

function read(): string[] {
    let raw: string | null = null
    try {
        raw = localStorage.getItem(KEY)
    } catch {
        return EMPTY
    }
    if (raw === cacheRaw) return cacheValue
    cacheRaw = raw
    try {
        const parsed = raw ? JSON.parse(raw) : []
        cacheValue = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string' && s.trim() !== '').slice(0, MAX) : EMPTY
    } catch {
        cacheValue = EMPTY
    }
    return cacheValue
}

function write(list: string[]) {
    try {
        if (list.length === 0) localStorage.removeItem(KEY)
        else localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
    } catch {
        // storage blocked: nothing to remember
    }
    listeners.forEach(l => l())
}

export function addRecentSearch(query: string) {
    const q = query.trim().replace(/\s+/g, ' ').slice(0, 60)
    if (q.length < 2) return
    const key = foldTr(q)
    write([q, ...read().filter(s => foldTr(s) !== key)])
}

export function clearRecentSearches() {
    write([])
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    const onStorage = (e: StorageEvent) => {
        if (e.key === KEY) listener()
    }
    window.addEventListener('storage', onStorage)
    return () => {
        listeners.delete(listener)
        window.removeEventListener('storage', onStorage)
    }
}

export function useRecentSearches(): string[] {
    return React.useSyncExternalStore(subscribe, read, () => EMPTY)
}
