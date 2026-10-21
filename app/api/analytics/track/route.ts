import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

// Crawlers, link previewers, uptime checkers and HTTP libraries are not page views
const BOT_USER_AGENT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pagespeed|curl|wget|python|go-http|java\/|okhttp|axios|node-fetch|undici|httpclient|libwww|monitor|uptime/i

export async function POST(req: Request) {
    try {
        const userAgent = req.headers.get('user-agent') || ''
        if (!userAgent || BOT_USER_AGENT.test(userAgent)) {
            return NextResponse.json({ success: true })
        }

        const { page, product_id } = await req.json()
        const db = await getDB()

        // No DDL here: the analytics table exists (schema.sql)
        const insert = db.prepare('INSERT INTO analytics (page, product_id) VALUES (?, ?)').bind(
            typeof page === 'string' && page ? page.slice(0, 500) : '/',
            Number.isInteger(Number(product_id)) && Number(product_id) > 0 ? Number(product_id) : null
        ).run().catch((error: unknown) => console.error('Analytics insert failed:', error))

        // Answer at once and let the write finish in the background
        try {
            const { getCloudflareContext } = await import('@opennextjs/cloudflare')
            const { ctx } = await getCloudflareContext({ async: true })
            ctx.waitUntil(insert)
        } catch {
            await insert
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ success: false })
    }
}
