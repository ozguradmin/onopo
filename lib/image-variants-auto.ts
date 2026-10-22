/**
 * Resized WebP variants made on the server with the Cloudflare Images binding (env.IMAGES), so nobody has to
 * press "Eksikleri oluştur" in the admin any more.
 *
 * Same files as the browser path (lib/imageVariants.ts): v/<w>/<key>.webp for w = 200/400/800/1200, never
 * upscaled (fit scale-down), transparency flattened onto white (the logo keeps it: the dark footer inverts it),
 * quality 80, `Content-Type: image/webp`, `Cache-Control: public, max-age=31536000, immutable`. A server write
 * never replaces an existing variant (If-None-Match: *).
 *
 * Two triggers:
 *  - right after an admin upload (app/api/admin/upload, app/api/upload): the original's bytes are still in
 *    memory, the four variants are made in ctx.waitUntil;
 *  - the daily cron (/api/cron/automation/?job=images): every image the storefront shows as a variant (active
 *    products, active hero slides, image cards, the logo) whose variants are missing in R2 (four R2 list calls,
 *    not a HEAD per file), bounded per run.
 *
 * Cost (checked 2026-10 in the Images docs): the binding is billed per UNIQUE transformation (source + params)
 * per calendar month, 5,000 free per month on the Images Free plan; over it new transformations fail with 9422
 * and nothing is charged. ~330 images × 4 widths once, then a few uploads a week, fits. Input ≤ 20 MB.
 * 9422 (monthly free quota used) and 9432 (account on the legacy Image Resizing subscription) stop the run and
 * are logged as errors; the browser path in the admin stays as the fallback.
 *
 * Pure apart from the injected bucket and binding (tests pass fakes).
 */
import { imageKey } from './images'
import type { SystemLogEvent } from './system-log'
import { runPaced, type PaceClock } from './automation/pacing'

export const VARIANT_WIDTHS = [200, 400, 800, 1200] as const
/** Keys the variant convention accepts (same rule as POST /api/admin/upload's variantOf). */
export const VARIANT_SOURCE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,250}$/
export const VARIANT_CACHE_CONTROL = 'public, max-age=31536000, immutable'
export const VARIANT_QUALITY = 80
/** The Images binding's input limit. */
export const IMAGES_INPUT_MAX_BYTES = 20 * 1024 * 1024
/** Daily sweep: at most this many images (× up to 4 transformations) per run. */
export const VARIANT_SWEEP_MAX_IMAGES = 60

export function variantKeyOf(key: string, width: number): string {
    return `v/${width}/${key}.webp`
}

/** Whether a key can get variants at all: our key format, not SVG (not resized) or GIF (animation). */
export function canHaveVariants(key: string, contentType?: string | null): boolean {
    if (!VARIANT_SOURCE_KEY.test(key)) return false
    if (/\.(svg|gif)$/i.test(key)) return false
    if (contentType && (!/^image\//i.test(contentType) || /svg|gif/i.test(contentType))) return false
    return true
}

// ---------------------------------------------------------------------------------------------
// What the storefront shows
// ---------------------------------------------------------------------------------------------

export interface ImageRef {
    key: string
    /** where it is used, for the system log ("Logo", "Ürün #12 …") */
    uses: string[]
    keepTransparency: boolean
}

export interface ImageSources {
    logoUrl?: string | null
    heroSlides?: { title?: string | null; image_url?: string | null }[]
    /** homepage_sections rows of type image_card (config is JSON text or an object) */
    imageCards?: { title?: string | null; config?: unknown }[]
    products?: { id: number; name?: string | null; images?: unknown }[]
}

function parseImages(images: unknown): string[] {
    if (Array.isArray(images)) return images.filter((x): x is string => typeof x === 'string')
    if (typeof images === 'string' && images.trim()) {
        try {
            const v = JSON.parse(images)
            return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
        } catch {
            return []
        }
    }
    return []
}

function configImage(config: unknown): string | null {
    let c = config
    if (typeof c === 'string') {
        try {
            c = JSON.parse(c)
        } catch {
            return null
        }
    }
    const url = (c as { image_url?: unknown } | null)?.image_url
    return typeof url === 'string' ? url : null
}

/**
 * Every R2 image the storefront shows as a variant, once per key, in priority order (logo, hero, image
 * cards, then products, newest first). External URLs, data: URIs and local files are not ours and skipped;
 * SVG/GIF and odd keys are counted in `unsupported`.
 */
export function collectReferencedImages(src: ImageSources): { refs: ImageRef[]; unsupported: string[] } {
    const byKey = new Map<string, ImageRef>()
    const unsupported = new Set<string>()
    const add = (url: unknown, use: string, keepTransparency = false) => {
        if (typeof url !== 'string' || !url.trim()) return
        const key = imageKey(url)
        if (!key) return
        if (!canHaveVariants(key)) {
            unsupported.add(key)
            return
        }
        const ref = byKey.get(key) ?? { key, uses: [], keepTransparency: false }
        if (!ref.uses.includes(use)) ref.uses.push(use)
        ref.keepTransparency ||= keepTransparency
        byKey.set(key, ref)
    }
    add(src.logoUrl, 'Logo', true)
    for (const s of src.heroSlides ?? []) add(s?.image_url, `Hero: ${s?.title || 'görsel'}`)
    for (const c of src.imageCards ?? []) add(configImage(c?.config), `Görsel kart: ${c?.title || 'kart'}`)
    for (const p of [...(src.products ?? [])].sort((a, b) => b.id - a.id)) {
        for (const url of parseImages(p.images)) add(url, `Ürün #${p.id}${p.name ? ` ${String(p.name).slice(0, 60)}` : ''}`)
    }
    return { refs: [...byKey.values()], unsupported: [...unsupported] }
}

// ---------------------------------------------------------------------------------------------
// R2 and the Images binding (the few methods used here; the real bindings satisfy them)
// ---------------------------------------------------------------------------------------------

export interface BucketLite {
    get(key: string): Promise<{ size: number; arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>
    put(key: string, value: ArrayBuffer, options: { httpMetadata: { contentType: string; cacheControl: string }; onlyIf?: Headers }): Promise<unknown>
    list(options: { prefix: string; cursor?: string; limit?: number }): Promise<{ objects: { key: string; size?: number }[]; truncated: boolean; cursor?: string }>
}

export interface ImagesLite {
    input(stream: ReadableStream<Uint8Array>): ImageChain
}
interface ImageChain {
    transform(options: Record<string, unknown>): ImageChain
    output(options: { format: string; quality?: number }): Promise<{ response(): Response }>
}

/** Every existing variant key under v/<w>/ (one paged R2 list per width). */
export async function listExistingVariants(bucket: BucketLite, widths: readonly number[] = VARIANT_WIDTHS): Promise<Set<string>> {
    const out = new Set<string>()
    for (const w of widths) {
        let cursor: string | undefined
        for (let page = 0; page < 100; page++) {
            const r = await bucket.list({ prefix: `v/${w}/`, cursor, limit: 1000 })
            for (const o of r.objects) out.add(o.key)
            if (!r.truncated || !r.cursor) break
            cursor = r.cursor
        }
    }
    return out
}

/** Every object under `prefix` with its size in bytes (paged R2 list, at most `maxPages` pages of 1000). */
export async function listObjectSizes(bucket: BucketLite, prefix = '', maxPages = 50): Promise<Map<string, number>> {
    const out = new Map<string, number>()
    let cursor: string | undefined
    for (let page = 0; page < maxPages; page++) {
        const r = await bucket.list({ prefix, cursor, limit: 1000 })
        for (const o of r.objects) out.set(o.key, typeof o.size === 'number' ? o.size : 0)
        if (!r.truncated || !r.cursor) break
        cursor = r.cursor
    }
    return out
}

export interface VariantCoverage {
    /** images the storefront shows that can have variants */
    images: number
    /** all four widths exist */
    ready: number
    /** some widths exist */
    partial: number
    /** no width exists */
    missing: number
    /** SVG/GIF/odd keys: shown as they are */
    unsupported: number
    /** originals not found in R2 (a broken image link) */
    noOriginal: number
    /** total size of the originals found in R2 */
    originalBytes: number
    /** total size of the 400 px copies (what product cards load) of the images that have one */
    cardBytes: number
    /** total size of the originals of those same images, to compare with cardBytes */
    cardOriginalBytes: number
}

/** Admin › Görsel Optimizasyonu: how many shown images have their WebP copies, from one listing of the bucket. */
export function variantCoverage(refs: readonly ImageRef[], sizes: ReadonlyMap<string, number>, unsupported = 0, widths: readonly number[] = VARIANT_WIDTHS): VariantCoverage {
    const c: VariantCoverage = { images: refs.length, ready: 0, partial: 0, missing: 0, unsupported, noOriginal: 0, originalBytes: 0, cardBytes: 0, cardOriginalBytes: 0 }
    for (const ref of refs) {
        const have = widths.filter(w => sizes.has(variantKeyOf(ref.key, w))).length
        if (have === widths.length) c.ready++
        else if (have > 0) c.partial++
        else c.missing++
        const original = sizes.get(ref.key)
        if (original === undefined) c.noOriginal++
        else c.originalBytes += original
        const card = sizes.get(variantKeyOf(ref.key, 400))
        if (card !== undefined && original !== undefined) {
            c.cardBytes += card
            c.cardOriginalBytes += original
        }
    }
    return c
}

/** The widths each image is missing, in the refs' order; images with all four are left out. */
export function selectMissing(refs: readonly ImageRef[], existing: ReadonlySet<string>, widths: readonly number[] = VARIANT_WIDTHS): { ref: ImageRef; widths: number[] }[] {
    const out: { ref: ImageRef; widths: number[] }[] = []
    for (const ref of refs) {
        const missing = widths.filter(w => !existing.has(variantKeyOf(ref.key, w)))
        if (missing.length) out.push({ ref, widths: missing })
    }
    return out
}

export type ImagesErrorKind = 'quota' | 'billing' | 'unsupported' | 'transient' | 'other'

/** 9422 = monthly free transformations used, 9432 = legacy billing; 9413/9520/9412 = this image cannot be done. */
export function classifyImagesError(err: unknown): ImagesErrorKind {
    const text = `${(err as { code?: unknown } | null)?.code ?? ''} ${err instanceof Error ? err.message : String(err ?? '')}`
    if (/\b9422\b/.test(text)) return 'quota'
    if (/\b9432\b/.test(text)) return 'billing'
    if (/\b(9412|9413|9520|9523)\b|unsupported|not a valid image|invalid image/i.test(text)) return 'unsupported'
    if (/\b(9504|9505|9510|9522|9524|9529|500|502|503|504)\b|time(d)?\s?out|network|internal error/i.test(text)) return 'transient'
    return 'other'
}

export interface VariantJobResult {
    stored: number[]
    /** already in R2 (the conditional put was refused) */
    existed: number[]
    /** first failure: 'original_missing', 'too_large', 'unsupported', 'quota', 'billing', 'transient', 'error' */
    failed: { width: number | null; reason: string; detail?: string } | null
}

/**
 * Makes and stores the given widths of one image. `source` = the original's bytes when the caller has them
 * (fresh upload); otherwise they are read from R2. Never throws.
 */
export async function createVariants(
    deps: { bucket: BucketLite; images: ImagesLite },
    ref: { key: string; keepTransparency?: boolean },
    widths: readonly number[] = VARIANT_WIDTHS,
    source?: { bytes: ArrayBuffer; contentType?: string | null },
): Promise<VariantJobResult> {
    const result: VariantJobResult = { stored: [], existed: [], failed: null }
    let bytes: ArrayBuffer
    let contentType: string | null | undefined = source?.contentType
    try {
        if (source) {
            bytes = source.bytes
        } else {
            const obj = await deps.bucket.get(ref.key)
            if (!obj) {
                result.failed = { width: null, reason: 'original_missing' }
                return result
            }
            if (obj.size > IMAGES_INPUT_MAX_BYTES) {
                result.failed = { width: null, reason: 'too_large', detail: `${Math.round(obj.size / 1024 / 1024)} MB` }
                return result
            }
            contentType = obj.httpMetadata?.contentType
            bytes = await obj.arrayBuffer()
        }
    } catch (err) {
        result.failed = { width: null, reason: 'transient', detail: err instanceof Error ? err.message : 'r2 read' }
        return result
    }
    if (bytes.byteLength > IMAGES_INPUT_MAX_BYTES) {
        result.failed = { width: null, reason: 'too_large', detail: `${Math.round(bytes.byteLength / 1024 / 1024)} MB` }
        return result
    }
    if (!canHaveVariants(ref.key, contentType)) {
        result.failed = { width: null, reason: 'unsupported', detail: contentType ?? undefined }
        return result
    }

    for (const width of widths) {
        let webp: ArrayBuffer
        try {
            const transform: Record<string, unknown> = { width, fit: 'scale-down' }
            if (!ref.keepTransparency) transform.background = '#ffffff'
            const out = await deps.images
                .input(new Blob([bytes]).stream())
                .transform(transform)
                .output({ format: 'image/webp', quality: VARIANT_QUALITY })
            const res = out.response()
            webp = await res.arrayBuffer()
            if (!webp.byteLength) throw new Error('empty output')
        } catch (err) {
            const kind = classifyImagesError(err)
            result.failed = { width, reason: kind === 'other' ? 'error' : kind, detail: err instanceof Error ? err.message.slice(0, 300) : undefined }
            return result
        }
        try {
            const put = await deps.bucket.put(variantKeyOf(ref.key, width), webp, {
                httpMetadata: { contentType: 'image/webp', cacheControl: VARIANT_CACHE_CONTROL },
                // Never replace a variant that is already there (the browser path may have made it first)
                onlyIf: new Headers({ 'If-None-Match': '*' }),
            })
            if (put === null) result.existed.push(width)
            else result.stored.push(width)
        } catch (err) {
            result.failed = { width, reason: 'transient', detail: err instanceof Error ? err.message.slice(0, 300) : 'r2 write' }
            return result
        }
    }
    return result
}

// ---------------------------------------------------------------------------------------------
// The daily sweep
// ---------------------------------------------------------------------------------------------

export interface SweepResult {
    images: number
    missingImages: number
    done: number
    failed: { ref: ImageRef; reason: string; detail?: string }[]
    remaining: number
    stopped: string
    unsupported: number
}

/** Creates the missing variants, one image at a time, at most `maxImages`, until `deadline`. Never throws. */
export async function runVariantSweep(
    deps: { bucket: BucketLite; images: ImagesLite; clock?: PaceClock },
    refs: readonly ImageRef[],
    opts: { maxImages?: number; deadline?: number; unsupported?: number } = {},
): Promise<SweepResult> {
    const base: SweepResult = { images: refs.length, missingImages: 0, done: 0, failed: [], remaining: 0, stopped: 'done', unsupported: opts.unsupported ?? 0 }
    let missing: { ref: ImageRef; widths: number[] }[]
    try {
        missing = selectMissing(refs, await listExistingVariants(deps.bucket))
    } catch (err) {
        return { ...base, stopped: 'list_failed', failed: [], remaining: refs.length }
    }
    base.missingImages = missing.length
    if (!missing.length) return base
    const details = new Map<string, string | undefined>()
    const r = await runPaced(
        missing,
        async job => {
            const res = await createVariants(deps, job.ref, job.widths)
            if (!res.failed) return { kind: 'ok', value: res }
            details.set(job.ref.key, res.failed.detail)
            if (res.failed.reason === 'quota' || res.failed.reason === 'billing') return { kind: 'stop', reason: res.failed.reason }
            if (res.failed.reason === 'transient') return { kind: 'transient', reason: 'transient' }
            return { kind: 'skip', reason: res.failed.reason }
        },
        { intervalMs: 100, backoffMs: [], maxItems: opts.maxImages ?? VARIANT_SWEEP_MAX_IMAGES, deadline: opts.deadline, clock: deps.clock, maxConsecutiveFailures: 10 },
    )
    return {
        ...base,
        done: r.ok.length,
        failed: r.failed.map(f => ({ ref: f.item.ref, reason: f.reason, detail: details.get(f.item.ref.key) })),
        remaining: r.remaining.length,
        stopped: r.stopped,
    }
}

const REASON_TR: Record<string, string> = {
    original_missing: 'Orijinal görsel depoda (R2) yok.',
    too_large: "Görsel 20 MB'tan büyük; küçültülmüş kopya yapılamıyor.",
    unsupported: 'Görsel biçimi desteklenmiyor.',
    transient: 'Geçici bağlantı hatası; sonraki denemede tekrar yapılacak.',
    error: 'Görsel işlenemedi.',
    exception: 'Beklenmeyen hata.',
}

/** The system log lines of one image's failure (upload or sweep). */
export function variantFailureEvent(ref: { key: string; uses?: string[] }, failed: { reason: string; detail?: string }, context: 'upload' | 'sweep'): SystemLogEvent {
    if (failed.reason === 'quota') {
        return { source: 'images', level: 'error', message: "Cloudflare Images'ın bu ayki ücretsiz dönüştürme hakkı (5.000) doldu; yeni görsellerin küçük kopyaları ay başına kadar yapılamaz.", detail: '9422 — Admin › Görsel Optimizasyonu sayfasından tarayıcıda oluşturabilirsin.' }
    }
    if (failed.reason === 'billing') {
        return { source: 'images', level: 'error', message: 'Cloudflare Images bağlantısı bu hesapta kullanılamıyor (eski Image Resizing aboneliği).', detail: "9432 — Cloudflare panelinde Images aboneliğine geçilmeli; o zamana kadar varyantlar tarayıcıda oluşturulur." }
    }
    const uses = ref.uses?.length ? ` · ${ref.uses.slice(0, 2).join(', ')}` : ''
    return {
        source: 'images',
        level: failed.reason === 'transient' ? 'warn' : 'error',
        message: `Görselin küçültülmüş kopyaları oluşturulamadı: ${REASON_TR[failed.reason] ?? REASON_TR.error}`,
        detail: `${context === 'upload' ? 'Yüklemeden sonra' : 'Günlük tarama'}${uses}${failed.detail ? ` · ${failed.detail}` : ''}`.slice(0, 1000),
        ref: ref.key,
    }
}

/** System log lines for a sweep (one per failed image, one when the run stopped for a reason to act on). */
export function sweepLogEvents(r: SweepResult): SystemLogEvent[] {
    const out: SystemLogEvent[] = []
    for (const f of r.failed) out.push(variantFailureEvent(f.ref, f, 'sweep'))
    if (r.stopped === 'quota' || r.stopped === 'billing') out.push(variantFailureEvent({ key: '' }, { reason: r.stopped }, 'sweep'))
    else if (r.stopped === 'list_failed') out.push({ source: 'images', level: 'error', message: 'Görsel deposu (R2) okunamadı; eksik görsel kopyaları kontrol edilemedi.' })
    else if (r.stopped === 'failures') out.push({ source: 'images', level: 'error', message: 'Art arda birçok görselin kopyası oluşturulamadı; görsel servisinde sorun olabilir.', detail: `${r.done} tamam, ${r.failed.length} hata` })
    return out
}
