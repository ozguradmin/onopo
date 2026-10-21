/**
 * CMS page list (Admin › Sayfalar) for the side navigation of /page/<slug>/.
 * The page itself is loaded with resolveCmsPageCached (lib/seo-routing.ts).
 */
import 'server-only'
import { cache } from 'react'
import { getDB } from '@/lib/db'
import { cmsPagePath } from '@/lib/seo'

export interface CmsPageLink {
    slug: string
    title: string
    href: string
}

// Customer-service pages first, in the order shoppers look for them; any other page follows by title
const PREFERRED_ORDER = ['help', 'shipping', 'mesafeli-satis-sozlesmesi', 'on-bilgilendirme-formu', 'policy', 'kvkk', 'cerez-politikasi', 'terms']

/** All CMS pages as links. Never throws: the list is secondary navigation ([] when D1 fails). */
export const getCmsPageLinks = cache(async (): Promise<CmsPageLink[]> => {
    try {
        const db = await getDB()
        const { results } = await db.prepare('SELECT slug, title FROM pages').all<{ slug: string; title: string }>()
        const rank = (slug: string) => {
            const i = PREFERRED_ORDER.indexOf(slug)
            return i === -1 ? PREFERRED_ORDER.length : i
        }
        const rows = (results || []) as Array<{ slug: string; title: string }>
        return rows
            .filter(r => r.slug && r.title)
            .sort((a, b) => rank(a.slug) - rank(b.slug) || a.title.localeCompare(b.title, 'tr'))
            .map(r => ({ slug: r.slug, title: r.title, href: cmsPagePath(r.slug) }))
    } catch (err) {
        console.error('[cms-pages] page list unavailable:', err)
        return []
    }
})
