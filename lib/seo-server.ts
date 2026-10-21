/**
 * Server half of lib/seo.ts: reads D1, so it must never end up in a client bundle.
 * lib/seo.ts stays pure and can be imported anywhere.
 */
import 'server-only'
import { getDB } from './db'
import { DEFAULT_SITE_SEO, loadSiteSeo, type D1Like, type SiteSeo } from './seo'

let siteSeoCache: { at: number; ttl: number; value: Promise<SiteSeo> } | null = null

/**
 * Site data for metadata/JSON-LD, cached per Worker isolate for 5 minutes (30 s after a failure).
 */
export async function getSiteSeo(): Promise<SiteSeo> {
    const now = Date.now()
    if (siteSeoCache && now - siteSeoCache.at < siteSeoCache.ttl) return siteSeoCache.value
    const entry: { at: number; ttl: number; value: Promise<SiteSeo> } = { at: now, ttl: 5 * 60 * 1000, value: Promise.resolve(DEFAULT_SITE_SEO) }
    entry.value = (async () => {
        try {
            return await loadSiteSeo((await getDB()) as unknown as D1Like)
        } catch (err) {
            console.error('getSiteSeo failed, using defaults:', err)
            entry.ttl = 30 * 1000
            return { ...DEFAULT_SITE_SEO }
        }
    })()
    siteSeoCache = entry
    return entry.value
}
