import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, props: { params: Promise<{ key: string }> }) {
    const params = await props.params
    const key = params.key
    const url = new URL(req.url)

    // Check Cloudflare Edge Cache first
    // @ts-ignore - caches is available in Cloudflare Workers
    const cache = typeof caches !== 'undefined' ? caches.default : null
    const cacheKey = new Request(url.toString(), req)

    if (cache) {
        const cachedResponse = await cache.match(cacheKey)
        if (cachedResponse) {
            return cachedResponse
        }
    }

    try {
        // Get bucket via OpenNext
        const { getCloudflareContext } = await import('@opennextjs/cloudflare')
        const { env } = await getCloudflareContext()
        const bucket = env.BUCKET

        const object = await bucket.get(key)

        if (!object) {
            return new NextResponse('Image not found', { status: 404 })
        }

        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)
        headers.set('Cache-Control', 'public, max-age=31536000, immutable') // 1 year browser cache

        // Ensure Content-Type is set correctly
        if (!headers.get('Content-Type')) {
            if (key.endsWith('.png')) headers.set('Content-Type', 'image/png')
            else if (key.endsWith('.jpg') || key.endsWith('.jpeg')) headers.set('Content-Type', 'image/jpeg')
            else if (key.endsWith('.webp')) headers.set('Content-Type', 'image/webp')
            else if (key.endsWith('.svg')) headers.set('Content-Type', 'image/svg+xml')
            else if (key.endsWith('.gif')) headers.set('Content-Type', 'image/gif')
        }

        // Clone body for caching (body can only be read once)
        const body = await object.arrayBuffer()

        const response = new Response(body, {
            status: 200,
            headers,
        })

        // Store in Cloudflare Edge Cache
        if (cache) {
            // Clone response before caching (response body can only be read once)
            const responseToCache = new Response(body, {
                status: 200,
                headers,
            })
            // Don't await - cache in background
            cache.put(cacheKey, responseToCache)
        }

        return response

    } catch (error: any) {
        console.error('Image fetch error:', key, error)
        return new NextResponse('Error fetching image', { status: 500 })
    }
}
