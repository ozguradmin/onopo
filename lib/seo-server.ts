/**
 * Server half of lib/seo.ts: reads D1, so it must never end up in a client bundle.
 * lib/seo.ts stays pure and can be imported anywhere.
 */
import 'server-only'
import { cache } from 'react'
import { getDB } from './db'
import { DEFAULT_SITE_SEO, loadSiteSeo, type D1Like, type SiteSeo } from './seo'

/**
 * Site data for metadata/JSON-LD, read once per request (React cache: the layout, generateMetadata and the
 * page share one read). No cross-request memo: an admin change to shipping, the CMS shipping page, logo or
 * contact data shows on the next render, and the edge cache (lib/edge-cache.ts) already absorbs the load.
 * Never throws: falls back to the defaults.
 */
export const getSiteSeo = cache(async (): Promise<SiteSeo> => {
    try {
        return await loadSiteSeo((await getDB()) as unknown as D1Like)
    } catch (err) {
        console.error('getSiteSeo failed, using defaults:', err)
        return { ...DEFAULT_SITE_SEO }
    }
})
