/**
 * Which store links the Next router may prefetch ahead of a tap (components/layout/PrefetchLink.tsx). Only public
 * pages whose payload is the same for every visitor, the pages of the edge-cache allowlist (lib/edge-cache.ts, where
 * worker.ts also caches their RSC payloads): never the account, orders, checkout, login, review or admin pages,
 * never APIs or files. Tiny on purpose: it ships with the shell (scripts/rsc-cache.test.mjs checks that it never
 * allows more than the edge-cache rules do).
 */

// Personal or private pages, as prefixes like lib/edge-cache.ts DENY (plus its other reserved segments)
const PRIVATE_PAGE = /^\/(admin|odeme|profile|orders|login|register|siparis-|degerlendir|maintenance|categories|api)/

/** A same-site page link that may be prefetched (path + optional query; no protocol, no hash-only link). */
export function isPrefetchableHref(href: string | null | undefined): boolean {
    if (!href || !href.startsWith('/') || href.startsWith('//')) return false
    const path = href.split(/[?#]/)[0] || '/'
    if (PRIVATE_PAGE.test(path)) return false
    // Files (sitemap, feeds, images) are not pages
    if (/\.[a-z0-9]{2,5}$/i.test(path)) return false
    return true
}

/** What the browser says about the connection (navigator.connection, where it exists). */
export interface ConnectionHints {
    saveData?: boolean
    effectiveType?: string
}

/** No prefetching for a visitor who asked to save data or is on a 2G-class connection. */
export function prefetchAllowedOn(connection: ConnectionHints | null | undefined): boolean {
    if (!connection) return true
    if (connection.saveData) return false
    return !/(^|-)2g$/.test(connection.effectiveType || '')
}
