import { IMAGE_VARIANTS_ENABLED, R2_PUBLIC_HOST } from '@/lib/images'

/**
 * GET /api/og-image/<key> — the link-preview image of a product page (og:image / twitter:image while image
 * variants are on; app/[slug]/page.tsx). Answers a 302 to the 1200w WebP variant
 * (https://images.onopostore.com/v/1200/<key>.webp) when it exists in R2, else to the original
 * (https://images.onopostore.com/<key>). Not every image has variants: uploads from a browser that cannot
 * encode WebP, logo/favicon uploads and Excel-imported image URLs get none, and a preview that points at a
 * missing variant stays broken in WhatsApp/Facebook (they cannot fall back like FallbackImage does).
 *
 * The redirect always stays on the R2 image host (never an open redirect). Cacheable: a day when the variant
 * exists, an hour when it does not yet (a later backfill can add it). Not on the worker's edge-cache
 * allowlist (lib/edge-cache.ts), so it is BYPASS and keeps this Cache-Control; a 302 is never stored there.
 * With variants off it simply redirects to the original (nothing links here then).
 */

const VARIANT_WIDTH = 1200
const DAY = 'public, max-age=86400'
const HOUR = 'public, max-age=3600'

function redirect(location: string, cacheControl: string): Response {
    return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': cacheControl } })
}

function encodeKey(key: string): string {
    return key.split('/').map(encodeURIComponent).join('/')
}

export async function GET(_req: Request, props: { params: Promise<{ key: string[] }> }) {
    const { key: parts } = await props.params
    const key = (parts || []).join('/')
    // An R2 object key of an original: no empty or dot segments, no variant path, no control characters
    if (!key || key.length > 1024 || key.startsWith('v/') || parts.some(p => !p || p === '.' || p === '..') || /[\u0000-\u001f\u007f\\]/.test(key)) {
        return new Response('Not found', { status: 404 })
    }
    const original = `${R2_PUBLIC_HOST}/${encodeKey(key)}`
    if (!IMAGE_VARIANTS_ENABLED) return redirect(original, DAY)

    const variantKey = `v/${VARIANT_WIDTH}/${key}.webp`
    try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare')
        const { env } = await getCloudflareContext({ async: true })
        const head = await env.BUCKET.head(variantKey)
        if (head) return redirect(`${R2_PUBLIC_HOST}/${encodeKey(variantKey)}`, DAY)
        return redirect(original, HOUR)
    } catch (err) {
        console.error('[og-image] variant check failed:', err)
        return redirect(original, 'public, max-age=300')
    }
}

export { GET as HEAD }
