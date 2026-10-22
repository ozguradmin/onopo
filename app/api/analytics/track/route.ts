import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { isBotUserAgent } from '@/lib/bot-user-agent'
import { recordPageView, type D1Lite } from '@/lib/analytics-db'

/**
 * POST /api/analytics/track/: one store page view (components/layout/LayoutProvider sends it on every page,
 * also on client-side navigations). Body: { page: pathname, landing?: true, ref?: document.referrer }, where
 * landing/ref come only with the first view of a page load (traffic sources).
 *
 * Two writes, both in the background after the answer:
 * - the old `analytics` row (page only), exactly as before, so everything that reads it keeps working;
 * - a `page_views` row for visitor counting (lib/analytics-db.ts): the IP and the user agent only go into a
 *   monthly-salted hash, they are never stored.
 */
export async function POST(req: Request) {
    try {
        // Crawlers, link previewers, uptime checkers and HTTP libraries are not page views
        const userAgent = req.headers.get('user-agent') || ''
        if (isBotUserAgent(userAgent)) {
            return NextResponse.json({ success: true })
        }

        const body = await req.json().catch(() => null) as { page?: unknown; product_id?: unknown; landing?: unknown; ref?: unknown } | null
        const page = typeof body?.page === 'string' && body.page ? body.page.slice(0, 500) : '/'
        const productId = Number.isInteger(Number(body?.product_id)) && Number(body?.product_id) > 0 ? Number(body?.product_id) : null
        const db = await getDB()

        // No DDL for the old table: it exists (schema.sql)
        const legacy = db.prepare('INSERT INTO analytics (page, product_id) VALUES (?, ?)').bind(page, productId)
            .run().catch((error: unknown) => console.error('Analytics insert failed:', error))

        let host = 'onopostore.com'
        try { host = new URL(req.url).hostname } catch { /* keep the default */ }
        const counted = recordPageView(db as unknown as D1Lite, {
            path: page,
            landing: body?.landing === true,
            referrer: typeof body?.ref === 'string' ? body.ref.slice(0, 500) : '',
            userAgent,
            ip: req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
            acceptLanguage: req.headers.get('accept-language'),
        }, host).catch((error: unknown) => console.error('page_views insert failed:', error instanceof Error ? error.message : 'error'))

        const work = Promise.all([legacy, counted])
        // Answer at once and let the writes finish in the background
        try {
            const { getCloudflareContext } = await import('@opennextjs/cloudflare')
            const { ctx } = await getCloudflareContext({ async: true })
            ctx.waitUntil(work)
        } catch {
            await work
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ success: false })
    }
}
