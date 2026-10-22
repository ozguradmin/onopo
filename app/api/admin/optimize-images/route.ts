/**
 * /api/admin/optimize-images/: Admin › Görsel Optimizasyonu's summary (admin only).
 *
 * GET → VariantCoverage & { automatic } (lib/image-variants-server.ts): how many of the images the storefront
 *       shows have all four WebP copies (v/<w>/<key>.webp), some, or none, and the real sizes of the originals
 *       and of the 400 px copies the product cards load. One R2 listing per request.
 *
 * The copies themselves are made on upload and by the daily cron (server), or from the page's
 * "Eksik varyantlar" panel (browser, through /api/admin/upload/).
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { variantCoverageReport } from '@/lib/image-variants-server'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET() {
    const denied = await requireAdmin()
    if (denied) return denied
    try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare')
        const { env } = await getCloudflareContext({ async: true })
        return NextResponse.json(await variantCoverageReport(env), { headers })
    } catch (err) {
        console.error('optimize_images_coverage', err instanceof Error ? err.message : 'error')
        return NextResponse.json({ error: 'Görsel durumu okunamadı.' }, { status: 500, headers })
    }
}
