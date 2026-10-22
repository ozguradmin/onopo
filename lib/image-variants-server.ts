/**
 * Server-side image variants with the Worker env (rules and the pure parts: lib/image-variants-auto.ts).
 *
 * The upload routes call scheduleUploadVariants right after storing an original; when it returns true they
 * answer `variants: 'server'` and the admin's browser skips its own canvas variants (lib/imageVariants.ts).
 * After a 9422 (monthly free quota) or 9432 (legacy billing) this isolate stops offering server variants for
 * an hour, so uploads fall back to the browser path instead of silently getting none.
 */
import 'server-only'
import { logSystemEvent } from '@/lib/system-log'
import {
    IMAGES_INPUT_MAX_BYTES,
    VARIANT_SWEEP_MAX_IMAGES,
    canHaveVariants,
    collectReferencedImages,
    createVariants,
    listObjectSizes,
    runVariantSweep,
    variantCoverage,
    sweepLogEvents,
    variantFailureEvent,
    type BucketLite,
    type ImagesLite,
    type SweepResult,
    type VariantCoverage,
} from '@/lib/image-variants-auto'
import { runInBackground } from '@/lib/automation/background'

const BLOCK_MS = 60 * 60 * 1000
let blockedUntil = 0

function bindings(env: CloudflareEnv): { bucket: BucketLite; images: ImagesLite } | null {
    if (!env.IMAGES || !env.BUCKET) return null
    return { bucket: env.BUCKET as unknown as BucketLite, images: env.IMAGES as unknown as ImagesLite }
}

/**
 * After an upload: makes the four variants in ctx.waitUntil from the bytes already in memory. true when the
 * job was scheduled (the browser then skips its own variants); false when the browser should make them
 * (no Images binding, the binding is blocked for now, SVG/GIF, too large). Never throws.
 */
export async function scheduleUploadVariants(key: string, bytes: ArrayBuffer, contentType: string | null, opts: { keepTransparency?: boolean } = {}): Promise<boolean> {
    try {
        if (Date.now() < blockedUntil) return false
        if (!canHaveVariants(key, contentType) || bytes.byteLength > IMAGES_INPUT_MAX_BYTES) return false
        const { getCloudflareContext } = await import('@opennextjs/cloudflare')
        const { env } = await getCloudflareContext({ async: true })
        const b = bindings(env)
        if (!b) return false
        await runInBackground('images', async bgEnv => {
            const r = await createVariants(b, { key, keepTransparency: opts.keepTransparency }, undefined, { bytes, contentType })
            if (!r.failed) return
            if (r.failed.reason === 'quota' || r.failed.reason === 'billing') blockedUntil = Date.now() + BLOCK_MS
            await logSystemEvent(bgEnv.DB, variantFailureEvent({ key }, r.failed, 'upload'))
        })
        return true
    } catch (err) {
        console.error('image_variants_not_scheduled', err instanceof Error ? err.message : 'error')
        return false
    }
}

async function loadSources(db: D1Database) {
    const empty = { results: [] as Record<string, unknown>[] }
    const [products, slides, cards, logo] = await Promise.all([
        db.prepare('SELECT id, name, images FROM products WHERE is_active = 1').all<Record<string, unknown>>(),
        db.prepare('SELECT title, image_url FROM hero_slides WHERE is_active = 1').all<Record<string, unknown>>().catch(() => empty),
        db.prepare("SELECT title, config FROM homepage_sections WHERE is_active = 1 AND type = 'image_card'").all<Record<string, unknown>>().catch(() => empty),
        db.prepare("SELECT value FROM site_settings WHERE key = 'logo_url'").first<{ value: string | null }>().catch(() => null),
    ])
    return collectReferencedImages({
        logoUrl: logo?.value ?? null,
        heroSlides: (slides.results ?? []).map(r => ({ title: r.title as string | null, image_url: r.image_url as string | null })),
        imageCards: (cards.results ?? []).map(r => ({ title: r.title as string | null, config: r.config })),
        products: (products.results ?? []).map(r => ({ id: Number(r.id), name: r.name as string | null, images: r.images })),
    })
}

/**
 * Admin › Görsel Optimizasyonu: the real coverage of the images the storefront shows (the same list the daily
 * sweep works from) and whether new uploads get their copies on the server (`automatic`).
 */
export async function variantCoverageReport(env: CloudflareEnv): Promise<VariantCoverage & { automatic: boolean }> {
    const { refs, unsupported } = await loadSources(env.DB)
    const sizes = await listObjectSizes(env.BUCKET as unknown as BucketLite)
    return { ...variantCoverage(refs, sizes, unsupported.length), automatic: Boolean(env.IMAGES) && Date.now() >= blockedUntil }
}

/**
 * The daily sweep (cron → /api/cron/automation/?job=images): creates the missing variants of every image the
 * storefront shows, at most VARIANT_SWEEP_MAX_IMAGES, until `deadline`. Failures go to the system log.
 * Never throws.
 */
export async function sweepImageVariants(env: CloudflareEnv, deadline: number): Promise<SweepResult | { stopped: string }> {
    const db = env.DB
    try {
        const b = bindings(env)
        if (!b) {
            await logSystemEvent(db, {
                source: 'images',
                level: 'error',
                message: 'Görsel servisi (Cloudflare Images bağlantısı) yok; görsellerin küçük kopyaları otomatik oluşturulamıyor.',
                detail: "wrangler.toml [images] binding = \"IMAGES\" — o zamana kadar Admin › Görsel Optimizasyonu'ndan tarayıcıda oluşturulabilir.",
            })
            return { stopped: 'no_binding' }
        }
        const { refs, unsupported } = await loadSources(db)
        const r = await runVariantSweep(b, refs, { maxImages: VARIANT_SWEEP_MAX_IMAGES, deadline, unsupported: unsupported.length })
        if (r.stopped === 'quota' || r.stopped === 'billing') blockedUntil = Date.now() + BLOCK_MS
        for (const e of sweepLogEvents(r)) await logSystemEvent(db, e)
        if (r.remaining > 0 && r.stopped === 'max') {
            await logSystemEvent(db, { source: 'images', level: 'info', message: 'Eksik görsel kopyaları birkaç güne bölünerek oluşturuluyor.', detail: `Bu tarama ${r.done} görsel yaptı, ${r.remaining} görsel sonraki günlere kaldı.` })
        }
        return r
    } catch (err) {
        await logSystemEvent(db, { source: 'images', level: 'error', message: 'Günlük görsel kopyası taraması çalışmadı.', detail: err instanceof Error ? err.message : 'error' })
        return { stopped: 'exception' }
    }
}
